---
name: swaraga-classifier
description: Classify Hindustani and Carnatic ragas from vocal audio using 12-swarasthana YIN pitch telemetry and TypeSafe System One (Jev) or OpenJev WASM.
---

# Swaraga Classifier Skill

Use Swaraga (`https://h3manth.com/fun/swaraga/`) to inspect or classify Indian classical ragas from human vocal recordings:

- **WebMCP Tools**: `list_ragas` and `classify_sample_raga` registered on `navigator.modelContext`.
- **962-Raga Catalog**: 12 curated ragas (Yaman, Bhairav, Bhupali, Malkauns, Darbari Kanada, Hamsadhwani, Bhimpalasi, Todi, Bhairavi, Puriya Dhanashri, Desh, Bageshri), ~880 named Hindustani/Carnatic janya ragas, and all 72 Melakartas. Any of the 34,776 theoretical linear janyas is named structurally (jati + parent Melakarta).
- **Open-set**: ragas outside the catalog are reported as `out_of_catalog` with their observed scale, nearest Thaat, and parent Melakarta.
- **Dual Runtime**: TypeSafe Cloud (`POST https://api.typesafe.ai/v1/systemone`) or in-browser OpenJev (`@wllama/wllama` GGUF `Qwen3-0.6B`).
