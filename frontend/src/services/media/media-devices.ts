export type MediaErrorKind = "denied" | "not-found" | "in-use" | "unsupported" | "unknown";

export interface DeviceSelection {
  readonly cameraId: string | null;
  readonly microphoneId: string | null;
}

export interface AvailableDevices {
  readonly cameras: readonly MediaDeviceInfo[];
  readonly microphones: readonly MediaDeviceInfo[];
}

/** Maps getUserMedia failures to the handful of situations the UI explains differently. */
export function classifyMediaError(error: unknown): MediaErrorKind {
  if (!(error instanceof DOMException)) return "unknown";
  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "not-found";
    case "NotReadableError":
    case "AbortError":
      return "in-use";
    case "NotSupportedError":
      return "unsupported";
    default:
      return "unknown";
  }
}

const deviceConstraint = (deviceId: string | null) =>
  deviceId ? { deviceId: { ideal: deviceId } } : {};

/**
 * Opens camera and microphone. Uses `ideal` device ids, so a remembered device that was unplugged
 * falls back to the default instead of failing. Echo cancellation and noise suppression stay on.
 */
export async function openLocalMedia(selection: DeviceSelection): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Media devices are not available.", "NotSupportedError");
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      ...deviceConstraint(selection.cameraId),
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: {
      ...deviceConstraint(selection.microphoneId),
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

/** Device labels are only exposed after the user granted access at least once. */
export async function listDevices(): Promise<AvailableDevices> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((device) => device.kind === "videoinput" && device.deviceId),
    microphones: devices.filter((device) => device.kind === "audioinput" && device.deviceId),
  };
}

export function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

export const isMediaSupported = (): boolean =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
