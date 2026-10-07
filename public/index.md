---
title: "Swaraga — Classical Indian Raga Classifier"
description: "Classify Hindustani and Carnatic ragas from human vocal MP3/WAV recordings or live microphone singing using 12-swarasthana YIN pitch telemetry, TypeSafe System One (jev-latest), and OpenJev Local Browser WASM."
url: "https://h3manth.com/fun/swaraga/"
repository: "https://github.com/hemanth/swaraga"
---

# Swaraga — Classical Indian Raga Classifier

Drop an MP3/WAV recording or sing into the microphone to classify Hindustani and Carnatic ragas using 16 kHz YIN fundamental frequency (`F0`) pitch telemetry, 12-swarasthana cent histograms, and 10 batched TypeSafe System One (`jev-latest`) or local OpenJev WASM (`Qwen3-0.6B`) judgments.

## Pipeline Architecture

1. **01 Acoustic DSP Tier**: Decodes vocal audio at `16 kHz` via Web Audio API, locks the vocalist's tonic (`Sa`), tracks microtonal `F0` cent trajectories (`0–1200¢`), and extracts 12-Swara dwell shares, Arohana/Avarohana runs, and Pakad n-gram motifs.
2. **02 System One Orchestrator**: Compiles acoustic telemetry and the 12-raga musicological grammar into 10 parallel primitives (`choice`, `score`, `noul`).
3. **03 Inference & Primitives**: Evaluates via TypeSafe Cloud (`POST /v1/systemone`, `jev-latest`) when a key is provided, or automatically loads and runs OpenJev Local (`@wllama/wllama` GGUF `Qwen3-0.6B`) in the browser with 1-token direct option logit readouts.

## Canonical 12-Raga Catalog

- **Raga Yaman** (Kalyan Thaat · Carnatic: Mechakalyani) — `S R2 G3 M2 P D2 N3` · Vadi `G3` / Samvadi `N3`
- **Raga Bhairav** (Bhairav Thaat · Carnatic: Mayamalavagowla) — `S r1 G3 M1 P d1 N3` · Vadi `d1` / Samvadi `r1`
- **Raga Bhupali** (Kalyan Thaat · Carnatic: Mohanam) — `S R2 G3 P D2` · Vadi `G3` / Samvadi `D2`
- **Raga Malkauns** (Bhairavi Thaat · Carnatic: Hindolam) — `S g2 M1 d1 n2` · Vadi `M1` / Samvadi `S`
- **Raga Darbari Kanada** (Asavari Thaat · Carnatic: Natabhairavi Janya) — `S R2 g2 M1 P d1 n2` · Vadi `R2` / Samvadi `P`
- **Raga Hamsadhwani** (Bilawal Thaat · Carnatic: Hamsadhwani) — `S R2 G3 P N3` · Vadi `R2` / Samvadi `P`
- **Raga Bageshree** (Kafi Thaat · Carnatic: Sriranjani) — `S R2 g2 M1 P D2 n2` · Vadi `M1` / Samvadi `S`
- **Raga Todi** (Todi Thaat · Carnatic: Shubhapantuvarali) — `S r1 g2 M2 P d1 N3` · Vadi `d1` / Samvadi `g2`
- **Raga Bhairavi** (Bhairavi Thaat · Carnatic: Hanumatodi) — `S r1 g2 M1 P d1 n2` · Vadi `M1` / Samvadi `S`
- **Raga Desh** (Khamaj Thaat · Carnatic: Kedaram / Harikambhoji) — `S R2 G3 M1 P D2 n2 N3` · Vadi `R2` / Samvadi `P`
- **Raga Puriya Dhanashri** (Poorvi Thaat · Carnatic: Pantuvarali) — `S r1 G3 M2 P d1 N3` · Vadi `P` / Samvadi `r1`
- **Raga Bihag** (Bilawal Thaat · Carnatic: Behag) — `S R2 G3 M1 M2 P D2 N3` · Vadi `G3` / Samvadi `N3`
