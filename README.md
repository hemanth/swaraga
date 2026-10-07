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

`buildRagaSystemOnePayload()` compiles acoustic swara telemetry and the 12-raga musicological grammar into a single `POST /v1/systemone` state + questions object.

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

## Related

- [TypeSafe AI](https://typesafe.ai) — System One primitives (`choice`, `score`, `noul`)
- [OpenJev](https://github.com/hemanth/openJev) — Local browser WASM GGUF runtime for Jev primitives

## License

MIT © [Hemanth.HM](https://h3manth.com)
