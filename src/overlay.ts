import { BODY_CONNECTIONS, KEY_JOINTS } from "./pose";
import { PostureResult } from "./types";

const STATE_COLORS: Record<PostureResult, string> = {
  [PostureResult.Good]: "#22c55e",
  [PostureResult.Hunched]: "#ef4444",
  [PostureResult.NotVisible]: "#94a3b8",
  [PostureResult.Unknown]: "#eab308",
};

export function resizeOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function clearOverlay(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawSkeleton(
  canvas: HTMLCanvasElement,
  points: Array<{ x: number; y: number; visibility: number }> | null,
  state: PostureResult,
  minVisibility: number,
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!points || canvas.width === 0) {
    return;
  }

  const color = STATE_COLORS[state];
  const lineWidth = Math.max(2, canvas.width * 0.004);
  const radius = Math.max(3, canvas.width * 0.006);

  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  for (const [a, b] of BODY_CONNECTIONS) {
    const from = points[a];
    const to = points[b];
    if (!from || !to || from.visibility < minVisibility || to.visibility < minVisibility) {
      continue;
    }
    context.beginPath();
    context.moveTo(from.x * canvas.width, from.y * canvas.height);
    context.lineTo(to.x * canvas.width, to.y * canvas.height);
    context.stroke();
  }

  points.forEach((point, index) => {
    if (point.visibility < minVisibility) {
      return;
    }
    const emphasized = KEY_JOINTS.has(index);
    context.beginPath();
    context.arc(
      point.x * canvas.width,
      point.y * canvas.height,
      emphasized ? radius * 1.7 : radius,
      0,
      Math.PI * 2,
    );
    context.fillStyle = emphasized ? color : "rgba(255, 255, 255, 0.9)";
    context.fill();
    context.lineWidth = Math.max(1, lineWidth * 0.5);
    context.strokeStyle = "rgba(2, 6, 23, 0.75)";
    context.stroke();
  });
}
