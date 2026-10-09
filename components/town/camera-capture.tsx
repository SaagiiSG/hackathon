"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Camera, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

type Facing = "user" | "environment";

export function CameraCapture({
  disabled,
  onCapture,
  onCancel,
  onError,
}: {
  disabled?: boolean;
  onCapture: (file: File) => void;
  onCancel: () => void;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const fail = useEffectEvent(onError);

  useEffect(() => {
    const video = videoRef.current;
    let stream: MediaStream | null = null;
    let stale = false;

    const stop = (s: MediaStream | null) => s?.getTracks().forEach((track) => track.stop());

    if (!navigator.mediaDevices?.getUserMedia) {
      fail();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((s) => {
        if (stale) return stop(s);
        stream = s;
        if (video) video.srcObject = s;
        setReady(true);
      })
      .catch(() => {
        if (!stale) fail();
      });

    return () => {
      stale = true;
      stop(stream);
      if (video) video.srcObject = null;
    };
  }, [facing]);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return onError();
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  const flip = () => {
    setReady(false);
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  };

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-label="Camera preview"
        className="aspect-[4/3] w-full rounded-lg bg-surface object-cover"
      />
      <div className="flex gap-2">
        <Button type="button" className="h-10 flex-1" onClick={capture} disabled={disabled || !ready}>
          <Camera />
          Capture
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Switch camera"
          onClick={flip}
          disabled={disabled}
        >
          <SwitchCamera />
        </Button>
      </div>
    </div>
  );
}
