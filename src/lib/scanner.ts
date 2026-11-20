import { dateResult, haulResult, maxImageBytes, type ScanMode } from "./scan-contract";
import { localDate } from "./household";
import { z } from "zod";

async function encodePhoto(file: File, mode: ScanMode): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale =
      mode === "haul" ? Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Camera image unavailable.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL("image/jpeg", mode === "haul" ? 0.86 : 0.93).split(",")[1];
    if (!encoded || encoded.length > Math.ceil(maxImageBytes / 3) * 4)
      throw Error("Photo is too large.");
    return encoded;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function scan(file: File, mode: "haul"): Promise<z.infer<typeof haulResult>>;
export function scan(file: File, mode: "date"): Promise<z.infer<typeof dateResult>>;
export async function scan(file: File, mode: ScanMode) {
  const url = import.meta.env["VITE_SCAN_API_URL"];
  if (!url) throw Error("Live scan is not connected.");
  const signal = AbortSignal.timeout(8000);
  const image = await encodePhoto(file, mode);
  const result = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, mimeType: "image/jpeg", mode, today: localDate() }),
    signal,
  });
  if (!result.ok) throw Error("Scan unavailable.");
  return (mode === "haul" ? haulResult : dateResult).parse(await result.json());
}
