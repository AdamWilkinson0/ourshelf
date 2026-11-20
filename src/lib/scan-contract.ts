import { z } from "zod";
import { dateSchema, foodDraft } from "./household";
export const haulResult = z.object({
  items: z.array(foodDraft.extend({ date_confidence: z.enum(["read", "estimated"]) })).max(80),
});
export const dateResult = z.object({
  date: dateSchema.nullable(),
  date_type: z.enum(["use_by", "best_before"]).nullable(),
  raw_text: z.string(),
});
export type ScanMode = "haul" | "date";
export const maxImageBytes = 10 * 1024 * 1024;
