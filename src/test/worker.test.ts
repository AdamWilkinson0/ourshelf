// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { issueScanGrant } from "../lib/scan-grant";
import worker, { ScanQuota } from "../../worker";
import type { QuotaStorage } from "../../worker/quota";

const origin = "http://localhost:5173";
const secret = "a".repeat(43);
const users = { adam: crypto.randomUUID(), maya: crypto.randomUUID(), leo: crypto.randomUUID() };
// A 1x1 JPEG generated for this test.
const jpeg =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==";
const payload = { image: jpeg, mimeType: "image/jpeg", mode: "haul" };

function harness() {
  const values = new Map<string, unknown>();
  let tail = Promise.resolve();
  const storage: QuotaStorage = {
    async get<T>(key: string) {
      return structuredClone(values.get(key)) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      values.set(key, structuredClone(value));
    },
    transaction(callback) {
      const job = tail.then(() => callback(storage));
      tail = job.then(
        () => undefined,
        () => undefined,
      );
      return job;
    },
  };
  const object = new ScanQuota({ storage });
  const env = {
    ALLOWED_ORIGINS: origin,
    GEMINI_API_KEY: "test-only",
    GEMINI_MODEL: "test-model",
    SCAN_GRANT_SECRET: secret,
    SCAN_QUOTA: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: (url: string, init: RequestInit) => object.fetch(new Request(url, init)),
      }),
    },
  };
  function send(token: string | null, body: unknown = payload, requestOrigin = origin) {
    const headers = new Headers({ Origin: requestOrigin, "Content-Type": "application/json" });
    if (token) headers.set("Authorization", "Bearer " + token);
    return worker.fetch(
      new Request("https://worker.test/scan", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
      env,
    );
  }
  return { send, env };
}

function upstream(value: unknown) {
  return vi.fn<typeof fetch>().mockImplementation(async () =>
    Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ thought: true, text: "Excluded reasoning" }, { text: JSON.stringify(value) }],
          },
        },
      ],
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("fails closed for missing, tampered and expired grants and rejects invalid photos", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
  const { send } = harness();
  const google = vi.fn();
  vi.stubGlobal("fetch", google);
  const grant = await issueScanGrant(secret, users.adam);
  expect((await send(null)).status).toBe(401);
  expect((await send(grant.replace(users.adam, users.maya))).status).toBe(401);
  expect((await send(grant, payload, "https://elsewhere.test")).status).toBe(403);
  expect((await send(grant, { ...payload, image: "AAAA" })).status).toBe(422);
  expect((await send(grant, { ...payload, image: jpeg.slice(0, -8) })).status).toBe(422);
  expect((await send(grant, { ...payload, mimeType: "image/webp" })).status).toBe(400);
  vi.setSystemTime(new Date("2026-11-20T12:01:00Z"));
  expect((await send(grant)).status).toBe(401);
  expect(google).not.toHaveBeenCalled();
});

it("allows browser preflight and rejects requests when the quota binding is absent", async () => {
  const { env } = harness();
  const request = new Request("https://worker.test/scan", {
    method: "OPTIONS",
    headers: { Origin: origin },
  });
  const preflight = await worker.fetch(request, env);
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  expect(preflight.headers.get("Cache-Control")).toBe("no-store");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { SCAN_QUOTA: _quota, ...unconfigured } = env;
  const response = await worker.fetch(
    new Request("https://worker.test/scan", {
      method: "POST",
      headers: { Origin: origin },
    }),
    unconfigured,
  );
  expect(response.status).toBe(503);
});

it("gates Gemini calls with per-user and global limits", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
  const { send } = harness();
  const google = upstream({ items: [] });
  vi.stubGlobal("fetch", google);
  const adam = await issueScanGrant(secret, users.adam);
  const batch = await Promise.all(Array.from({ length: 8 }, () => send(adam)));
  expect(batch.filter((response) => response.status === 200)).toHaveLength(6);
  expect(batch.find((response) => response.status === 429)?.headers.get("Retry-After")).toBe("60");
  expect((await send(await issueScanGrant(secret, users.maya))).status).toBe(200);
  for (let minute = 1; minute <= 7; minute++) {
    vi.setSystemTime(new Date("2026-11-20T12:0" + minute + ":00Z"));
    const grants = await Promise.all(
      Object.values(users).map((user) => issueScanGrant(secret, user)),
    );
    await Promise.all(grants.flatMap((token) => Array.from({ length: 6 }, () => send(token))));
  }
  expect(google).toHaveBeenCalledTimes(120);
  expect((await send(await issueScanGrant(secret, users.leo))).status).toBe(429);
  vi.setSystemTime(new Date("2026-11-21T00:00:00Z"));
  expect((await send(await issueScanGrant(secret, users.leo))).status).toBe(200);
});

it.each([
  ["USE BY 19 NOV", null],
  ["USE BY 19 NOV 2026", "2026-11-19"],
  ["19/11/26", "2026-11-19"],
  ["BEST BEFORE 31/02/2026", null],
  ["", null],
])("validates the printed calendar date in %j", async (raw_text, date) => {
  const { send } = harness();
  vi.stubGlobal("fetch", upstream({ raw_text, date_type: raw_text ? "use_by" : null }));
  const response = await send(await issueScanGrant(secret, users.adam), {
    ...payload,
    mode: "date",
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ raw_text, date });
});

const groceries = {
  name: "Milk",
  quantity: "2 pints",
  date: "2026-11-24",
  date_type: null,
  date_confidence: "estimated",
};

it("returns a validated haul without expanding Gemini's schema for each array position", async () => {
  const { send } = harness();
  const items = Array.from({ length: 80 }, () => groceries);
  const google = upstream({ items });
  vi.stubGlobal("fetch", google);
  const response = await send(await issueScanGrant(secret, users.adam));
  expect(await response.json()).toEqual({ items });
  const options = google.mock.calls[0]![1]!;
  const { generationConfig } = JSON.parse(options.body as string);
  expect(generationConfig).toMatchObject({
    responseSchema: { required: ["items"] },
    thinkingConfig: { thinkingLevel: "low" },
  });
  expect(generationConfig).not.toHaveProperty("responseSchema.properties.items.maxItems");
});

it("distinguishes provider quota, timeout and bad output without logging photos", async () => {
  const { send } = harness();
  const logger = vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const [mock, status, reason] of [
    [vi.fn().mockResolvedValue(new Response(null, { status: 429 })), 503, "provider-quota"],
    [
      vi.fn().mockRejectedValue(new DOMException("Timeout", "TimeoutError")),
      504,
      "provider-timeout",
    ],
    [upstream({ items: [{}] }), 502, "provider-output"],
    [upstream({ items: Array.from({ length: 81 }, () => groceries) }), 502, "provider-output"],
  ] as const) {
    vi.stubGlobal("fetch", mock);
    const result = await send(await issueScanGrant(secret, users.adam));
    expect(result.status).toBe(status);
    const { requestId } = await result.json();
    expect(logger).toHaveBeenLastCalledWith("scan failed", {
      reason,
      mode: "haul",
      requestId,
      upstreamStatus: reason === "provider-quota" ? 429 : undefined,
    });
  }
});

it("reads multiple numbered captures in one quota reservation and preserves their indexes", async () => {
  const { send } = harness();
  const items = [
    { ...groceries, capture: 2 },
    { ...groceries, capture: 1, name: "Carrots" },
  ];
  const google = upstream({ items });
  vi.stubGlobal("fetch", google);
  const token = await issueScanGrant(secret, users.adam);
  const batch = { mode: "batch", mimeType: "image/jpeg", images: [jpeg, jpeg] };
  const response = await send(token, batch);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ items });
  expect(google).toHaveBeenCalledTimes(1);
  const { contents } = JSON.parse(google.mock.calls[0]![1]!.body as string);
  expect(contents[0].parts.slice(1)).toEqual([
    { text: "Photo 1" },
    { inlineData: { mimeType: "image/jpeg", data: jpeg } },
    { text: "Photo 2" },
    { inlineData: { mimeType: "image/jpeg", data: jpeg } },
  ]);
  const more = await Promise.all(Array.from({ length: 5 }, () => send(token, batch)));
  expect(more.every(({ status }) => status === 200)).toBe(true);
  expect((await send(token, batch)).status).toBe(429);
});

it("rejects invalid batch photos and conflicting or missing capture indexes", async () => {
  const { send } = harness();
  const token = await issueScanGrant(secret, users.adam);
  const batch = { mode: "batch", mimeType: "image/jpeg", images: [jpeg, jpeg] };
  const google = vi.fn();
  vi.stubGlobal("fetch", google);
  expect((await send(token, { ...batch, images: Array(5).fill(jpeg) })).status).toBe(400);
  expect((await send(token, { ...batch, images: [jpeg, "AAAA"] })).status).toBe(422);
  expect(google).not.toHaveBeenCalled();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const indexes of [[2, 2], [3], [undefined]]) {
    vi.stubGlobal(
      "fetch",
      upstream({ items: indexes.map((capture) => ({ ...groceries, capture })) }),
    );
    expect((await send(token, batch)).status).toBe(502);
  }
});
