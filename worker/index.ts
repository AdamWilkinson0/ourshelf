import { z } from "zod";
import { houseDate } from "../src/lib/household";
import { dateResult, haulResult, maxImageBytes, photoSide } from "../src/lib/scan-contract";
import { scanSecret, verifyScanGrant } from "../src/lib/scan-grant";
import { printedDate } from "./label-date";
import { supportedJpeg } from "./photo";

export { ScanQuota } from "./quota";

interface QuotaBinding {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> };
}
interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  SCAN_GRANT_SECRET?: string;
  SCAN_QUOTA?: QuotaBinding;
}

const payload = z.object({
  mode: z.enum(["haul", "date"]),
  mimeType: z.literal("image/jpeg"),
  image: z
    .string()
    .min(4)
    .max(Math.ceil(maxImageBytes / 3) * 4),
});
const str = { type: "STRING" };
const labelType = { type: "STRING", enum: ["best_before", "use_by"], nullable: true };
const object = (properties: Record<string, unknown>) => ({
  type: "OBJECT",
  properties,
  required: Object.keys(properties),
});
const schemas = {
  haul: object({
    items: {
      type: "ARRAY",
      maxItems: 80,
      items: object({
        name: str,
        quantity: str,
        date: str,
        date_type: labelType,
        date_confidence: { type: "STRING", enum: ["estimated", "read"] },
      }),
    },
  }),
  date: object({ date_type: labelType, raw_text: str }),
};
const prompts = {
  haul: "Identify distinct UK groceries. Give a short name, quantity, ISO date YYYY-MM-DD, label type or null. Mark read only if all parts of the date, including the year, are clearly printed. Otherwise estimate from typical storage life, set the label type to null, and mark estimated. Return an empty list for an unrelated photo.",
  date: "Transcribe only the UK use by or best before date portion of the label. Return raw_text exactly as printed, preserving the day, month and year if present. Return the label type only if printed. Do not fill in missing digits or a missing year. If the day or month is unclear, return an empty raw_text and a null date_type.",
};

class InputError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readJson(req: Request, limit: number): Promise<unknown> {
  const contentType = req.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new InputError("Expected JSON.", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new InputError("Missing request body.", 400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 8000);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (timedOut) throw new InputError("Upload took too long.", 408);
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new InputError("Request is too large.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("Invalid or incomplete JSON.", 400);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

const labelResponse = dateResult.omit({ date: true });

async function scan(req: Request, env: Env, reserve: () => Promise<Response>) {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL)
    return Response.json({ error: "Live scanning is unavailable." }, { status: 503 });

  const input = payload.safeParse(await readJson(req, Math.ceil(maxImageBytes / 3) * 4 + 1024));
  if (!input.success) throw new InputError("Invalid scan input.", 400);
  const { mode, image, mimeType } = input.data;
  if (!supportedJpeg(image, photoSide[mode]))
    throw new InputError("This photo is invalid or unsupported.", 422);
  const rate = await reserve();
  if (rate.status !== 204) {
    if (rate.status === 429) return rate;
    throw new Error("Scan quota reservation failed");
  }

  const requestId = crypto.randomUUID();
  const fail = (reason: string, status: number, message: string, upstreamStatus?: number) => {
    console.warn("scan failed", { requestId, mode, reason, upstreamStatus });
    return Response.json({ error: message, requestId }, { status });
  };
  const deadline = AbortSignal.timeout(11_000);
  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(env.GEMINI_MODEL) +
        ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        signal: AbortSignal.any([deadline, req.signal]),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    mode === "haul"
                      ? "Today is " + houseDate() + ". " + prompts.haul
                      : prompts.date,
                },
                { inlineData: { mimeType, data: image } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schemas[mode],
            thinkingConfig: { thinkingLevel: "low" },
            maxOutputTokens: mode === "haul" ? 8192 : 1024,
          },
        }),
      },
    );
    if (!upstream.ok) {
      void upstream.body?.cancel().catch(() => {});
      return upstream.status === 429
        ? fail("provider-quota", 503, "The scanner is busy. Try again later.", upstream.status)
        : fail("provider-http", 502, "The scanner service is unavailable.", upstream.status);
    }
    const data = (await upstream.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
      }[];
    };
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== "STOP")
      return fail("provider-incomplete", 502, "The scanner couldn’t finish reading this photo.");
    const answer = candidate?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("");
    const parsed: unknown = JSON.parse(answer ?? "");
    if (mode === "haul") return Response.json(haulResult.parse(parsed));
    const label = labelResponse.parse(parsed);
    return Response.json({ ...label, date: printedDate(label.raw_text) });
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    if (deadline.aborted || (error instanceof Error && error.name === "TimeoutError"))
      return fail("provider-timeout", 504, "The scan timed out. Try a smaller or closer photo.");
    return fail(
      error instanceof SyntaxError || error instanceof z.ZodError
        ? "provider-output"
        : "provider-network",
      502,
      "The scanner couldn’t read this photo.",
    );
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!allowed.includes(origin)) return new Response("Forbidden", { status: 403 });
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Expose-Headers": "Retry-After",
      Vary: "Origin",
      "Cache-Control": "no-store",
    };
    const cors = (response: Response) =>
      new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...headers },
      });
    const path = new URL(req.url).pathname;
    if (path !== "/scan")
      return cors(Response.json({ error: "Unknown endpoint." }, { status: 404 }));
    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (req.method !== "POST")
      return cors(Response.json({ error: "Method not allowed." }, { status: 405 }));

    try {
      const secret = scanSecret.safeParse(env.SCAN_GRANT_SECRET);
      const binding = env.SCAN_QUOTA;
      if (!secret.success || !binding) {
        console.error("Scanner is missing signing or quota configuration");
        return cors(Response.json({ error: "Live scanning is unavailable." }, { status: 503 }));
      }
      const user = await verifyScanGrant(secret.data, req.headers.get("Authorization"));
      if (!user)
        return cors(
          Response.json(
            { error: "Scan authorization expired. Try again from your house." },
            { status: 401 },
          ),
        );
      const quota = binding.get(binding.idFromName("global"));
      return cors(
        await scan(req, env, () =>
          quota.fetch("https://quota.internal/", {
            method: "POST",
            body: user,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof InputError)
        return cors(Response.json({ error: error.message }, { status: error.status }));
      console.error("Scanner request failed", {
        kind: error instanceof Error ? error.name : "unknown",
      });
      return cors(Response.json({ error: "Live scanning is unavailable." }, { status: 503 }));
    }
  },
};
