"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  stream: MediaStream | null;
  /** Accessible name, e.g. "Your camera" or "Stranger". */
  label: string;
  /** Mirror the local preview, as people expect from a mirror. */
  mirrored?: boolean;
  /** Always mute your own preview to avoid echo. */
  muted?: boolean;
  /** Hide the picture (camera off) while keeping audio playing. */
  hidden?: boolean;
  children?: ReactNode;
  className?: string;
}

export function VideoTile({
  stream,
  label,
  mirrored,
  muted,
  hidden,
  children,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);

  return (
    <figure
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-border dark:bg-zinc-900",
        className,
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "size-full object-cover",
          mirrored && "-scale-x-100",
          (hidden || !stream) && "invisible",
        )}
      />
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-zinc-200">
          {children}
        </div>
      ) : null}
      <figcaption className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {label}
      </figcaption>
    </figure>
  );
}
