"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Facing = "user" | "environment";

// Full-screen viewfinder, stacked over the Add memory dialog. Controls sit along
// the bottom in portrait and down the right side in landscape, like the system
// camera. The selfie camera is mirrored in the preview and in the saved photo,
// so the picture matches what people saw (the iPhone default).
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
  // State, not a ref: the dialog portal mounts the <video> a render later, and the
  // stream must attach once it exists.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const fail = useEffectEvent(onError);
  const mirrored = facing === "user";

  useEffect(() => {
    if (!video) return;
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
        video.srcObject = s;
        setReady(true);
      })
      .catch(() => {
        if (!stale) fail();
      });

    return () => {
      stale = true;
      stop(stream);
      video.srcObject = null;
    };
  }, [facing, video]);

  const capture = () => {
    if (!video?.videoWidth) return;
    // videoWidth/videoHeight follow the device's orientation, so a landscape hold
    // gives a landscape photo.
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onError();
    if (mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black p-0 ring-0 sm:max-w-none landscape:flex-row"
      >
        <DialogTitle className="sr-only">Take a photo</DialogTitle>
        <div className="relative min-h-0 flex-1">
          <video
            ref={setVideo}
            muted
            playsInline
            autoPlay
            aria-label="Camera preview"
            className={`size-full object-contain ${mirrored ? "-scale-x-100" : ""}`}
          />
        </div>

        <div className="flex items-center justify-around px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] landscape:flex-col-reverse landscape:px-4 landscape:py-6 landscape:pr-[max(1.5rem,env(safe-area-inset-right))]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12 rounded-full text-white hover:bg-white/15 hover:text-white"
            aria-label="Cancel"
            onClick={onCancel}
            disabled={disabled}
          >
            <X className="size-6" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={capture}
            disabled={disabled || !ready}
            aria-label="Capture photo"
            className="grid size-[72px] place-items-center rounded-full border-4 border-white p-0 transition-transform hover:bg-transparent active:scale-95 disabled:opacity-40"
          >
            <span className="size-[56px] rounded-full bg-white" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12 rounded-full text-white hover:bg-white/15 hover:text-white"
            aria-label="Switch camera"
            onClick={flip}
            disabled={disabled}
          >
            <SwitchCamera className="size-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
