import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SWARA_TABLE, THAAT_FAMILIES, RAGA_CATALOG } from './src/raga-catalog.js';
import { decodeAudioToPCM, analyzeRagaAudioPCM, fetchYoutubeVocalClip } from './src/dsp.js';
import { classifyRagaWithTypeSafe } from './src/classifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_PORT = parseInt(process.env.PORT || '3480', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
};

function buildMarkdownRunbook(host) {
  return `# Raga Classifier — TypeSafe System One (Jev) Audio Musicology Studio

Classify Indian Classical Ragas (Hindustani & Carnatic) from any MP3/WAV recording using deterministic DSP pitch-contour extraction and TypeSafe System One (\`jev-latest\`) multi-primitive judgments (\`Choice\`, \`Score\`, \`Noul\`).

## Architecture
1. **Deterministic DSP in Code (\`src/dsp.js\`)**:
   - Decodes MP3/WAV audio via \`ffmpeg\` to 16 kHz mono Float32 PCM.
   - Runs YIN / normalized autocorrelation fundamental frequency ($f_0$) tracking.
   - Resolves Tonic (\`Sa\` / Shadja) via cadential nyasa anchors, harmonic fifth/fourth drone salience, and scale template invariance.
   - Computes 12-Swara cent distribution (\`S r1 R2 g2 G3 M1 M2 P d1 D2 n2 N3\`), Vadi/Samvadi prominence, Varjya omitted notes, Aroha/Avaroha directional runs, Pakad 3-gram/4-gram motifs, and microtonal Gamaka/Andolan oscillation indices.
2. **TypeSafe System One Judgment Pipeline (\`src/classifier.js\`)**:
   - Evaluates 10 parallel typed questions in one \`POST https://api.typesafe.ai/v1/systemone\` request via \`@typesafe-ai/sdk\`:
     - \`primary_raga\` (\`Choice\` across 12 canonical ragas with structured rubrics)
     - \`thaat_family\` (\`Choice\` parent scale taxonomy for hierarchical beam scoring)
     - \`tradition_idiom\` (\`Choice\`: \`hindustani\`, \`carnatic\`, \`dual_canonical\`)
     - \`prahar_time_window\` (\`Choice\`: Samay Chakra time of day)
     - \`gamaka_ornamentation\` (\`Score\`: 4-level microtonal ornamentation rubric)
     - \`rasa_emotional_gravity\` (\`Score\`: 4-level aesthetic mood rubric)
     - \`pakad_phrase_verified\`, \`vadi_samvadi_aligned\`, \`pentatonic_audava_jati\`, \`sandhiprakash_twilight_character\` (\`Noul\` diagnostic verifiers)

## API Endpoints
- \`GET http://${host}/api/catalog\` — List all 12 canonical ragas, 12 Swarasthanas, Thaat families, and sample MP3 tracks.
- \`POST http://${host}/api/classify-mp3\` — Classify a raw binary MP3/WAV upload (\`Content-Type: audio/mpeg\`) or JSON \`{"sampleUrl": "/samples/raga-yaman.mp3", "tonicNote": "auto"}\`.
- \`POST http://${host}/api/classify-telemetry\` — Classify pre-extracted DSP telemetry state with TypeSafe System One.

## Quick CLI Example
\`\`\`bash
curl -s -X POST http://${host}/api/classify-mp3 \\
  -H "Content-Type: audio/mpeg" \\
  -H "X-Filename: raga-yaman.mp3" \\
  --data-binary @public/samples/raga-yaman.mp3 | jq '.winner, .routing, .primitives.nouls'
\`\`\`
`;
}

function readRawBody(req, maxBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload exceeds 32 MB limit'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createAppServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Filename, X-Tonic, X-Hint');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host || `localhost:${DEFAULT_PORT}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const accept = String(req.headers.accept || '');

    // Markdown Content Negotiation for Agent-Ready / Dual-Mode runtime
    if ((url.pathname === '/' && accept.includes('text/markdown')) || url.pathname === '/llms.txt') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(buildMarkdownRunbook(host));
      return;
    }

    if (url.pathname === '/.well-known/agent-card.json' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify(
          {
            name: 'raga-classifier',
            description: 'Indian Classical Raga Audio Classifier powered by DSP Pitch Telemetry and TypeSafe System One (Jev)',
            model: 'jev-latest',
            sdk: '@typesafe-ai/sdk',
            endpoints: {
              catalog: '/api/catalog',
              classifyMp3: '/api/classify-mp3',
              classifyTelemetry: '/api/classify-telemetry',
              llmsTxt: '/llms.txt'
            }
          },
          null,
          2
        )
      );
      return;
    }

    // 1. GET /api/catalog
    if (url.pathname === '/api/catalog' && req.method === 'GET') {
      const hasApiKey = Boolean(process.env.TYPESAFE_API_KEY || fs.existsSync(path.join(__dirname, '.env')));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          engine: {
            provider: 'TypeSafe AI',
            model: 'jev-latest',
            sdk: '@typesafe-ai/sdk v0.6.0',
            liveJevReady: hasApiKey
          },
          swaras: SWARA_TABLE,
          thaats: THAAT_FAMILIES,
          ragas: RAGA_CATALOG,
          samples: RAGA_CATALOG.filter((r) => Boolean(r.sampleFile)).map((r) => ({
            id: r.id,
            name: r.name,
            carnaticEquivalent: r.carnaticEquivalent,
            thaat: r.thaat,
            prahar: r.prahar,
            vadi: r.vadi,
            samvadi: r.samvadi,
            sampleUrl: r.sampleFile,
            youtubeUrl: r.youtubeUrl || null,
            vocalSource: r.vocalSource || 'Human Vocal Clip'
          }))
        })
      );
      return;
    }

    // 2. POST /api/classify-mp3 (supports raw binary audio/mpeg OR JSON with sampleUrl / youtubeUrl / audioBase64)
    if ((url.pathname === '/api/classify-mp3' || url.pathname === '/api/classify-youtube') && req.method === 'POST') {
      try {
        const contentType = String(req.headers['content-type'] || '').toLowerCase();
        const rawBody = await readRawBody(req);

        let audioSource = null;
        let preDecoded = null;
        let youtubeClip = null;
        let filename = String(req.headers['x-filename'] || 'uploaded-track.mp3');
        let tonicNote = String(req.headers['x-tonic'] || url.searchParams.get('tonic') || 'auto');
        let userHint = String(req.headers['x-hint'] || '');
        let apiKey = String(req.headers['x-typesafe-api-key'] || '').trim();
        let dspOnly = String(req.headers['x-dsp-only'] || '') === 'true';

        if (contentType.includes('application/json')) {
          const parsed = JSON.parse(rawBody.toString('utf8') || '{}');
          tonicNote = parsed.tonicNote || tonicNote;
          filename = parsed.filename || filename;
          userHint = parsed.userHint || userHint;
          if (parsed.apiKey) apiKey = String(parsed.apiKey).trim();
          if (typeof parsed.dspOnly === 'boolean') dspOnly = parsed.dspOnly;

          if (parsed.youtubeUrl) {
            const samplesDir = path.join(PUBLIC_DIR, 'samples');
            const ytRes = await fetchYoutubeVocalClip(parsed.youtubeUrl, samplesDir, 16000);
            preDecoded = { samples: ytRes.samples, sampleRate: ytRes.sampleRate };
            filename = ytRes.title;
            youtubeClip = {
              videoId: ytRes.videoId,
              title: ytRes.title,
              youtubeUrl: ytRes.youtubeUrl,
              windowStartSec: ytRes.windowStartSec,
              windowEndSec: ytRes.windowEndSec,
              publicAudioUrl: ytRes.publicAudioUrl
            };
          } else if (parsed.sampleUrl) {
            const safeRel = String(parsed.sampleUrl).replace(/^\/+/, '');
            const candidatePath = path.join(PUBLIC_DIR, safeRel);
            if (!candidatePath.startsWith(PUBLIC_DIR) || !fs.existsSync(candidatePath)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Sample file not found: ${parsed.sampleUrl}` }));
              return;
            }
            audioSource = candidatePath;
            filename = path.basename(candidatePath);
          } else if (parsed.audioBase64) {
            const cleanB64 = String(parsed.audioBase64).replace(/^data:audio\/[^;]+;base64,/, '');
            audioSource = Buffer.from(cleanB64, 'base64');
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Provide youtubeUrl, sampleUrl, audioBase64, or raw binary MP3 body' }));
            return;
          }
        } else {
          if (!rawBody || rawBody.length < 64) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Empty or invalid audio binary payload' }));
            return;
          }
          audioSource = rawBody;
        }

        const { samples, sampleRate } = preDecoded || (await decodeAudioToPCM(audioSource, 16000));
        const dspTelemetry = analyzeRagaAudioPCM(samples, sampleRate, { tonicNote });
        const result = await classifyRagaWithTypeSafe(dspTelemetry, { filename, userHint, apiKey, dspOnly });
        if (youtubeClip) {
          result.youtubeClip = youtubeClip;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message || 'Classification failed' }));
      }
      return;
    }

    // 3. POST /api/classify-telemetry
    if (url.pathname === '/api/classify-telemetry' && req.method === 'POST') {
      try {
        const rawBody = await readRawBody(req);
        const parsed = JSON.parse(rawBody.toString('utf8') || '{}');
        if (!parsed.dspTelemetry) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing dspTelemetry object in request body' }));
          return;
        }
        const result = await classifyRagaWithTypeSafe(parsed.dspTelemetry, parsed.metadata || {});
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Static file serving
    let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    try {
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);

      // Support HTTP Range requests for smooth MP3 audio scrubbing
      const range = req.headers.range;
      if (range && (ext === '.mp3' || ext === '.wav')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        stream.pipe(res);
        return;
      }

      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes'
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createAppServer();
  server.listen(DEFAULT_PORT, () => {
    console.log(`\n  SwaraJev — TypeSafe Raga Classifier running at http://localhost:${DEFAULT_PORT}\n`);
  });
}
