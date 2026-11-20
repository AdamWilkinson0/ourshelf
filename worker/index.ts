import { z } from "zod";
import { dateSchema } from "../src/lib/household";
import { dateResult, haulResult, maxImageBytes } from "../src/lib/scan-contract";
interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  ALLOWED_ORIGINS: string;
  SCAN_LIMIT?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}
const payload = z.object({
  mode: z.enum(["haul", "date"]),
  today: dateSchema,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  image: z
    .string()
    .min(4)
    .max(Math.ceil(maxImageBytes / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
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
      items: object({
        name: str,
        quantity: str,
        date: str,
        date_type: labelType,
        date_confidence: { type: "STRING", enum: ["estimated", "read"] },
      }),
    },
  }),
  date: object({ date: { ...str, nullable: true }, date_type: labelType, raw_text: str }),
};
const prompts = {
  haul: "Identify distinct UK groceries. Give a short name, quantity, ISO date YYYY-MM-DD, label type or null. Mark read only if the printed date is clearly legible. Otherwise estimate from typical storage life and mark estimated. Return an empty list for an unrelated photo.",
  date: "Transcribe a UK use by or best before date from the label. Parse DD/MM and DD MON. If year omitted use next occurrence on or after today. Return date as YYYY-MM-DD and raw_text exactly as printed. If unclear return date and date_type null, raw_text empty. Never guess.",
};
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!allowed.includes(origin)) return new Response("Forbidden", { status: 403 });
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
      "Cache-Control": "no-store",
    };
    const response = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (new URL(req.url).pathname !== "/scan") return response({ error: "Unknown endpoint" }, 404);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return response({ error: "Use POST" }, 405);
    if (!req.headers.get("Content-Type")?.startsWith("application/json"))
      return response({ error: "Expected JSON" }, 415);
    if (!env.GEMINI_API_KEY) return response({ error: "Scanner is not configured" }, 503);
    if (
      env.SCAN_LIMIT &&
      !(await env.SCAN_LIMIT.limit({ key: req.headers.get("CF-Connecting-IP") ?? "local" })).success
    )
      return response({ error: "Scan limit reached" }, 429);
    const limit = Math.ceil(maxImageBytes / 3) * 4 + 1024;
    const reader = req.body?.getReader();
    if (!reader) return response({ error: "Missing body" }, 400);
    let body = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          return response({ error: "Image too large" }, 413);
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } catch {
      return response({ error: "Incomplete upload" }, 400);
    }
    let input;
    try {
      input = payload.parse(JSON.parse(body));
    } catch {
      return response({ error: "Invalid scan input" }, 400);
    }
    const { mode, today, mimeType, image } = input;
    try {
      const result = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(env.GEMINI_MODEL) +
          ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          signal: AbortSignal.timeout(7500),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Today is " + today + ". " + prompts[mode] },
                  { inlineData: { mimeType, data: image } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schemas[mode],
            },
          }),
        },
      );
      if (!result.ok) throw Error();
      const data = (await result.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      };
      const answer = data.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("");
      const parsed = JSON.parse(answer ?? "");
      return response((mode === "haul" ? haulResult : dateResult).parse(parsed));
    } catch {
      return response({ error: "Could not read this photo" }, 502);
    }
  },
};
