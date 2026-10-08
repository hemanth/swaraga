import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeAudioToPCM, analyzeRagaAudioPCM } from '../src/dsp.js';
import { buildRagaSystemOnePayload, classifyRagaWithTypeSafe } from '../src/classifier.js';
import {
  RAGA_CATALOG,
  CORE_RAGA_CATALOG,
  SWARA_TABLE,
  THAAT_FAMILIES,
  THAAT_SCALES,
  getRagaById,
  melakartaSwaras,
  melakartaForSwaras,
  classifyJanyaScale
} from '../src/raga-catalog.js';
import { scoreRagaCandidates, SHORTLIST_SIZE } from '../public/raga-matcher.js';
import { createAppServer } from '../server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../public/samples');

test('raga catalog exposes curated ragas, janya lexicon, Wikipedia ragas, 72 melakartas, 12 swarasthanas, and 10 thaats', () => {
  assert.equal(CORE_RAGA_CATALOG.length, 12);
  assert.ok(RAGA_CATALOG.length >= 950);
  assert.ok(RAGA_CATALOG.filter((r) => r.source === 'wikipedia').length >= 750);
  assert.equal(new Set(RAGA_CATALOG.map((r) => r.id)).size, RAGA_CATALOG.length, 'raga ids must be unique');
  assert.equal(RAGA_CATALOG.filter((r) => r.source === 'melakarta').length, 72);
  assert.equal(SWARA_TABLE.length, 12);
  assert.equal(Object.keys(THAAT_FAMILIES).length, 10);
  assert.deepEqual(Object.keys(THAAT_SCALES), Object.keys(THAAT_FAMILIES));
  for (const raga of RAGA_CATALOG) {
    assert.ok(raga.id);
    assert.ok(raga.name);
    assert.ok(Array.isArray(raga.swaras) && raga.swaras.length >= 4); // svarantara ragas (Lavangi) have 4
    assert.ok(raga.vadi);
    assert.ok(raga.samvadi);
    assert.ok(Array.isArray(raga.pakadNgrams) && raga.pakadNgrams.length > 0, `${raga.id} needs n-grams`);
  }
});

test('melakarta generator matches canonical scales and every thaat maps to its melakarta', () => {
  assert.deepEqual(melakartaSwaras(15), ['S', 'r1', 'G3', 'M1', 'P', 'd1', 'N3']); // Mayamalavagowla
  assert.deepEqual(melakartaSwaras(22), ['S', 'R2', 'g2', 'M1', 'P', 'D2', 'n2']); // Kharaharapriya
  assert.deepEqual(melakartaSwaras(65), ['S', 'R2', 'G3', 'M2', 'P', 'D2', 'N3']); // Mechakalyani
  assert.equal(getRagaById('dheerasankarabharanam').melakarta.number, 29);
  for (const { swaras, melakarta } of Object.values(THAAT_SCALES)) {
    assert.equal(melakartaForSwaras(swaras), melakarta);
  }
  assert.equal(getRagaById('bhairav').melakarta.number, 15);
  assert.equal(getRagaById('kambhoji').thaat, 'Khamaj');
});

test('every theoretical linear janya (72 x 483 = 34,776) resolves to its parent melakarta', () => {
  // All 5-, 6-, and 7-note subsets of a melakarta that keep Sa
  const subsets = (scale) => {
    const others = scale.slice(1);
    const out = [];
    for (let mask = 0; mask < 64; mask++) {
      const picked = others.filter((_, i) => mask & (1 << i));
      if (picked.length >= 4) out.push(['S', ...picked]);
    }
    return out;
  };
  let count = 0;
  for (let n = 1; n <= 72; n++) {
    const options = subsets(melakartaSwaras(n));
    assert.equal(options.length, 22);
    for (const aroha of options) {
      for (const avaroha of options) {
        if (aroha.length === 7 && avaroha.length === 7) continue; // the melakarta itself
        const janya = classifyJanyaScale(aroha, avaroha);
        assert.ok(janya.parentMelakartas.includes(n), `janya of ${n} must list it as a parent`);
        count++;
      }
    }
    assert.ok(classifyJanyaScale(melakartaSwaras(n), melakartaSwaras(n)).isMelakarta);
  }
  assert.equal(count, 34776);
});

test('Wikipedia import keeps cross-tradition homonyms distinct and folds spelling variants into aliases', () => {
  assert.notDeepEqual(getRagaById('poorvi').swaras, getRagaById('poorvi_carnatic').swaras);
  assert.ok(getRagaById('durga').aliases.includes('Suddha Saveri'));
  assert.ok(getRagaById('gopriya'), 'named janyas from the Wikipedia list are catalogued');
});

test('acoustic scoring ranks a non-curated raga first when its scale is performed', () => {
  // Shanmukhapriya (Melakarta 56): S R2 g2 M2 P d1 n2
  const swaras = ['S', 'R2', 'g2', 'M2', 'P', 'd1', 'n2'];
  const swaraDistribution = Object.fromEntries(SWARA_TABLE.map((s) => [s.id, swaras.includes(s.id) ? 1 / 7 : 0]));
  const ranked = scoreRagaCandidates({
    swaraDistribution,
    activeSwaras: swaras,
    detectedVadi: 'P',
    detectedSamvadi: 'S',
    hasPhrase: () => false
  });
  // Same-scale ragas (Shanmukhapriya, its asampurna form Chamaram) tie on scale alone
  assert.deepEqual([...getRagaById(ranked[0].ragaId).swaras].sort(), [...swaras].sort());
  assert.ok(ranked.slice(0, 3).some((c) => c.ragaId === 'shanmukhapriya'));
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
  assert.equal(classification.rankedCandidates.length, SHORTLIST_SIZE + 1);
  assert.ok(classification.rankedCandidates.some((c) => c.id === 'out_of_catalog'));
});

test('classifyRagaWithTypeSafe reports out_of_catalog with scale identity for an unlisted scale', async () => {
  const yamanMp3 = path.join(SAMPLES_DIR, 'raga-yaman.mp3');
  const { samples, sampleRate } = await decodeAudioToPCM(yamanMp3, 16000);
  const base = analyzeRagaAudioPCM(samples, sampleRate);

  // Ma-varjya hexatonic subset of Hanumatodi that no catalogued raga uses
  const swaras = ['S', 'r1', 'g2', 'P', 'd1', 'n2'];
  const swaraDistribution = Object.fromEntries(SWARA_TABLE.map((s) => [s.id, swaras.includes(s.id) ? 1 / 6 : 0]));
  const scaleProfile = { ...base.scaleProfile, activeSwaras: swaras, detectedVadi: 'r1', detectedSamvadi: 'n2' };
  const telemetry = {
    ...base,
    swaraDistribution,
    scaleProfile,
    scaleIdentity: undefined,
    acousticCandidateShortlist: scoreRagaCandidates({
      swaraDistribution,
      activeSwaras: swaras,
      detectedVadi: 'r1',
      detectedSamvadi: 'n2',
      hasPhrase: () => false
    }).slice(0, SHORTLIST_SIZE)
  };

  const classification = await classifyRagaWithTypeSafe(telemetry, { dspOnly: true });
  assert.equal(classification.winner.id, 'out_of_catalog');
  assert.equal(classification.routing.gate, 'OUT_OF_CATALOG');
  assert.deepEqual(classification.scaleIdentity.swaras, swaras);
  assert.equal(classification.scaleIdentity.melakarta.number, 8); // Hanumatodi parent
  assert.match(classification.winner.name, /janya of Hanumatodi/);
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
    assert.equal(catalog.ragas.length, RAGA_CATALOG.length);
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
