// Vendors the MediaPipe assets locally so CamHeart runs fully offline.
//   1. Copies the tasks-vision WASM bundle from node_modules -> public/models/wasm
//   2. Downloads the face_landmarker.task model            -> public/models
//
// Run once after `npm install` (and after cloning on a new machine):
//   npm run fetch-models
//
// public/models/ is gitignored, so every machine fetches its own copy.

import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const modelsDir = join(root, 'public', 'models');
const wasmDest = join(modelsDir, 'wasm');
const modelPath = join(modelsDir, 'face_landmarker.task');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const mb = (bytes) => (bytes / 1e6).toFixed(1);

async function main() {
  await mkdir(modelsDir, { recursive: true });

  // 1) Copy the WASM runtime that shipped with the installed npm package.
  if (!existsSync(wasmSrc)) {
    throw new Error(
      `WASM source not found at ${wasmSrc}.\n` +
        `Run "npm install" first so @mediapipe/tasks-vision is present.`,
    );
  }
  await cp(wasmSrc, wasmDest, { recursive: true });
  console.log(`✓ Copied WASM runtime  -> ${wasmDest}`);

  // 2) Download the face landmark model (skip if already cached).
  if (existsSync(modelPath)) {
    const { size } = await stat(modelPath);
    console.log(`✓ Model already present (${mb(size)} MB) -> ${modelPath}`);
    return;
  }
  console.log('… Downloading face_landmarker.task (~3.8 MB) …');
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(modelPath, buf);
  console.log(`✓ Downloaded model (${mb(buf.length)} MB) -> ${modelPath}`);
}

main().catch((err) => {
  console.error('✗ fetch-models failed:', err.message);
  process.exit(1);
});
