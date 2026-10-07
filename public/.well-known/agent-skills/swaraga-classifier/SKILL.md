---
name: swaraga-classifier
description: Classify Hindustani and Carnatic ragas from vocal audio using 12-swarasthana YIN pitch telemetry and TypeSafe System One (Jev) or OpenJev WASM.
---

# Swaraga Classifier Skill

Use Swaraga (`https://h3manth.com/fun/swaraga/`) to inspect or classify Indian classical ragas from human vocal recordings:

- **WebMCP Tools**: `list_ragas` and `classify_sample_raga` registered on `navigator.modelContext`.
- **12 Canonical Ragas**: Yaman, Bhairav, Bhupali, Malkauns, Darbari Kanada, Hamsadhwani, Bageshree, Todi, Bhairavi, Desh, Puriya Dhanashri, Bihag.
- **Dual Runtime**: TypeSafe Cloud (`POST https://api.typesafe.ai/v1/systemone`) or in-browser OpenJev (`@wllama/wllama` GGUF `Qwen3-0.6B`).
