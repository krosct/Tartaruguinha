#!/usr/bin/env node
// Copies the MediaPipe vision WASM into public/ and downloads the pose models,
// so the app self-hosts everything and works offline after the first setup.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const WASM_SRC = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const WASM_DEST = path.join(ROOT, "public", "mediapipe", "wasm");
const MODEL_DIR = path.join(ROOT, "public", "models");
const MODELS = ["lite", "full", "heavy"];

function modelUrl(model) {
  return `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${model}/float16/1/pose_landmarker_${model}.task`;
}

function copyWasm() {
  if (!existsSync(WASM_SRC)) {
    console.error("[pose] @mediapipe/tasks-vision is not installed. Run: npm install");
    process.exit(1);
  }
  mkdirSync(WASM_DEST, { recursive: true });
  cpSync(WASM_SRC, WASM_DEST, { recursive: true });
  console.log(`[pose] wasm copied to ${path.relative(ROOT, WASM_DEST)}`);
}

async function downloadModel(model) {
  const dest = path.join(MODEL_DIR, `pose_landmarker_${model}.task`);
  if (existsSync(dest)) {
    console.log(`[pose] ${model} model already present, skipping download`);
    return;
  }
  mkdirSync(MODEL_DIR, { recursive: true });
  console.log(`[pose] downloading ${model} model…`);
  const response = await fetch(modelUrl(model));
  if (!response.ok) {
    console.error(`[pose] ${model} download failed: HTTP ${response.status}`);
    process.exit(1);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(dest, bytes);
  console.log(`[pose] ${model} model saved (${(bytes.length / 1e6).toFixed(1)} MB)`);
}

async function main() {
  copyWasm();
  for (const model of MODELS) {
    await downloadModel(model);
  }
  const sizes = MODELS.map((model) => {
    const file = path.join(MODEL_DIR, `pose_landmarker_${model}.task`);
    return `${model} ${(existsSync(file) ? statSync(file).size / 1e6 : 0).toFixed(1)} MB`;
  });
  console.log(`[pose] ready (${sizes.join(", ")})`);
}

main().catch((error) => {
  console.error(`[pose] ${error.message}`);
  process.exit(1);
});
