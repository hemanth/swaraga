/**
 * EmbeddingGemma 2 Raga Identification Engine (`onnx-community/embeddinggemma-2-ONNX`)
 *
 * Implements 4 musicological & multimodal retrieval pathways using Google DeepMind's
 * EmbeddingGemma 2 (Gemma 4 architecture, 570M Text + Audio selective build, 768-d MRL space):
 *
 *  1. Zero-Shot Cross-Modal Audio -> Text (`audio_encoder_q4` -> 962 Raga Text Catalog)
 *  2. Raw Audio -> Audio Prototype k-NN (`audio_encoder_q4` without tonic shift correction)
 *  3. Tonic-Normalized Audio -> Audio Prototype k-NN (YIN Sa-Lock pitch-shift + `audio_encoder_q4`)
 *  4. Hybrid YIN DSP Telemetry -> Text Bi-Encoder (`model_q4` at Matryoshka 768d / 512d / 256d / 128d)
 */

import { RAGA_CATALOG, SWARA_TABLE } from './raga-catalog.js';
import { identifyScale } from '../public/raga-matcher.js';

const MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX';
const CANONICAL_SA_HZ = 146.83; // D3 concert reference tonic

const SWARA_NAME_MAP = Object.fromEntries(SWARA_TABLE.map((s) => [s.id, `${s.hindustani} [${s.id}]`]));

let cachedPipeline = null;
let cachedCatalogEmbeddings768 = null;

function describeSwaraList(swaras = []) {
  return swaras.map((s) => SWARA_NAME_MAP[s] || s).join(', ');
}

function describeOmissions(varjya = []) {
  if (!varjya || varjya.length === 0) return 'Sampurna (no omitted swaras)';
  const omitsRe = varjya.includes('r1') && varjya.includes('R2');
  const omitsGa = varjya.includes('g2') && varjya.includes('G3');
  const omitsMa = varjya.includes('M1') && varjya.includes('M2');
  const omitsPa = varjya.includes('P');
  const omitsDha = varjya.includes('d1') && varjya.includes('D2');
  const omitsNi = varjya.includes('n2') && varjya.includes('N3');
  const notes = [];
  if (omitsRe) notes.push('strictly omits Rishabh (r1 R2)');
  if (omitsGa) notes.push('strictly omits Gandhar (g2 G3)');
  if (omitsMa) notes.push('strictly omits Madhyam (M1 M2)');
  if (omitsPa) notes.push('strictly omits Pancham (P)');
  if (omitsDha) notes.push('strictly omits Dhaivat (d1 D2)');
  if (omitsNi) notes.push('strictly omits Nishad (n2 N3)');
  return `${notes.join(', ')}; excluded chromatic swaras: ${varjya.join(' ')}`;
}

/**
 * Format a raga catalog entry as an asymmetric EmbeddingGemma 2 document string.
 * Follows official task prefix convention: `title: {title} | text: {content}`
 */
export function formatRagaDocumentText(raga) {
  const swaras = raga.swaras || [];
  const varjya = raga.varjya || [];
  const hasM2 = swaras.includes('M2') ? 'Teevra Madhyam (M2)' : 'Shuddha Madhyam (M1)';
  const komals = swaras.filter((s) => ['r1', 'g2', 'd1', 'n2'].includes(s));
  const komalDesc = komals.length ? `Komal swaras: ${describeSwaraList(komals)}` : 'All Shuddha swaras (no komal notes)';

  return (
    `title: ${raga.name} (${raga.carnaticEquivalent || raga.tradition}) | text: ` +
    `${raga.thaat} thaat, ${raga.jati} scale (${swaras.length} notes: ${swaras.join(' ')}). ` +
    `${hasM2}. ${komalDesc}. ` +
    `Active swaras: ${describeSwaraList(swaras)}. ` +
    `Omissions: ${describeOmissions(varjya)}. ` +
    `Vadi principal swara: ${SWARA_NAME_MAP[raga.vadi] || raga.vadi || 'S'}, ` +
    `Samvadi consonant swara: ${SWARA_NAME_MAP[raga.samvadi] || raga.samvadi || 'P'}. ` +
    `Aroha ascending: ${raga.aroha}. Avaroha descending: ${raga.avaroha}. ` +
    `Pakad catch phrases: ${raga.pakad || swaras.join(' ')}`
  );
}

/**
 * Format YIN DSP pitch telemetry into an asymmetric EmbeddingGemma 2 search query string.
 * Follows official task prefix convention: `task: search result | query: {query}`
 */
export function formatDspTelemetryQuery(dspTelemetry) {
  const sp = dspTelemetry.scaleProfile || {};
  const dp = dspTelemetry.directionalPhrases || {};
  const active = sp.activeSwaras || [];
  const varjya = sp.omittedVarjyaSwaras || SWARA_TABLE.map((s) => s.id).filter((id) => !active.includes(id));
  const scaleId = dspTelemetry.scaleIdentity || identifyScale(active);

  const hasM2 = sp.hasTeevraMadhyam ? 'Teevra Madhyam (M2)' : 'Shuddha Madhyam (M1)';
  const komals = active.filter((s) => ['r1', 'g2', 'd1', 'n2'].includes(s));
  const komalDesc = komals.length ? `Komal swaras: ${describeSwaraList(komals)}` : 'All Shuddha swaras (no komal notes)';

  const ngrams = (dp.topRecurringNgrams || [])
    .slice(0, 6)
    .map((n) => n.phrase)
    .join(', ');
  const topCandidate = (dspTelemetry.acousticCandidateShortlist || [])[0];
  const matchedPakad = topCandidate?.matchedPakadMotifs?.join(', ') || ngrams;

  return (
    `task: search result | query: ` +
    `${scaleId.thaat} thaat, ${sp.inferredJati || ''} scale (${active.length} notes: ${active.join(' ')}). ` +
    `${hasM2}. ${komalDesc}. ` +
    `Active swaras: ${describeSwaraList(active)}. ` +
    `Omissions: ${describeOmissions(varjya)}. ` +
    `Vadi principal swara: ${SWARA_NAME_MAP[sp.detectedVadi] || sp.detectedVadi || 'S'}, ` +
    `Samvadi consonant swara: ${SWARA_NAME_MAP[sp.detectedSamvadi] || sp.detectedSamvadi || 'P'}. ` +
    `Aroha ascending: ${dp.arohaAscendingSwaras || active.join(' ')}. ` +
    `Avaroha descending: ${dp.avarohaDescendingSwaras || [...active].reverse().join(' ')}. ` +
    `Pakad catch phrases: ${matchedPakad || ngrams}`
  );
}

/**
 * Load EmbeddingGemma 2 with Selective Encoder Loading (Text 270M + Audio 300M = 570M, skipping Vision 170M).
 */
export async function loadEmbeddingGemma2() {
  if (cachedPipeline) return cachedPipeline;

  const { AutoConfig, AutoProcessor, AutoModel } = await import('@huggingface/transformers');
  const t0 = performance.now();
  const config = await AutoConfig.from_pretrained(MODEL_ID);
  // Selective encoder loading: remove vision_config to save 170M params / 109MB RAM
  config.vision_config = null;

  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  const model = await AutoModel.from_pretrained(MODEL_ID, {
    config,
    dtype: 'q4'
  });

  const loadTimeMs = Number((performance.now() - t0).toFixed(1));
  cachedPipeline = { config, processor, model, loadTimeMs, modelId: MODEL_ID };
  return cachedPipeline;
}

/**
 * Truncate a 768-d Matryoshka vector to `dim` (768, 512, 256, or 128) and L2 re-normalize.
 * Per EmbeddingGemma 2 spec: slicing a unit vector does not preserve unit length;
 * L2 re-normalization is mandatory before cosine similarity.
 */
export function truncateAndNormalizeMRL(vec768, dim = 768) {
  const out = new Float32Array(dim);
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const v = vec768[i];
    out[i] = v;
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dim; i++) {
    out[i] /= norm;
  }
  return out;
}

/**
 * Compute dot product of two L2-normalized vectors (= cosine similarity).
 */
export function dotProduct(a, b, dim = a.length) {
  let sum = 0;
  for (let i = 0; i < dim; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Resample / pitch-shift mono 16kHz audio so that the detected tonic `detectedSaHz`
 * aligns to the canonical reference tonic `targetSaHz` (146.83 Hz = D3).
 * Uses cubic Hermite interpolation to preserve harmonic overtone structure for the mel-spectrogram.
 */
export function normalizeAudioToCanonicalTonic(samples, detectedSaHz, targetSaHz = CANONICAL_SA_HZ) {
  if (!detectedSaHz || detectedSaHz <= 0) return samples;
  let ratio = detectedSaHz / targetSaHz;
  // Fold only across full octave jumps (> 1.85x or < 0.54x) so Octave 3 tonics (C3..B3) map directly to D3 (146.83 Hz)
  while (ratio > 1.85) ratio /= 2;
  while (ratio < 0.54) ratio *= 2;

  if (Math.abs(ratio - 1.0) < 0.008) return samples;

  const outLength = Math.min(samples.length, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const y0 = samples[Math.max(0, idx - 1)] || 0;
    const y1 = samples[Math.min(samples.length - 1, idx)] || 0;
    const y2 = samples[Math.min(samples.length - 1, idx + 1)] || 0;
    const y3 = samples[Math.min(samples.length - 1, idx + 2)] || 0;

    // 4-point cubic Hermite interpolation
    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[i] = ((c3 * frac + c2) * frac + c1) * frac + c0;
  }
  return out;
}

/**
 * Embed an array of texts in batches using EmbeddingGemma 2 (`sentence_embedding`).
 * Returns an array of Float32Array(768) unit vectors.
 */
export async function embedTextsGemma2(texts, batchSize = 32) {
  const { processor, model } = await loadEmbeddingGemma2();
  const results = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const inputs = await processor(batch);
    const { sentence_embedding } = await model(inputs);
    const data = sentence_embedding.data;
    const dim = sentence_embedding.dims[1];
    for (let b = 0; b < batch.length; b++) {
      const slice = new Float32Array(dim);
      slice.set(data.subarray(b * dim, (b + 1) * dim));
      results.push(truncateAndNormalizeMRL(slice, dim));
    }
  }
  return results;
}

/**
 * Embed a 16kHz mono Float32Array audio buffer using EmbeddingGemma 2's native Audio Encoder.
 * Returns a Float32Array(768) unit vector.
 */
export async function embedAudioGemma2(samples16k) {
  const { processor, model } = await loadEmbeddingGemma2();
  // Cap to 14 seconds (224,000 samples @ 16kHz = 350 audio tokens) for consistent windowing across pitch shifts
  const maxSamples = 16000 * 14;
  const clipped = samples16k.length > maxSamples ? samples16k.subarray(0, maxSamples) : samples16k;
  const inputs = await processor(null, null, clipped);
  const { sentence_embedding } = await model(inputs);
  const vec = new Float32Array(sentence_embedding.dims[1]);
  vec.set(sentence_embedding.data);
  return truncateAndNormalizeMRL(vec, 768);
}

/**
 * Precompute or retrieve cached 768-d embeddings for all ragas in `catalogSlice` (default: all 962 ragas).
 */
export async function getCatalogEmbeddingsGemma2(catalogSlice = RAGA_CATALOG) {
  if (catalogSlice === RAGA_CATALOG && cachedCatalogEmbeddings768) {
    return cachedCatalogEmbeddings768;
  }
  const docs = catalogSlice.map((r) => formatRagaDocumentText(r));
  const vectors = await embedTextsGemma2(docs, 32);
  const entries = catalogSlice.map((raga, idx) => ({
    ragaId: raga.id,
    ragaName: raga.name,
    thaat: raga.thaat,
    vector768: vectors[idx]
  }));
  if (catalogSlice === RAGA_CATALOG) {
    cachedCatalogEmbeddings768 = entries;
  }
  return entries;
}

/**
 * Rank a query vector against pre-embedded catalog entries at any Matryoshka dimension (768, 512, 256, 128).
 */
export function rankAgainstCatalogMRL(queryVec768, catalogEntries, dim = 768, topK = 10) {
  const qVec = dim === 768 ? queryVec768 : truncateAndNormalizeMRL(queryVec768, dim);
  const scored = new Array(catalogEntries.length);

  for (let i = 0; i < catalogEntries.length; i++) {
    const entry = catalogEntries[i];
    const cVec = dim === 768 ? entry.vector768 : truncateAndNormalizeMRL(entry.vector768, dim);
    const sim = dotProduct(qVec, cVec, dim);
    scored[i] = {
      ragaId: entry.ragaId,
      ragaName: entry.ragaName,
      thaat: entry.thaat,
      cosineSimilarity: Number(sim.toFixed(4))
    };
  }

  scored.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);
  return scored.slice(0, topK);
}
