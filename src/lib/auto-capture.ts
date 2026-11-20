const sampleSide = 32;
const stableForMs = 350;
const motionLimit = 12;
const regionSide = 8;
const regionsPerRow = sampleSide / regionSide;

function regionOf(index: number) {
  const row = Math.floor(index / sampleSide);
  const column = index % sampleSide;
  return Math.floor(row / regionSide) * regionsPerRow + Math.floor(column / regionSide);
}

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

function newItemInView(previous: Uint8Array, pixels: Uint8Array) {
  // A smaller item can change substantially while most of the background stays the same.
  const changes = new Float32Array(regionsPerRow * regionsPerRow);
  let total = 0;
  for (let i = 0; i < pixels.length; i++) {
    const change = Math.abs(previous[i]! - pixels[i]!);
    const region = regionOf(i);
    changes[region] = changes[region]! + change;
    total += change;
  }
  return total / pixels.length >= 18 || changes.some((change) => change / regionSide ** 2 >= 34);
}

function hasDetail(pixels: Uint8Array) {
  const details = new Float32Array(regionsPerRow * regionsPerRow);
  let brightness = 0;
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i]!;
    brightness += pixel;
    const horizontal = i % sampleSide ? Math.abs(pixel - pixels[i - 1]!) : 0;
    const vertical = i >= sampleSide ? Math.abs(pixel - pixels[i - sampleSide]!) : 0;
    const region = regionOf(i);
    details[region] = details[region]! + horizontal + vertical;
  }
  return brightness / pixels.length > 22 && details.some((detail) => detail / regionSide ** 2 > 8);
}

export function captureDecision(state: AutoCapture, pixels: Uint8Array, now: number) {
  if (!hasDetail(pixels) || (state.lastCapture && !newItemInView(state.lastCapture, pixels))) {
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
  // Keep this crop aligned with the 6% inset of the camera guide.
  const cropWidth = previewWidth * 0.88;
  const cropHeight = previewHeight * 0.88;
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
