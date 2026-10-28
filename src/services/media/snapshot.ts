const MAX_WIDTH = 320;
/** The API accepts snapshot data URLs up to 96 000 characters. */
const MAX_DATA_URL_LENGTH = 96_000;

/**
 * One JPEG frame (at most 320 px wide) from a live video stream, as a data URL, or null when the
 * stream has no video frame to give. Lowers JPEG quality until it fits the upload limit.
 */
export async function captureStreamFrame(stream: MediaStream | null): Promise<string | null> {
  if (!stream || stream.getVideoTracks().every((track) => track.readyState !== "live")) return null;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    if (video.videoWidth === 0) {
      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        window.setTimeout(resolve, 1000);
      });
    }
    if (video.videoWidth === 0) return null;

    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.75, 0.6, 0.45, 0.3]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
    }
    return null;
  } catch {
    return null;
  } finally {
    video.pause();
    video.srcObject = null;
  }
}
