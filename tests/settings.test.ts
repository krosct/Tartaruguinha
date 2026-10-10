import { describe, expect, it } from "vitest";

import { envDefaults, FIELDS, loadSettings, sanitize } from "../src/settings";

function field(key: string) {
  const found = FIELDS.find((item) => item.key === key);
  if (!found) {
    throw new Error(key);
  }
  return found;
}

describe("envDefaults", () => {
  it("uses built-in fallbacks when the env is empty", () => {
    const settings = envDefaults({});
    expect(settings.hunchedNeckRatio).toBe(0.6);
    expect(settings.detectIntervalMs).toBe(100);
    expect(settings.poseModel).toBe("lite");
    expect(settings.poseDelegate).toBe("GPU");
    expect(settings.showGuide).toBe(true);
    expect(settings.showSkeleton).toBe(true);
    expect(settings.backgroundMode).toBe("worker");
  });

  it("reads every parameter from its env variable", () => {
    const settings = envDefaults({
      VITE_SHOW_GUIDE: "false",
      VITE_SHOW_SKELETON: "0",
      VITE_HUNCHED_NECK_RATIO: "0.45",
      VITE_MIN_LANDMARK_VISIBILITY: "0.3",
      VITE_CONFIDENCE_THRESHOLD: "0.7",
      VITE_DETECT_INTERVAL_MS: "200",
      VITE_VERDICT_INTERVAL_MS: "1000",
      VITE_STATE_SMOOTHING: "4",
      VITE_ALERT_COOLDOWN_MS: "0",
      VITE_ALERT_SOUND: "off",
      VITE_ALERT_VOLUME: "0.2",
      VITE_NOTIFICATION_COOLDOWN_MS: "300000",
      VITE_BACKGROUND_MODE: "pip",
      VITE_POSE_MODEL: "heavy",
      VITE_POSE_DELEGATE: "CPU",
      VITE_MIN_POSE_DETECTION_CONFIDENCE: "0.4",
      VITE_MIN_POSE_PRESENCE_CONFIDENCE: "0.35",
      VITE_MIN_TRACKING_CONFIDENCE: "0.25",
    });
    expect(settings).toEqual({
      showGuide: false,
      showSkeleton: false,
      hunchedNeckRatio: 0.45,
      minLandmarkVisibility: 0.3,
      confidenceThreshold: 0.7,
      detectIntervalMs: 200,
      verdictIntervalMs: 1000,
      stateSmoothing: 4,
      alertCooldownMs: 0,
      alertSound: "off",
      alertVolume: 0.2,
      notificationCooldownMs: 300000,
      backgroundMode: "pip",
      poseModel: "heavy",
      poseDelegate: "CPU",
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.35,
      minTrackingConfidence: 0.25,
    });
  });

  it("ignores invalid env values", () => {
    const settings = envDefaults({ VITE_HUNCHED_NECK_RATIO: "abc", VITE_POSE_MODEL: "giant" });
    expect(settings.hunchedNeckRatio).toBe(0.6);
    expect(settings.poseModel).toBe("lite");
  });
});

describe("sanitize", () => {
  it("clamps numbers to the field range", () => {
    expect(sanitize(field("confidenceThreshold"), "5")).toBe(1);
    expect(sanitize(field("confidenceThreshold"), "-1")).toBe(0);
  });

  it("rounds integer fields", () => {
    expect(sanitize(field("stateSmoothing"), "2.6")).toBe(3);
  });

  it("parses booleans", () => {
    expect(sanitize(field("showGuide"), "off")).toBe(false);
    expect(sanitize(field("showGuide"), "true")).toBe(true);
    expect(sanitize(field("showGuide"), "maybe")).toBeNull();
  });

  it("rejects empty and unknown values", () => {
    expect(sanitize(field("hunchedNeckRatio"), "")).toBeNull();
    expect(sanitize(field("poseDelegate"), "TPU")).toBeNull();
  });
});

describe("loadSettings", () => {
  it("falls back to the given defaults when nothing is stored", () => {
    const defaults = envDefaults({ VITE_HUNCHED_NECK_RATIO: "0.5" });
    expect(loadSettings(defaults)).toEqual(defaults);
  });
});
