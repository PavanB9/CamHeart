import { config } from '../config';

/** Open the webcam with rPPG-friendly constraints and attach it to a video element. */
export async function startWebcam(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not available in this browser/context.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: config.videoWidth },
      height: { ideal: config.videoHeight },
      frameRate: { ideal: config.targetFps },
      facingMode: 'user',
    },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Human-readable message for the common getUserMedia failure modes. */
export function cameraErrorMessage(e: unknown): string {
  const err = e as { name?: string; message?: string };
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission denied. Allow access and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera found on this device.';
    case 'NotReadableError':
      return 'Camera is in use by another application.';
    default:
      return err?.message || 'Could not start the camera.';
  }
}
