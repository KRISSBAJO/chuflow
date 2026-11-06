"use client";
import { useEffect, useRef, useState } from "react";
type Detector = {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
export function CameraScan({
  onCode,
  label = "Scan with camera",
}: {
  onCode: (code: string) => void;
  label?: string;
}) {
  const video = useRef<HTMLVideoElement>(null),
    [stream, setStream] = useState<MediaStream | null>(null),
    [error, setError] = useState("");
  const callback = useRef(onCode);
  useEffect(() => {
    callback.current = onCode;
  }, [onCode]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!stream || !video.current) return;
    let active = true,
      working = false;
    const current = video.current;
    current.srcObject = stream;
    void current.play().catch(() => setError("Unable to start camera."));
    const ctor = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => Detector;
      }
    ).BarcodeDetector;
    const detector = ctor ? new ctor({ formats: ["qr_code"] }) : null;
    const timer = setInterval(() => {
      if (!detector || working || current.readyState < 2) return;
      working = true;
      void detector
        .detect(current)
        .then((rows) => {
          if (active && rows[0]?.rawValue) {
            active = false;
            callback.current(rows[0].rawValue);
            setStream(null);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          working = false;
        });
    }, 300);
    return () => {
      active = false;
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      current.srcObject = null;
    };
  }, [stream]);
  async function start() {
    setError("");
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices) {
      setError(
        "Camera scanning is unavailable in this browser. Use a 2D USB / Bluetooth scanner.",
      );
      return;
    }
    try {
      const result = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!mounted.current) {
        result.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(result);
    } catch {
      setError(
        "Camera permission was not granted. You can still use an external scanner.",
      );
    }
  }
  return (
    <div>
      <button
        type="button"
        className="children-button secondary"
        onClick={() => (stream ? setStream(null) : void start())}
      >
        {stream ? "Stop camera" : label}
      </button>
      {stream && (
        <video
          ref={video}
          muted
          playsInline
          className="mt-3 max-h-72 w-full rounded-xl bg-black"
          aria-label="QR camera preview"
        />
      )}
      {error && (
        <p role="status" className="children-muted mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
