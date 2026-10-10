import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

import { PoseDelegate, PoseModel } from "./settings";
import { Landmarks } from "./types";

const WASM_PATH =
  (import.meta.env.VITE_POSE_WASM_PATH as string | undefined) ?? "/mediapipe/wasm";
const MODEL_DIR = (import.meta.env.VITE_POSE_MODEL_DIR as string | undefined) ?? "/models";

export interface DetectorOptions {
  model: PoseModel;
  delegate: PoseDelegate;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
}

export function modelPath(model: PoseModel): string {
  return `${MODEL_DIR}/pose_landmarker_${model}.task`;
}

const KEYPOINTS: Record<number, string> = {
  0: "nose",
  2: "left_eye",
  5: "right_eye",
  7: "left_ear",
  8: "right_ear",
  11: "left_shoulder",
  12: "right_shoulder",
  13: "left_elbow",
  14: "right_elbow",
  15: "left_wrist",
  16: "right_wrist",
  23: "left_hip",
  24: "right_hip",
};

const CONFIDENCE_POINTS = ["nose", "left_shoulder", "right_shoulder"] as const;

// Pairs of MediaPipe pose indices, used to draw the skeleton.
export const BODY_CONNECTIONS: Array<[number, number]> = [
  [0, 7],
  [0, 8],
  [0, 2],
  [0, 5],
  [7, 11],
  [8, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];

export const KEY_JOINTS = new Set([0, 7, 8, 11, 12]);

export interface PoseFrame {
  points: Array<{ x: number; y: number; visibility: number }>;
  landmarks: Landmarks;
  confidence: number;
}

export class PoseDetector {
  private constructor(private readonly landmarker: PoseLandmarker) {}

  static async create(options: DetectorOptions): Promise<PoseDetector> {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    const build = (delegate: PoseDelegate) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelPath(options.model), delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: options.minPoseDetectionConfidence,
        minPosePresenceConfidence: options.minPosePresenceConfidence,
        minTrackingConfidence: options.minTrackingConfidence,
      });
    if (options.delegate === "CPU") {
      return new PoseDetector(await build("CPU"));
    }
    try {
      return new PoseDetector(await build("GPU"));
    } catch {
      return new PoseDetector(await build("CPU"));
    }
  }

  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame | null {
    const result = this.landmarker.detectForVideo(video, timestampMs);
    const person = result.landmarks?.[0];
    if (!person || person.length === 0) {
      return null;
    }

    const landmarks: Landmarks = {};
    for (const [index, name] of Object.entries(KEYPOINTS)) {
      const point = person[Number(index)];
      if (point) {
        landmarks[name] = {
          x: point.x,
          y: point.y,
          visibility: point.visibility ?? 1,
        };
      }
    }

    let visibilitySum = 0;
    let visibilityCount = 0;
    for (const name of CONFIDENCE_POINTS) {
      const point = landmarks[name];
      if (point) {
        visibilitySum += point.visibility;
        visibilityCount += 1;
      }
    }
    const confidence = visibilityCount > 0 ? visibilitySum / visibilityCount : 0;

    const points = person.map((point) => ({
      x: point.x,
      y: point.y,
      visibility: point.visibility ?? 1,
    }));

    return { points, landmarks, confidence };
  }

  close(): void {
    this.landmarker.close();
  }
}
