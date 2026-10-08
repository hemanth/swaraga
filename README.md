# swaraga

Classify Hindustani and Carnatic ragas from human vocal audio using 12-swarasthana pitch telemetry and TypeSafe System One (`jev-latest`) or local OpenJev WASM.

```bash
npm install
```

## Quick start

```js
import { decodeAudioToPCM, analyzeRagaAudioPCM } from './src/dsp.js';
import { classifyRagaWithTypeSafe } from './src/classifier.js';

const { samples, sampleRate } = await decodeAudioToPCM('./public/samples/raga-yaman.mp3', 16000);
const telemetry = analyzeRagaAudioPCM(samples, sampleRate, { tonicOverride: 'C#' });
const result = await classifyRagaWithTypeSafe(telemetry, { filename: 'raga-yaman.mp3' });

console.log(result.winner.name);        // "Raga Yaman"
console.log(result.winner.probability); // 1
console.log(result.routing.gate);       // "AUTO_VERIFIED"
```

`decodeAudioToPCM()` decodes MP3/WAV to 16 kHz mono PCM. `analyzeRagaAudioPCM()` locks tonic `Sa`, tracks YIN F0 trajectories, and extracts 12-swara histograms and Pakad motifs. `classifyRagaWithTypeSafe()` dispatches 10 batched System One primitives (`choice`, `score`, `noul`) and computes the hierarchical beam score `√(P(Thaat) × P(Raga))`. That's the whole API.

## Inspect the System One batch payload

```js
import { buildRagaSystemOnePayload } from './src/classifier.js';

const { state, questions } = buildRagaSystemOnePayload(telemetry, {
  filename: 'raga-bhairav.mp3'
});

console.log(Object.keys(questions));
// ['primary_raga', 'thaat_family', 'tradition_idiom', 'prahar_time_window', ...]
```

`buildRagaSystemOnePayload()` compiles acoustic swara telemetry and the grammar of the top-12 acoustic candidates (plus an `out_of_catalog` option) into a single `POST /v1/systemone` state + questions object.

## Raga coverage

```js
import { RAGA_CATALOG } from './src/raga-catalog.js';

RAGA_CATALOG.length; // 962
```

The catalog has 12 hand-curated ragas with Pakad grammar, ~100 hand-written Hindustani and Carnatic janya ragas (`public/raga-lexicon.js`), ~790 more named ragas imported from Wikipedia (`public/raga-wiki-lexicon.js`), and all 72 Melakartas generated from the chakra formula. Every raga is scored acoustically, and the top 12 are sent to System One or OpenJev. If nothing in the catalog fits, `winner.id` is `out_of_catalog` and `routing.gate` is `OUT_OF_CATALOG`. `scaleIdentity` then reports the observed swaras, the nearest Thaat, and the parent Melakarta. Every 7-note scale with one Ma and Pa is a Melakarta, so those are always named. Any other linear scale is named by structure (e.g. "Audava-Sampurna janya of Hanumatodi"); `classifyJanyaScale()` resolves all 72 × 483 = 34,776 theoretical linear janyas to their parent Melakartas.

Named ragas that share an identical scale (e.g. Madhyamavati and Megh) can't be told apart from pitch data alone. The DSP shortlists them; Jev separates them from phrasing.

To add a raga, append a row to `JANYA_ROWS` in `public/raga-lexicon.js`. To refresh the Wikipedia import:

```bash
mkdir /tmp/raga-wiki && python3 -I scripts/import-wikipedia-ragas.py /tmp/raga-wiki public/raga-wiki-lexicon.js
```

Only `{{svaraC}}`/`{{svaraH}}` template scales are imported; plain-text notation is skipped because pages disagree on what `m` means.

## Attribution

Raga scales in `public/raga-wiki-lexicon.js` come from Wikipedia ([List of Janya ragas](https://en.wikipedia.org/wiki/List_of_Janya_ragas) and individual raga articles), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## BYOK and offline fallback

```js
// Pass a browser or caller-supplied TypeSafe key
const live = await classifyRagaWithTypeSafe(telemetry, {
  apiKey: 'ts_live_...'
});

// Or run deterministic acoustic + softmax routing without an API key
const local = await classifyRagaWithTypeSafe(telemetry, {
  dspOnly: true
});
```

Pass `apiKey` to evaluate against `jev-latest` in the cloud, or `dspOnly: true` when running alongside the in-browser OpenJev GGUF engine (`@wllama/wllama`).

## HTTP API

```bash
# Classify a raw MP3 or WAV recording
curl -X POST http://localhost:3480/api/classify-mp3 \
  -H "Content-Type: audio/mpeg" \
  -H "X-Filename: raga-bhairav.mp3" \
  -H "X-Tonic: C#" \
  --data-binary @public/samples/raga-bhairav.mp3

# Classify a YouTube vocal performance
curl -X POST http://localhost:3480/api/classify-youtube \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=MW652897nBs", "tonicNote": "C#"}'
```

- `X-Tonic` / `tonicNote` — override automatic Shadja (`Sa`) lock (`C`, `C#`, `D`, ..., `B`, or `auto`)
- `X-TypeSafe-Key` / `apiKey` — pass a client-side `ts_...` key per request
- `X-Engine-Mode: dsp-only` — return DSP telemetry immediately for browser-side OpenJev WASM inference

## Demo

```bash
npm start
```

Starts the Swaraga web studio on `http://localhost:3480` with progressive scroll-animated cards, live microphone capture, BYOK / OpenJev switching, and interactive F0 cent-trajectory scrubbing.

## Benchmarks (N = 46 clips, Apple M5 arm64)

Reproduce via `npm run bench` (`bench/run-eval.mjs` against `onnx-community/embeddinggemma-2-ONNX` 570M Text+Audio `q4`):

| Engine | Top-1 (14) | Top-3 (14) | Top-1 (962) | Canonical Sa | Shifted Sa (+600¢) | Sibling Pairs | Latency (p50) |
|---|---|---|---|---|---|---|---|
| Swaraga Full (YIN F0 + TypeSafe System One) | 93.5% | 93.5% | 84.8% | 100.0% | 88.5% | 93.3% | 367.5 ms |
| Swaraga Stage 1 (YIN F0 + 962 Lakshanam) | 93.5% | 93.5% | 82.6% | 100.0% | 88.5% | 93.3% | 182.8 ms |
| EmbeddingGemma 2 Audio k-NN (300M, Raw) | 58.7% | 69.6% | 58.7% | 75.0% | 46.2% | 53.3% | 2087.1 ms |
| EmbeddingGemma 2 Hybrid (YIN -> Text 768d) | 47.8% | 73.9% | 17.4% | 50.0% | 46.2% | 40.0% | 624.0 ms |
| EmbeddingGemma 2 Hybrid (YIN -> MRL 512d) | 47.8% | 73.9% | 8.7% | 50.0% | 46.2% | 40.0% | 627.9 ms |
| EmbeddingGemma 2 Hybrid (YIN -> MRL 256d) | 37.0% | 67.4% | 13.0% | 40.0% | 34.6% | 53.3% | 624.2 ms |
| EmbeddingGemma 2 Zero-Shot (Audio -> Text) | 6.5% | 15.2% | 0.0% | 10.0% | 3.8% | 13.3% | 2087.1 ms |

Interactive playground & evaluation tab: [h3manth.com/fun/swaraga/?tab=eval](https://h3manth.com/fun/swaraga/?tab=eval)

## Related

- [TypeSafe AI](https://typesafe.ai) — System One primitives (`choice`, `score`, `noul`)
- [OpenJev](https://github.com/hemanth/openJev) — Local browser WASM GGUF runtime for Jev primitives

## License

MIT © [Hemanth.HM](https://h3manth.com)
