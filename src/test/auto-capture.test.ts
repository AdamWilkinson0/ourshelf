import { describe, expect, it } from "vitest";
import { captureArea, captureDecision, type AutoCapture } from "../lib/auto-capture";

const stripes = (offset: number) =>
  Uint8Array.from({ length: 32 * 32 }, (_, index) => ((index + offset) % 8 < 4 ? 60 : 200));

describe("automatic capture", () => {
  it("waits for a stable view, skips it after capture, and re-arms for the next item", () => {
    const state: AutoCapture = { candidate: null, lastCapture: null };
    const first = stripes(0);
    const second = stripes(4);
    expect(captureDecision(state, first, 0)).toBe(false);
    expect(captureDecision(state, first, 349)).toBe(false);
    expect(captureDecision(state, second, 350)).toBe(false);
    expect(captureDecision(state, second, 699)).toBe(false);
    expect(captureDecision(state, second, 700)).toBe(true);
    state.lastCapture = second;
    expect(captureDecision(state, second, 3000)).toBe(false);
    expect(captureDecision(state, first, 3200)).toBe(false);
    expect(captureDecision(state, first, 3550)).toBe(true);
  });

  it("captures a small item against a large background with brief hand movement", () => {
    const state: AutoCapture = { candidate: null, lastCapture: null };
    const frame = (product: number, drift = 0, shift = 0) =>
      Uint8Array.from({ length: 32 * 32 }, (_, index) => {
        const x = (index % 32) - shift;
        const y = Math.floor(index / 32);
        return x >= 12 && x < 20 && y >= 12 && y < 20 ? product + drift : 130 + drift;
      });
    const first = frame(50);
    const next = frame(220);
    expect(captureDecision(state, first, 0)).toBe(false);
    expect(captureDecision(state, frame(50, 9, 1), 350)).toBe(true);
    state.lastCapture = first;
    expect(captureDecision(state, frame(50, 9, 1), 500)).toBe(false);
    expect(captureDecision(state, next, 600)).toBe(false);
    expect(captureDecision(state, next, 950)).toBe(true);
  });

  it("skips solid-colour frames and crops around the guide on portrait and landscape cameras", () => {
    const state: AutoCapture = { candidate: null, lastCapture: null };
    expect(captureDecision(state, new Uint8Array(1024).fill(120), 1000)).toBe(false);
    expect(state.candidate).toBeNull();
    for (const [width, height] of [
      [1280, 720],
      [720, 1280],
    ] as const) {
      const [x, y, cropWidth, cropHeight] = captureArea(width, height);
      expect(x + cropWidth / 2).toBeCloseTo(width / 2);
      expect(y + cropHeight / 2).toBeCloseTo(height / 2);
      expect(cropWidth / cropHeight).toBeCloseTo(4 / 3);
    }
  });
});
