export class CameraError extends Error {
  constructor(
    public readonly reason: "unsupported" | "denied" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "CameraError";
  }
}

export async function startCamera(
  video: HTMLVideoElement,
  facingMode = "user",
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("unsupported", "Este navegador não expõe a câmera.");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    return stream;
  } catch (error) {
    const denied = error instanceof DOMException && error.name === "NotAllowedError";
    throw new CameraError(
      denied ? "denied" : "failed",
      denied
        ? "Permissão da câmera negada."
        : "Não foi possível iniciar a câmera.",
    );
  }
}

export function stopCamera(video: HTMLVideoElement, stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}
