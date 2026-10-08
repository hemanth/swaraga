import {
  RAGA_CATALOG,
  SWARA_TABLE,
  getRagaById,
  nearestThaat,
  parentMelakartaFor,
  orderedSwaras,
  classifyJanyaScale
} from './raga-catalog.js';

// Number of acoustic candidates forwarded to System One / OpenJev as the primary_raga option set
export const SHORTLIST_SIZE = 12;

export const OUT_OF_CATALOG_ID = 'out_of_catalog';

// A catalogued raga with exactly the observed scale beats the open-set candidate by at least this margin
export const OPEN_SET_MARGIN = 0.02;

/**
 * Deterministic acoustic-grammar match score of the observed swara telemetry against every raga in the catalog.
 * `hasPhrase(ngram)` reports whether a swara n-gram occurs in the performance.
 */
export function scoreRagaCandidates({ swaraDistribution, activeSwaras, detectedVadi, detectedSamvadi, hasPhrase }) {
  const activeSet = new Set(activeSwaras);
  return RAGA_CATALOG.map((raga) => {
    // 1. Swara coverage & varjya penalty
    let swaraRecall = 0;
    for (const s of raga.swaras) {
      swaraRecall += swaraDistribution[s] || 0;
    }
    let varjyaLeakage = 0;
    for (const v of raga.varjya) {
      varjyaLeakage += swaraDistribution[v] || 0;
    }

    // 2. Pakad (or aroha/avaroha-derived) n-gram matches
    const matchedPakads = raga.pakadNgrams.filter((ng) => hasPhrase(ng));
    const pakadScore = raga.pakadNgrams.length > 0 ? matchedPakads.length / raga.pakadNgrams.length : 0;

    // 3. Exact scale set Jaccard similarity
    const intersection = raga.swaras.filter((s) => activeSet.has(s)).length;
    const union = new Set([...activeSwaras, ...raga.swaras]).size || 1;
    const jaccard = intersection / union;

    // 4. Vadi / Samvadi alignment
    const vadiBonus =
      (detectedVadi === raga.vadi ? 0.14 : 0) +
      (detectedSamvadi === raga.samvadi || detectedVadi === raga.samvadi ? 0.08 : 0);

    const rawFit = Math.max(
      0,
      swaraRecall * 0.42 - varjyaLeakage * 1.15 + jaccard * 0.32 + pakadScore * 0.28 + vadiBonus
    );
    const acousticFit = Math.min(0.99, rawFit);

    return {
      ragaId: raga.id,
      ragaName: raga.name,
      thaat: raga.thaat,
      acousticFitScore: Number(acousticFit.toFixed(3)),
      rawFitScore: Number(rawFit.toFixed(3)),
      matchedPakadMotifs: matchedPakads,
      varjyaLeakage: Number(varjyaLeakage.toFixed(3))
    };
  }).sort((a, b) => b.rawFitScore - a.rawFitScore);
}

/**
 * Acoustic fit of a hypothetical raga whose scale is exactly the observed swara set, with no pakad or
 * vadi evidence. Catalogued ragas only outrank it when their scale matches or their phrases/vadi support them.
 */
export function openSetFitScore(swaraDistribution, activeSwaras) {
  let recall = 0;
  let leakage = 0;
  for (const s of SWARA_TABLE) {
    if (activeSwaras.includes(s.id)) recall += swaraDistribution[s.id] || 0;
    else leakage += swaraDistribution[s.id] || 0;
  }
  return Number(Math.max(0, recall * 0.42 - leakage * 1.15 + 0.32 - OPEN_SET_MARGIN).toFixed(3));
}

/**
 * Open-set scale identity of the performance: exact swara set, nearest Thaat, parent Melakarta,
 * and any catalogued ragas sharing exactly this swara inventory.
 */
export function identifyScale(activeSwaras) {
  const swaras = orderedSwaras(activeSwaras.join(' '));
  const thaat = nearestThaat(swaras);
  const melakarta = parentMelakartaFor(swaras, thaat);
  const exactCatalogMatches = RAGA_CATALOG.filter(
    (r) => r.swaras.length === swaras.length && r.swaras.every((s) => swaras.includes(s))
  ).map((r) => r.id);
  return { swaras, thaat, melakarta, exactCatalogMatches };
}

/**
 * Raga-shaped candidate representing "a raga outside the catalog", described by its observed scale.
 */
export function buildOutOfCatalogCandidate(dspTelemetry) {
  const profile = dspTelemetry.scaleProfile;
  const identity = dspTelemetry.scaleIdentity || identifyScale(profile.activeSwaras);
  const mela = identity.melakarta;
  const parentText = mela
    ? mela.exact
      ? `Scale is Melakarta ${mela.number} (${mela.name})`
      : `Janya scale of Melakarta ${mela.number} (${mela.name})`
    : 'Bhashanga / mixed scale (no single Melakarta parent)';
  const phrases = dspTelemetry.directionalPhrases || {};
  const split = (text) => String(text || '').split(/\s+/).filter((s) => identity.swaras.includes(s));
  const janya = classifyJanyaScale(
    split(phrases.arohaAscendingSwaras).length ? split(phrases.arohaAscendingSwaras) : identity.swaras,
    split(phrases.avarohaDescendingSwaras).length ? split(phrases.avarohaDescendingSwaras) : identity.swaras
  );
  const structure = mela ? `${janya.jati} janya of ${mela.name}` : `${janya.jati} bhashanga scale`;
  return {
    id: OUT_OF_CATALOG_ID,
    name: `Unlisted Raga — ${structure} (${identity.swaras.join(' ')})`,
    carnaticEquivalent: parentText,
    tradition: 'Open-set — not in catalog',
    thaat: identity.thaat,
    jati: profile.inferredJati,
    swaras: identity.swaras,
    varjya: SWARA_TABLE.map((s) => s.id).filter((id) => !identity.swaras.includes(id)),
    aroha: phrases.arohaAscendingSwaras || identity.swaras.join(' '),
    avaroha: phrases.avarohaDescendingSwaras || [...identity.swaras].reverse().join(' '),
    pakad: (phrases.topRecurringNgrams || []).slice(0, 3).map((n) => n.phrase).join(', ') || '—',
    pakadNgrams: [],
    vadi: profile.detectedVadi,
    samvadi: profile.detectedSamvadi,
    nyasa: profile.nyasaRestingSwaras || [],
    prahar: 'Unknown (uncatalogued raga)',
    praharKey: 'sarva_kaalik',
    rasa: '—',
    gamakaProfile: `Observed scale ${identity.swaras.join(' ')} — nearest ${identity.thaat} Thaat`,
    sampleFile: null,
    melakarta: mela,
    janyaStructure: janya,
    aliases: [],
    source: 'open-set'
  };
}

/**
 * Candidate option set for the primary_raga judgment: acoustic shortlist plus the open-set candidate.
 */
export function buildCandidatePool(dspTelemetry) {
  const ragas = (dspTelemetry.acousticCandidateShortlist || [])
    .slice(0, SHORTLIST_SIZE)
    .map((c) => getRagaById(c.ragaId))
    .filter(Boolean);
  return { ragas, outOfCatalog: buildOutOfCatalogCandidate(dspTelemetry) };
}
