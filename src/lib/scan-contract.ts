import { z } from "zod";
import { dateSchema, foodDraft } from "./household";
export const maxHaulItems = 80;
const scannedFood = foodDraft.extend({ date_confidence: z.enum(["read", "estimated"]) });
export const haulResult = z.object({ items: z.array(scannedFood).max(maxHaulItems) });
export const maxBatchPhotos = 4;
export const batchResult = z.object({
  items: z
    .array(scannedFood.extend({ capture: z.number().int().min(1).max(maxBatchPhotos) }))
    .max(maxBatchPhotos),
});
export const dateResult = z.object({
  date: dateSchema.nullable(),
  date_type: z.enum(["use_by", "best_before"]).nullable(),
  raw_text: z.string().max(160),
});
export type ScanMode = "haul" | "date";
export const maxImageBytes = 3 * 1024 * 1024;
export const photoSide = { haul: 1600, date: 2400 } as const;
export const maxCaptureBytes = maxImageBytes / maxBatchPhotos;
export const cameraPhotoSide = 1200;
