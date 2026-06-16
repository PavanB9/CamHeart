# CamHeart — Remote Vital & Stress Tracker (rPPG HUD)

A cyberpunk webcam overlay that estimates your **heart rate**, **breathing rate**,
and a **stress proxy** in real time — using only a regular camera, entirely in the
browser, with no data leaving your machine.

It works via **rPPG** (remote photoplethysmography): every heartbeat pushes blood
into the capillaries of your face, subtly changing how your skin reflects light.
The change is invisible to the eye but measurable per-pixel by a camera. CamHeart
tracks your face, samples the colour of your forehead and cheeks, and runs that
signal through a DSP pipeline (POS algorithm → bandpass → FFT) to recover your pulse.

> ⚠️ **Not a medical device.** This is a fun signal-processing demo. Readings are
> approximate and easily disturbed by lighting and motion. Don't use it for any
> health decision.

---

## Highlights

- **100% local & client-side.** React + TypeScript + Vite. No backend, no uploads.
- **POS + GREEN rPPG** algorithms, hand-rolled FFT / Butterworth bandpass / HRV.
- **Cyberpunk HUD**: face box, ROI brackets, live pulse graph, BPM / breathing /
  stress gauges, and a calming edge **vignette** that fades in as stress rises.
- **Runs without a camera for development** via a built-in **Synthetic** signal mode
  and an optional **Sample video** mode.

---

## Requirements

- **Node 20.19+ / 22.12+** (Node 24 recommended). That's the only prerequisite.
- A **webcam** to use it for real (any laptop camera works). Not needed for dev.

## Quick start

```bash
npm install
npm run fetch-models   # vendors the MediaPipe model + wasm into public/models (one-time, needs network)
npm run dev            # open the printed http://localhost:5173
```

`public/models/` is gitignored, so run `npm run fetch-models` once per machine
after cloning.

### Live use (camera)

Open the dev URL, allow camera access, and pick **Webcam** mode. For a good lock:
sit still for ~10 seconds, face an even light source (desk lamp / window — not a
dark room lit only by your screen), and keep your face filling a good part of the
frame. BPM stabilises once the signal-quality indicator goes green.

### Developing without a camera (e.g. on a desktop PC)

This project is built so the entire UI and signal pipeline can be developed and
verified with **no camera**:

- **Synthetic mode** injects a clean, known-BPM pulse (with adjustable rate, noise,
  and stress) straight into the pipeline. The HUD, graph, gauges, and vignette all
  react — great for building/verifying everything except the live capture path.
- **Sample video mode** plays a face clip you drop into `public/samples/` and runs
  the real face-tracking + ROI extraction against it.
- **Headless tests** (`npm run test`) feed synthetic signals at known rates through
  the DSP and assert the recovered BPM is correct.

The only thing that genuinely needs hardware is the final live-webcam smoke test.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run the Vitest signal-pipeline tests once |
| `npm run test:watch` | Watch-mode tests |
| `npm run typecheck` | Type-check without emitting |
| `npm run fetch-models` | Vendor the MediaPipe model + wasm locally |

## How it works (pipeline)

```
webcam/video/synthetic ─▶ FaceLandmarker ─▶ forehead+cheek ROI ─▶ mean RGB per frame
        └▶ timestamped ring buffer ─▶ resample 30Hz ─▶ detrend ─▶ POS/GREEN
            ─▶ bandpass 0.7–3 Hz ─▶ FFT ─▶ dominant peak ─▶ BPM (+ SNR confidence)
                                   ├▶ 0.15–0.4 Hz band ─▶ breathing rate
                                   └▶ peak detect ─▶ inter-beat intervals ─▶ HRV ─▶ stress
```

All tunables (window lengths, frequency bands, smoothing) live in
[`src/config.ts`](src/config.ts).

## Tech

Vite 8 · React 19 · TypeScript · `@mediapipe/tasks-vision` (FaceLandmarker) ·
hand-rolled DSP · Vitest.

## License

MIT (personal project).
