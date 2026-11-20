import { it, expect, vi, afterEach } from "vitest";
import worker from "../../worker";
const env = {
  ALLOWED_ORIGINS: "http://localhost:5173",
  GEMINI_API_KEY: "test-only",
  GEMINI_MODEL: "test-model",
};
const payload = { today: "2026-11-20", image: "AAAA", mimeType: "image/jpeg", mode: "haul" };
function send(body = payload, origin = env.ALLOWED_ORIGINS) {
  return worker.fetch(
    new Request("http://worker.test/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    }),
    env,
  );
}
function upstream(text: string) {
  return vi
    .fn()
    .mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text }] } }] }));
}
afterEach(() => vi.unstubAllGlobals());
it("validates and returns a structured haul from Gemini", async () => {
  const row = {
    name: "Milk",
    quantity: "2 pints",
    date: "2026-11-24",
    date_type: null,
    date_confidence: "estimated",
  };
  const fetch = upstream(JSON.stringify({ items: [row] }));
  vi.stubGlobal("fetch", fetch);
  const response = await send();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ items: [row] });
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGINS);
  const options = fetch.mock.calls[0]![1];
  expect(JSON.parse(options.body).generationConfig.responseSchema.required).toContain("items");
});
it("accepts a read label or an unreadable label without guessing", async () => {
  for (const result of [
    { date: "2026-11-21", date_type: "use_by", raw_text: "USE BY 21 NOV" },
    { date: null, date_type: null, raw_text: "" },
  ]) {
    vi.stubGlobal("fetch", upstream(JSON.stringify(result)));
    expect(await (await send({ ...payload, mode: "date" })).json()).toEqual(result);
  }
});
it("fails cleanly on corrupt output and upstream timeout", async () => {
  for (const mock of [
    upstream("not JSON"),
    upstream('{"items":[{}]}'),
    vi.fn().mockRejectedValue(new DOMException("Timeout", "TimeoutError")),
  ]) {
    vi.stubGlobal("fetch", mock);
    expect((await send()).status).toBe(502);
  }
});
it("rejects unlisted origins and malformed payloads before calling Gemini", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect((await send(payload, "https://elsewhere.test")).status).toBe(403);
  expect((await send({ ...payload, today: "not a date" })).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
