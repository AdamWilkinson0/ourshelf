const sampleSide = 32;
const stableForMs = 700;
const motionLimit = 7;
const newViewThreshold = 18;

// Keep the decision separate from camera I/O so it can be tested with recorded or synthetic frames.
export interface AutoCapture {
  lastCapture: Uint8Array | null;
  candidate: { pixels: Uint8Array; since: number } | null;
}

function difference(first: Uint8Array, second: Uint8Array) {
  let total = 0;
  for (let i = 0; i < first.length; i++) total += Math.abs(first[i]! - second[i]!);
  return total / first.length;
}

function hasDetail(pixels: Uint8Array) {
  let brightness = 0;
  let detail = 0;
  for (let i = 0; i < pixels.length; i++) {
    brightness += pixels[i]!;
    if (i % sampleSide) detail += Math.abs(pixels[i]! - pixels[i - 1]!);
    if (i >= sampleSide) detail += Math.abs(pixels[i]! - pixels[i - sampleSide]!);
  }
  return brightness / pixels.length > 25 && detail / pixels.length > 12;
}

export function captureDecision(state: AutoCapture, pixels: Uint8Array, now: number) {
  if (
    !hasDetail(pixels) ||
    (state.lastCapture && difference(state.lastCapture, pixels) < newViewThreshold)
  ) {
    state.candidate = null;
    return false;
  }
  if (!state.candidate || difference(state.candidate.pixels, pixels) > motionLimit) {
    state.candidate = { pixels, since: now };
    return false;
  }
  return now - state.candidate.since >= stableForMs;
}

export function captureArea(width: number, height: number) {
  // Match the center of the 4:3 preview and the guide within it.
  const previewWidth = Math.min(width, (height * 4) / 3);
  const previewHeight = (previewWidth * 3) / 4;
  const cropWidth = previewWidth * 0.76;
  const cropHeight = previewHeight * 0.76;
  return [(width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight] as const;
}

export function samplePreview(video: HTMLVideoElement, ctx: CanvasRenderingContext2D) {
  ctx.drawImage(
    video,
    ...captureArea(video.videoWidth, video.videoHeight),
    0,
    0,
    sampleSide,
    sampleSide,
  );
  const { data } = ctx.getImageData(0, 0, sampleSide, sampleSide);
  const pixels = new Uint8Array(sampleSide * sampleSide);
  for (let i = 0; i < pixels.length; i++) {
    const offset = i * 4;
    pixels[i] = (data[offset]! * 2 + data[offset + 1]! * 5 + data[offset + 2]!) / 8;
  }
  return pixels;
}

export function previewSampler() {
  const canvas = document.createElement("canvas");
  canvas.width = sampleSide;
  canvas.height = sampleSide;
  return canvas.getContext("2d", { willReadFrequently: true });
}
