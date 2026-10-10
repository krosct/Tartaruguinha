import { describe, expect, it } from "vitest";

import {
  canAlert,
  classifyPosture,
  computeMetrics,
  createStabilizer,
  DEFAULT_RULE,
  isAlarming,
  requiredMissing,
  stabilize,
} from "../src/posture";
import { Landmarks, PostureResult } from "../src/types";

function poseWith(noseY: number, confidence = 0.95): { landmarks: Landmarks; confidence: number } {
  return {
    landmarks: {
      nose: { x: 0.5, y: noseY, visibility: 0.95 },
      left_shoulder: { x: 0.35, y: 0.6, visibility: 0.95 },
      right_shoulder: { x: 0.65, y: 0.6, visibility: 0.95 },
    },
    confidence,
  };
}

describe("classifyPosture", () => {
  it("returns good when the head sits well above the shoulders", () => {
    const { landmarks, confidence } = poseWith(0.3);
    expect(classifyPosture(landmarks, confidence)).toBe(PostureResult.Good);
  });

  it("returns hunched when the head drops close to the shoulders", () => {
    const { landmarks, confidence } = poseWith(0.55);
    expect(classifyPosture(landmarks, confidence)).toBe(PostureResult.Hunched);
  });

  it("returns hunched when the head falls below the shoulders", () => {
    const { landmarks, confidence } = poseWith(0.7);
    expect(classifyPosture(landmarks, confidence)).toBe(PostureResult.Hunched);
  });

  it("returns not_visible when the torso landmarks are missing", () => {
    const { confidence } = poseWith(0.3);
    const landmarks: Landmarks = { nose: { x: 0.5, y: 0.3, visibility: 0.95 } };
    expect(classifyPosture(landmarks, confidence)).toBe(PostureResult.NotVisible);
  });

  it("returns not_visible when a required landmark is occluded", () => {
    const { landmarks, confidence } = poseWith(0.3);
    landmarks.right_shoulder.visibility = 0.1;
    expect(classifyPosture(landmarks, confidence)).toBe(PostureResult.NotVisible);
  });

  it("returns unknown below the confidence threshold", () => {
    const { landmarks } = poseWith(0.55);
    expect(classifyPosture(landmarks, 0.4)).toBe(PostureResult.Unknown);
  });

  it("follows a custom neck ratio threshold", () => {
    const { landmarks, confidence } = poseWith(0.45);
    const rule = { ...DEFAULT_RULE, hunchedNeckRatio: 0.6 };
    expect(classifyPosture(landmarks, confidence, rule)).toBe(PostureResult.Hunched);
    expect(classifyPosture(landmarks, confidence, { ...rule, hunchedNeckRatio: 0.4 })).toBe(
      PostureResult.Good,
    );
  });

  it("follows a custom confidence threshold", () => {
    const { landmarks } = poseWith(0.3);
    const rule = { ...DEFAULT_RULE, confidenceThreshold: 0.3 };
    expect(classifyPosture(landmarks, 0.4, rule)).toBe(PostureResult.Good);
  });

  it("follows a custom landmark visibility threshold", () => {
    const { landmarks, confidence } = poseWith(0.3);
    landmarks.right_shoulder.visibility = 0.4;
    expect(classifyPosture(landmarks, confidence)).toBe(PostureResult.NotVisible);
    const rule = { ...DEFAULT_RULE, minLandmarkVisibility: 0.3 };
    expect(classifyPosture(landmarks, confidence, rule)).toBe(PostureResult.Good);
  });
});

describe("isAlarming", () => {
  it("only hunched raises an alert", () => {
    expect(isAlarming(PostureResult.Hunched)).toBe(true);
    expect(isAlarming(PostureResult.Good)).toBe(false);
    expect(isAlarming(PostureResult.NotVisible)).toBe(false);
    expect(isAlarming(PostureResult.Unknown)).toBe(false);
  });
});

describe("canAlert", () => {
  it("allows the first alert", () => {
    expect(canAlert(null, 1000, 60000)).toBe(true);
  });

  it("blocks alerts during the cooldown", () => {
    expect(canAlert(1000, 30000, 60000)).toBe(false);
  });

  it("allows alerts after the cooldown", () => {
    expect(canAlert(1000, 62000, 60000)).toBe(true);
  });
});

describe("computeMetrics", () => {
  it("returns null and lists what is missing when the torso is not visible", () => {
    const landmarks: Landmarks = { nose: { x: 0.5, y: 0.3, visibility: 0.9 } };
    expect(computeMetrics(landmarks)).toBeNull();
    expect(requiredMissing(landmarks)).toEqual(["left_shoulder", "right_shoulder"]);
  });

  it("computes the neck ratio used to explain the decision", () => {
    const { landmarks } = poseWith(0.3);
    const metrics = computeMetrics(landmarks);
    expect(metrics).not.toBeNull();
    expect(metrics?.neckRatio).toBeCloseTo(1, 5);
    expect(metrics?.threshold).toBeGreaterThan(0);
  });
});

describe("stabilize", () => {
  it("holds the shown state until enough readings agree", () => {
    let state = createStabilizer(PostureResult.Good);
    state = stabilize(state, PostureResult.NotVisible, 2);
    expect(state.displayed).toBe(PostureResult.Good);
    state = stabilize(state, PostureResult.NotVisible, 2);
    expect(state.displayed).toBe(PostureResult.NotVisible);
  });

  it("resets the streak when a different reading arrives", () => {
    let state = createStabilizer(PostureResult.Good);
    state = stabilize(state, PostureResult.Hunched, 2);
    state = stabilize(state, PostureResult.Unknown, 2);
    state = stabilize(state, PostureResult.Hunched, 2);
    expect(state.displayed).toBe(PostureResult.Good);
    state = stabilize(state, PostureResult.Hunched, 2);
    expect(state.displayed).toBe(PostureResult.Hunched);
  });

  it("switches immediately when minConsecutive is 1", () => {
    const state = stabilize(createStabilizer(PostureResult.Good), PostureResult.Hunched, 1);
    expect(state.displayed).toBe(PostureResult.Hunched);
  });
});
