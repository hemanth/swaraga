import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeAudioToPCM, analyzeRagaAudioPCM } from '../src/dsp.js';
import { buildRagaSystemOnePayload, classifyRagaWithTypeSafe } from '../src/classifier.js';
import { RAGA_CATALOG, SWARA_TABLE, THAAT_FAMILIES } from '../src/raga-catalog.js';
import { createAppServer } from '../server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../public/samples');

test('raga catalog exposes 12 canonical ragas, 12 swarasthanas, and 9 thaats', () => {
  assert.equal(RAGA_CATALOG.length, 12);
  assert.equal(SWARA_TABLE.length, 12);
  assert.equal(Object.keys(THAAT_FAMILIES).length, 9);
  for (const raga of RAGA_CATALOG) {
    assert.ok(raga.id);
    assert.ok(raga.name);
    assert.ok(Array.isArray(raga.swaras) && raga.swaras.length >= 5);
    assert.ok(raga.vadi);
    assert.ok(raga.samvadi);
  }
});

test('decodeAudioToPCM and analyzeRagaAudioPCM extract accurate tonic and swaras from MP3', async () => {
  const yamanMp3 = path.join(SAMPLES_DIR, 'raga-yaman.mp3');
  const { samples, sampleRate } = await decodeAudioToPCM(yamanMp3, 16000);
  assert.ok(samples.length > 16000 * 4, 'decoded PCM should contain >4s of audio');

  const telemetry = analyzeRagaAudioPCM(samples, sampleRate);
  assert.equal(telemetry.tonic.noteName, 'C#');
  assert.ok(telemetry.scaleProfile.activeSwaras.includes('G3'), 'Yaman active swaras should include G3');
  assert.ok(telemetry.scaleProfile.activeSwaras.includes('N3'), 'Yaman active swaras should include N3');
  assert.ok(telemetry.scaleProfile.activeSwaras.includes('M2'), 'Yaman active swaras should include M2 (Tivra Ma)');
  assert.ok(telemetry.scaleProfile.omittedVarjyaSwaras.includes('M1'), 'Yaman omitted swaras should include M1 (Shuddha Ma)');
});

test('buildRagaSystemOnePayload constructs structured state and 10 TypeSafe primitives', async () => {
  const bhairavMp3 = path.join(SAMPLES_DIR, 'raga-bhairav.mp3');
  const { samples, sampleRate } = await decodeAudioToPCM(bhairavMp3, 16000);
  const telemetry = analyzeRagaAudioPCM(samples, sampleRate);
  const payload = buildRagaSystemOnePayload(telemetry, { filename: 'raga-bhairav.mp3' });

  assert.ok(payload.state.detected_tonic_sa);
  assert.equal(payload.state.acoustic_candidate_shortlist[0].ragaId, 'bhairav');
  assert.equal(Object.keys(payload.questions).length, 10);
});

test('classifyRagaWithTypeSafe classifies MP3 telemetry via live jev-latest or deterministic fallback', async () => {
  const malkaunsMp3 = path.join(SAMPLES_DIR, 'raga-malkauns.mp3');
  const { samples, sampleRate } = await decodeAudioToPCM(malkaunsMp3, 16000);
  const telemetry = analyzeRagaAudioPCM(samples, sampleRate);

  const classification = await classifyRagaWithTypeSafe(telemetry, { filename: 'raga-malkauns.mp3' });
  assert.equal(classification.winner.id, 'malkauns');
  assert.equal(classification.winner.thaat, 'Bhairavi');
  assert.ok(classification.primitives.nouls.pentatonic_audava_jati.noul > 0.7);
  assert.equal(classification.rankedCandidates.length, 12);
});

test('HTTP server exposes /api/catalog and classifies MP3 on /api/classify-mp3', async () => {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const catRes = await fetch(`${baseUrl}/api/catalog`);
    assert.equal(catRes.status, 200);
    const catalog = await catRes.json();
    assert.equal(catalog.ragas.length, 12);
    assert.equal(catalog.samples.length, 6);

    const mp3Res = await fetch(`${baseUrl}/api/classify-mp3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleUrl: '/samples/raga-hamsadhwani.mp3' })
    });
    assert.equal(mp3Res.status, 200);
    const body = await mp3Res.json();
    assert.equal(body.winner.id, 'hamsadhwani');
    assert.ok(body.primitives.nouls.pentatonic_audava_jati.noul > 0.7);
  } finally {
    server.close();
  }
});
