"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
type Detector = {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
/**
 * Optional camera QR reader built on the browser BarcodeDetector API.
 * Falls back gracefully (with a translated hint) where the API is missing.
 */
export function CameraScan({
  onCode,
  label,
  allowSoftwareDecoder = false,
  className = "children-button secondary",
}: {
  onCode: (code: string) => void;
  label?: string;
  allowSoftwareDecoder?: boolean;
  className?: string;
}) {
  const t = useTranslations("childrenDesk.camera");
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
    void current.play().catch(() => setError(t("startFailed")));
    const ctor = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => Detector;
      }
    ).BarcodeDetector;
    const detector = ctor ? new ctor({ formats: ["qr_code"] }) : null;
    const canvas = !detector && allowSoftwareDecoder ? document.createElement("canvas") : null;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    const decoder = context ? import("jsqr").then((module) => module.default, () => null) : null;
    async function read() {
      if (detector) return (await detector.detect(current))[0]?.rawValue;
      const decode = await decoder;
      if (!decode || !canvas || !context || !active || !current.videoWidth) return;
      const scale = Math.min(1, 640 / current.videoWidth);
      canvas.width = Math.round(current.videoWidth * scale);
      canvas.height = Math.round(current.videoHeight * scale);
      context.drawImage(current, 0, 0, canvas.width, canvas.height);
      return decode(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data;
    }
    const timer = setInterval(() => {
      if ((!detector && !decoder) || working || current.readyState < 2) return;
      working = true;
      void read()
        .then((code) => {
          if (active && code) {
            active = false;
            callback.current(code);
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
      stream.getTracks().forEach((track) => track.stop());
      current.srcObject = null;
    };
  }, [allowSoftwareDecoder, stream, t]);
  async function start() {
    setError("");
    if ((!allowSoftwareDecoder && !("BarcodeDetector" in window)) || !navigator.mediaDevices) {
      setError(t("unavailable"));
      return;
    }
    try {
      const result = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!mounted.current) {
        result.getTracks().forEach((track) => track.stop());
        return;
      }
      setStream(result);
    } catch {
      setError(t("denied"));
    }
  }
  return (
    <div>
      <button
        type="button"
        className={className}
        aria-pressed={!!stream}
        onClick={() => (stream ? setStream(null) : void start())}
      >
        <span aria-hidden="true">{stream ? "■" : "📷"}</span>
        {stream ? t("stop") : label || t("start")}
      </button>
      {stream && (
        <video
          ref={video}
          muted
          playsInline
          className="kids-fade-in mt-3 max-h-72 w-full rounded-2xl bg-black"
          aria-label={t("preview")}
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
