import { Landmarks, PostureResult } from "./types";

export interface RuleParams {
  hunchedNeckRatio: number;
  minLandmarkVisibility: number;
  confidenceThreshold: number;
}

export const DEFAULT_RULE: RuleParams = {
  hunchedNeckRatio: 0.6,
  minLandmarkVisibility: 0.5,
  confidenceThreshold: 0.6,
};

const REQUIRED_LANDMARKS = ["nose", "left_shoulder", "right_shoulder"] as const;

type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function requiredMissing(
  landmarks: Landmarks,
  minVisibility: number = DEFAULT_RULE.minLandmarkVisibility,
): string[] {
  return REQUIRED_LANDMARKS.filter(
    (key) => !landmarks[key] || landmarks[key].visibility < minVisibility,
  );
}

export interface PostureMetrics {
  shoulderWidth: number;
  neckHeight: number;
  neckRatio: number;
  threshold: number;
}

export function computeMetrics(
  landmarks: Landmarks,
  rule: RuleParams = DEFAULT_RULE,
): PostureMetrics | null {
  if (requiredMissing(landmarks, rule.minLandmarkVisibility).length > 0) {
    return null;
  }
  const nose = landmarks["nose"];
  const left = landmarks["left_shoulder"];
  const right = landmarks["right_shoulder"];
  const shoulderWidth = distance(left, right);
  if (shoulderWidth <= 0) {
    return null;
  }
  const shoulderMid = midpoint(left, right);
  const neckHeight = shoulderMid.y - nose.y;
  return {
    shoulderWidth,
    neckHeight,
    neckRatio: neckHeight / shoulderWidth,
    threshold: rule.hunchedNeckRatio,
  };
}

/**
 * Deterministic geometric rule.
 * Short neck relative to shoulder width means the person is hunched forward.
 */
export function classifyPosture(
  landmarks: Landmarks,
  confidence: number,
  rule: RuleParams = DEFAULT_RULE,
): PostureResult {
  if (confidence < rule.confidenceThreshold) {
    return PostureResult.Unknown;
  }
  const metrics = computeMetrics(landmarks, rule);
  if (!metrics) {
    return PostureResult.NotVisible;
  }
  if (metrics.neckHeight <= 0) {
    return PostureResult.Hunched;
  }
  return metrics.neckRatio >= rule.hunchedNeckRatio ? PostureResult.Good : PostureResult.Hunched;
}

export function isAlarming(result: PostureResult): boolean {
  return result === PostureResult.Hunched;
}

export function canAlert(
  lastAlertAt: number | null,
  now: number,
  cooldownMs: number,
): boolean {
  if (lastAlertAt === null) {
    return true;
  }
  return now - lastAlertAt >= cooldownMs;
}

export interface StabilizerState {
  displayed: PostureResult;
  pending: PostureResult | null;
  pendingStreak: number;
}

export function createStabilizer(initial: PostureResult): StabilizerState {
  return { displayed: initial, pending: null, pendingStreak: 0 };
}

/**
 * Require `minConsecutive` identical readings before changing the shown state,
 * so a single noisy frame (a blink, a shadow) does not flip the message.
 */
export function stabilize(
  state: StabilizerState,
  candidate: PostureResult,
  minConsecutive: number,
): StabilizerState {
  if (candidate === state.displayed) {
    return { displayed: state.displayed, pending: null, pendingStreak: 0 };
  }
  const pendingStreak = state.pending === candidate ? state.pendingStreak + 1 : 1;
  if (pendingStreak >= Math.max(1, minConsecutive)) {
    return { displayed: candidate, pending: null, pendingStreak: 0 };
  }
  return { displayed: state.displayed, pending: candidate, pendingStreak };
}
