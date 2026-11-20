import {
  batchResult,
  dateResult,
  haulResult,
  maxImageBytes,
  photoSide,
  type ScanMode,
} from "./scan-contract";
import { z } from "zod";

async function encodePhoto(file: File, mode: ScanMode): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("Couldn’t open that photo. Try a JPEG or take another picture.");
    });
    const scale = Math.min(1, photoSide[mode] / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Camera image unavailable.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL("image/jpeg", mode === "haul" ? 0.86 : 0.9).split(",")[1];
    if (!encoded || encoded.length > Math.ceil(maxImageBytes / 3) * 4)
      throw Error("Photo is too large.");
    return encoded;
  } finally {
    URL.revokeObjectURL(url);
  }
}
type AuthorizeScan = () => Promise<string>;

export function scan(
  file: File,
  mode: "haul",
  authorize: AuthorizeScan,
): Promise<z.infer<typeof haulResult>>;
export function scan(
  file: File,
  mode: "date",
  authorize: AuthorizeScan,
): Promise<z.infer<typeof dateResult>>;
export async function scan(file: File, mode: ScanMode, authorize: AuthorizeScan) {
  const image = await encodePhoto(file, mode);
  const response = await requestScan({ image, mode }, authorize);
  return (mode === "haul" ? haulResult : dateResult).parse(response);
}

export async function scanBatch(images: string[], authorize: AuthorizeScan, signal: AbortSignal) {
  return batchResult.parse(await requestScan({ images, mode: "batch" }, authorize, signal));
}

async function requestScan(
  input: { mode: ScanMode; image: string } | { mode: "batch"; images: string[] },
  authorize: AuthorizeScan,
  cancellation?: AbortSignal,
) {
  const scanUrl = import.meta.env["VITE_SCAN_API_URL"];
  if (!scanUrl) throw Error("Live scan is not connected.");
  cancellation?.throwIfAborted();
  const grant = await authorize();
  cancellation?.throwIfAborted();
  const timeout = AbortSignal.timeout(25_000);
  const signal = cancellation ? AbortSignal.any([cancellation, timeout]) : timeout;
  const result = await fetch(scanUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + grant },
    body: JSON.stringify({ ...input, mimeType: "image/jpeg" }),
    signal,
  }).catch(() => {
    throw new Error(
      timeout.aborted ? "The upload or scan timed out." : "Couldn’t reach the scanner.",
    );
  });
  if (!result.ok) {
    const body: unknown = await result.json().catch(() => null);
    const error = z.object({ error: z.string() }).safeParse(body);
    throw new Error(error.success ? error.data.error : "Live scanning is unavailable.");
  }
  return result.json();
}
