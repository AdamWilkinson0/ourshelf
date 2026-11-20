import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import {
  captureArea,
  captureDecision,
  previewSampler,
  samplePreview,
  type AutoCapture,
} from "@/lib/auto-capture";
import type { Draft } from "@/lib/household";
import { cameraPhotoSide, maxBatchPhotos, maxCaptureBytes } from "@/lib/scan-contract";
import { scanBatch } from "@/lib/scanner";

const maxCaptures = maxBatchPhotos * 4;

type Capture = { id: number; image: string };
type FailedBatch = { batch: Capture[]; message: string };

function encodeCapture(video: HTMLVideoElement) {
  const crop = captureArea(video.videoWidth, video.videoHeight);
  const scale = Math.min(1, cameraPhotoSide / Math.max(crop[2], crop[3]));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop[2] * scale));
  canvas.height = Math.max(1, Math.round(crop[3] * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Couldn’t capture a camera frame.");
  ctx.drawImage(video, ...crop, 0, 0, canvas.width, canvas.height);
  const image = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  if (!image || image.length > Math.ceil(maxCaptureBytes / 3) * 4)
    throw Error("This capture is too large. Try again or upload a photo.");
  return image;
}

export function CameraScan({
  authorize,
  close,
  review,
}: {
  authorize: () => Promise<string>;
  close: () => void;
  review: (items: Draft[], missed: number) => void;
}) {
  const latestAuthorizer = useRef(authorize);
  const video = useRef<HTMLVideoElement>(null);
  const progress = useRef<AutoCapture>({ lastCapture: null, candidate: null });
  const abort = useRef<AbortController | null>(null);
  const queued = useRef<Capture[]>([]);
  const results = useRef(new Map<number, Draft>());
  const failed = useRef<FailedBatch[]>([]);
  const work = useRef(Promise.resolve());
  const total = useRef(0);
  const canCapture = useRef(true);
  const [captured, setCaptured] = useState(0);
  const [recognized, setRecognized] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [phase, setPhase] = useState<"capture" | "reading" | "failed">("capture");
  const [failedMessage, setFailedMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    latestAuthorizer.current = authorize;
  }, [authorize]);

  const submit = useCallback((batch: Capture[]) => {
    const signal = abort.current?.signal;
    if (!batch.length || !signal) return;
    work.current = work.current.then(async () => {
      if (signal.aborted) return;
      try {
        const response = await scanBatch(
          batch.map((photo) => photo.image),
          latestAuthorizer.current,
          signal,
        );
        if (signal.aborted) return;
        for (const { capture, ...item } of response.items) {
          const photo = batch[capture - 1];
          if (photo) results.current.set(photo.id, item);
        }
        setRecognized(results.current.size);
      } catch (error) {
        if (!signal.aborted) {
          failed.current.push({
            batch,
            message: error instanceof Error ? error.message : "Couldn’t read the captures.",
          });
        }
      }
    });
  }, []);

  const pauseCamera = useCallback(() => {
    canCapture.current = false;
    setEnabled(false);
    setReady(false);
  }, []);

  const tryCapture = useCallback(
    (element: HTMLVideoElement, sampler: CanvasRenderingContext2D) => {
      if (!canCapture.current || document.hidden || element.readyState < 2 || !element.videoWidth)
        return;
      try {
        const pixels = samplePreview(element, sampler);
        if (!captureDecision(progress.current, pixels, performance.now())) return;
        const image = encodeCapture(element);
        progress.current = { lastCapture: pixels, candidate: null };
        total.current++;
        queued.current.push({ id: total.current, image });
        setCaptured(total.current);
        navigator.vibrate?.(25);
        if (queued.current.length >= maxBatchPhotos)
          submit(queued.current.splice(0, maxBatchPhotos));
        if (total.current === maxCaptures) pauseCamera();
      } catch (error) {
        setCameraError(error instanceof Error ? error.message : "Couldn’t capture a camera frame.");
        pauseCamera();
      }
    },
    [pauseCamera, submit],
  );

  useEffect(() => {
    if (!enabled) return;
    const element = video.current;
    const sampler = previewSampler();
    if (!element || !sampler || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can’t open the camera. You can upload a photo instead.");
      return;
    }

    let active = true;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const onVisibility = () => {
      if (document.hidden) pauseCamera();
    };
    const onEnded = () => {
      setCameraError("The camera stopped. Restart it or upload a photo.");
      pauseCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const camera = element;
    const sample = sampler;
    async function openCamera() {
      try {
        const current = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
        if (!active) {
          current.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = current;
        stream.getVideoTracks().forEach((track) => track.addEventListener("ended", onEnded));
        camera.srcObject = current;
        await camera.play();
        if (!active) return;
        setReady(true);
        progress.current.candidate = null;
        timer = setInterval(() => tryCapture(camera, sample), 100);
      } catch (error) {
        if (!active) return;
        setCameraError(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera permission is unavailable. Allow camera access in the browser or upload a photo."
            : "Couldn’t open the camera. Restart it or upload a photo.",
        );
        pauseCamera();
      }
    }
    void openCamera();
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
      stream?.getTracks().forEach((track) => {
        track.removeEventListener("ended", onEnded);
        track.stop();
      });
      element.srcObject = null;
    };
  }, [enabled, pauseCamera, tryCapture]);

  function openReview() {
    const items = [...results.current.entries()].sort(([a], [b]) => a - b).map(([, item]) => item);
    review(items, total.current - items.length);
  }

  async function finish(retry = false) {
    const signal = abort.current?.signal;
    if (!signal) return;
    pauseCamera();
    setPhase("reading");
    if (retry) {
      for (const { batch } of failed.current.splice(0)) submit(batch);
    } else {
      submit(queued.current.splice(0));
    }
    await work.current;
    if (signal.aborted) return;
    if (failed.current.length) {
      setFailedMessage(failed.current[0]!.message);
      setPhase("failed");
    } else {
      openReview();
    }
  }

  if (phase === "failed") {
    return (
      <div className="panel scan-start stack">
        <h2>Some captures need another try</h2>
        <p role="alert">{failedMessage}</p>
        <div className="action-row">
          <button className="btn primary" onClick={() => void finish(true)}>
            Retry failed captures
          </button>
          <button className="btn secondary" onClick={openReview}>
            {recognized ? "Review " + recognized + " items" : "Back to scan options"}
          </button>
        </div>
      </div>
    );
  }

  const status =
    phase === "reading"
      ? "Reading your captures…"
      : cameraError ||
        (captured === maxCaptures
          ? "Session full. Tap Done to review."
          : !enabled
            ? "Camera paused."
            : !ready
              ? "Opening camera…"
              : captured
                ? "Captured · next item"
                : "Line up one item in the guide.");
  return (
    <div className="panel camera-scan">
      {phase === "capture" && (
        <div className="camera-preview">
          <video ref={video} muted playsInline aria-label="Live camera preview" />
          {ready && <div className="camera-guide" aria-hidden="true" />}
          {!ready && <Camera className="camera-placeholder" aria-hidden="true" />}
          {captured > 0 && (
            <span key={captured} className="camera-confirmation" aria-hidden="true">
              <Check size={27} strokeWidth={3} />
            </span>
          )}
        </div>
      )}
      <div className="camera-info">
        <strong>{captured} captured</strong>
        {recognized > 0 && <span>{recognized} ready to review</span>}
      </div>
      <p className="hint" role="status">
        {status}
      </p>
      <div className="action-row">
        <button
          className="btn primary"
          disabled={!captured || phase === "reading"}
          onClick={() => void finish()}
        >
          Done
        </button>
        {phase === "capture" && !enabled && captured < maxCaptures && (
          <button
            className="btn secondary"
            onClick={() => {
              canCapture.current = true;
              setCameraError("");
              setEnabled(true);
            }}
          >
            Restart camera
          </button>
        )}
        <button className="btn secondary" onClick={close}>
          {cameraError && !captured ? "Back to scan options" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
