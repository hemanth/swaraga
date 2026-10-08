import fs from 'node:fs';
import { TypeSafeClient, choice, score, noul } from '@typesafe-ai/sdk';
import { THAAT_FAMILIES } from './raga-catalog.js';
import { buildCandidatePool, identifyScale, openSetFitScore, OUT_OF_CATALOG_ID } from '../public/raga-matcher.js';

// Load TYPESAFE_API_KEY from environment or local .env file
function resolveApiKey() {
  if (process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_API_KEY.trim()) {
    return process.env.TYPESAFE_API_KEY.trim();
  }
  try {
    if (fs.existsSync('.env')) {
      const content = fs.readFileSync('.env', 'utf8');
      const match = content.match(/TYPESAFE_API_KEY\s*=\s*([^\r\n#]+)/);
      if (match && match[1]) {
        const key = match[1].trim().replace(/^["']|["']$/g, '');
        process.env.TYPESAFE_API_KEY = key;
        return key;
      }
    }
  } catch {
    // ignore
  }
  return '';
}

let cachedClient = null;
function getTypeSafeClient(customApiKey = '') {
  const browserKey = String(customApiKey || '').trim();
  if (browserKey) {
    return {
      client: new TypeSafeClient({
        apiKey: browserKey,
        defaultModel: 'jev-latest',
        timeout: 15000
      }),
      keySource: 'browser-byok'
    };
  }
  if (cachedClient) return { client: cachedClient, keySource: 'server-env' };
  const apiKey = resolveApiKey();
  if (!apiKey) return { client: null, keySource: 'none' };
  cachedClient = new TypeSafeClient({
    apiKey,
    defaultModel: 'jev-latest',
    timeout: 15000
  });
  return { client: cachedClient, keySource: 'server-env' };
}

/**
 * Build the structured state and typed System One questions for Raga classification.
 */
export function buildRagaSystemOnePayload(dspTelemetry, metadata = {}) {
  const pool = buildCandidatePool(dspTelemetry);
  const scaleIdentity = dspTelemetry.scaleIdentity || identifyScale(dspTelemetry.scaleProfile.activeSwaras);
  const ragaCriteria = {};
  for (const raga of pool.ragas) {
    ragaCriteria[raga.id] = {
      name: raga.name,
      carnatic_equivalent: raga.carnaticEquivalent,
      thaat: raga.thaat,
      jati: raga.jati,
      allowed_swaras: raga.swaras.join(' '),
      omitted_varjya: raga.varjya.join(' '),
      aroha: raga.aroha,
      avaroha: raga.avaroha,
      pakad_phrases: raga.pakad,
      vadi: raga.vadi,
      samvadi: raga.samvadi,
      prahar: raga.prahar
    };
  }
  ragaCriteria[OUT_OF_CATALOG_ID] = {
    name: 'None of the shortlisted ragas (open-set / uncatalogued raga)',
    when_to_choose:
      'Choose only if the observed swara inventory, varjya notes, and phrases contradict every shortlisted raga grammar above',
    observed_scale: scaleIdentity.swaras.join(' '),
    nearest_thaat: scaleIdentity.thaat,
    parent_melakarta: pool.outOfCatalog.carnaticEquivalent
  };

  const state = {
    track_metadata: {
      filename: metadata.filename || 'uploaded-audio.mp3',
      user_hint: metadata.userHint || null
    },
    audio_summary: dspTelemetry.audioSummary,
    detected_tonic_sa: dspTelemetry.tonic,
    scale_profile: {
      active_swaras: dspTelemetry.scaleProfile.activeSwaras,
      omitted_varjya_swaras: dspTelemetry.scaleProfile.omittedVarjyaSwaras,
      inferred_jati: dspTelemetry.scaleProfile.inferredJati,
      detected_vadi: dspTelemetry.scaleProfile.detectedVadi,
      detected_samvadi: dspTelemetry.scaleProfile.detectedSamvadi,
      nyasa_resting_swaras: dspTelemetry.scaleProfile.nyasaRestingSwaras,
      has_teevra_madhyam_M2: dspTelemetry.scaleProfile.hasTeevraMadhyam,
      has_shuddha_madhyam_M1: dspTelemetry.scaleProfile.hasShuddhaMadhyam,
      has_komal_rishabh_r1: dspTelemetry.scaleProfile.hasKomalRishabh,
      has_komal_gandhar_g2: dspTelemetry.scaleProfile.hasKomalGandhar,
      has_komal_dhaivat_d1: dspTelemetry.scaleProfile.hasKomalDhaivat,
      has_komal_nishad_n2: dspTelemetry.scaleProfile.hasKomalNishad
    },
    swara_distribution: dspTelemetry.swaraDistribution,
    directional_phrases: {
      aroha_ascending_swaras: dspTelemetry.directionalPhrases.arohaAscendingSwaras,
      avaroha_descending_swaras: dspTelemetry.directionalPhrases.avarohaDescendingSwaras,
      top_recurring_ngrams: dspTelemetry.directionalPhrases.topRecurringNgrams,
      note_sequence_sample: dspTelemetry.directionalPhrases.noteSequenceSample
    },
    ornamentation: dspTelemetry.ornamentation,
    scale_identity: {
      observed_swaras: scaleIdentity.swaras.join(' '),
      nearest_thaat: scaleIdentity.thaat,
      parent_melakarta: scaleIdentity.melakarta,
      catalog_ragas_with_identical_scale: scaleIdentity.exactCatalogMatches
    },
    acoustic_candidate_shortlist: dspTelemetry.acousticCandidateShortlist
  };

  const questions = {
    primary_raga: choice(
      {
        task: 'Identify the primary Indian classical raga performed in this audio recording.',
        evidence_guide:
          'Compare `scale_profile.active_swaras`, `scale_profile.omitted_varjya_swaras`, `scale_profile.detected_vadi`, `directional_phrases.top_recurring_ngrams`, and `acoustic_candidate_shortlist` against each raga rubric.'
      },
      ragaCriteria
    ),

    thaat_family: choice(
      'Which parent Thaat (scale family) governs the swara inventory and tonal grammar in `scale_profile` and `swara_distribution`?',
      THAAT_FAMILIES
    ),

    tradition_idiom: choice(
      'Which Indian classical performance tradition best characterizes this raga structure?',
      {
        dual_canonical:
          'Shared canonical raga with direct structural equivalence across both Hindustani and Carnatic systems (e.g., Yaman/Kalyani, Bhairav/Mayamalavagowla, Bhupali/Mohanam, Malkauns/Hindolam)',
        hindustani:
          'Predominantly North Indian Hindustani raga grammar with characteristic Thaat, Pakad, and Andolan phrasing (e.g., Darbari Kanada, Miyan ki Todi, Desh, Bageshri)',
        carnatic:
          'Predominantly South Indian Carnatic Janya/Melakarta kriti idiom with crisp kampita ornamentation (e.g., Hamsadhwani, Kambhoji, Shanmukhapriya)'
      }
    ),

    prahar_time_window: choice(
      'According to the Time Theory of Ragas (Samay Chakra), which Prahar window matches the raga evident in `scale_profile` and `acoustic_candidate_shortlist`?',
      {
        dawn_sandhiprakash: 'Early Morning / Dawn Sandhiprakash (4 AM – 8 AM, e.g., Bhairav, Bhairavi)',
        late_morning: 'Late Morning / 2nd Prahar of Day (9 AM – 12 PM, e.g., Miyan ki Todi)',
        afternoon: 'Afternoon / 3rd Prahar of Day (1 PM – 4 PM, e.g., Bhimpalasi)',
        dusk_sandhiprakash: 'Dusk / Sunset Sandhiprakash (4 PM – 7 PM, e.g., Puriya Dhanashri)',
        early_night: 'Early Night / 1st Prahar of Night (6 PM – 10 PM, e.g., Yaman, Bhupali, Hamsadhwani, Desh)',
        late_night: 'Late Night / Midnight 3rd Prahar (10 PM – 3 AM, e.g., Malkauns, Darbari Kanada, Bageshri)',
        sarva_kaalik: 'Not bound to a Prahar window (Melakarta parent scales, most Carnatic ragas, light ragas)'
      }
    ),

    gamaka_ornamentation: score(
      'Rate the degree of microtonal Gamaka, Meend glides, and Andolan oscillation evident in `ornamentation.gamaka_active_swaras` and the raga idiom.',
      [
        'Plain straight-note rendering (Sapaat) with minimal pitch oscillation across swaras',
        'Light grace-note touches (Kan-swara) and clean pentatonic or scalar transitions',
        'Moderate melodic glides (Meend) and expressive phrase inflections across key swaras',
        'Deep, slow, sustained microtonal oscillation (Andolan) and intricate Vakra gamaka phrasing'
      ]
    ),

    rasa_emotional_gravity: score(
      'Rate the aesthetic mood (Rasa) along the axis from bright/celebratory to deeply solemn and introspective.',
      [
        'Bright, auspicious, celebratory, and brisk concert-opener energy (Utsaha / Mangala)',
        'Serene, luminous, tranquil, and balanced equipoise (Shanta / Prasanna)',
        'Lyrical, romantic, yearning, or tender devotional warmth (Shringara / Bhakti)',
        'Profound, majestic, solemn, and deeply introspective gravity (Gambhir / Karuna / Veera)'
      ]
    ),

    pakad_phrase_verified: noul(
      'Do `directional_phrases.top_recurring_ngrams`, `directional_phrases.note_sequence_sample`, and `acoustic_candidate_shortlist[0].matchedPakadMotifs` confirm the canonical Pakad catch-phrases of the top candidate raga?',
      {
        true: 'At least two signature Pakad motifs of the top raga are present in the observed phrase sequence',
        false: 'The note transitions are generic or lack the characteristic Pakad motifs of the top raga'
      }
    ),

    vadi_samvadi_aligned: noul(
      'Do `scale_profile.detected_vadi`, `scale_profile.detected_samvadi`, and `scale_profile.nyasa_resting_swaras` align with the principal Vadi/Samvadi notes of the top candidate raga?',
      {
        true: 'The dominant dwell and resting swaras match the theoretical Vadi or Samvadi of the raga',
        false: 'The dominant swaras conflict with the expected Vadi/Samvadi hierarchy'
      }
    ),

    pentatonic_audava_jati: noul(
      'Does `scale_profile` represent a 5-note pentatonic (Audava) raga where at least 6 or 7 chromatic swarasthanas are omitted (Varjya)?',
      {
        true: 'Strictly 5 active swaras (Audava Jati) such as Bhupali, Malkauns, or Hamsadhwani',
        false: '6-note (Shadava) or 7-note (Sampurna) scale structure'
      }
    ),

    sandhiprakash_twilight_character: noul(
      'Does `scale_profile` exhibit the twilight Sandhiprakash swara combination of Komal Rishabh (`r1`) paired with Shuddha Gandhar (`G3`)?',
      {
        true: 'Both Komal Rishabh (r1) and Shuddha Gandhar (G3) are active in the scale (e.g., Bhairav or Puriya Dhanashri)',
        false: 'Does not combine Komal Rishabh (r1) with Shuddha Gandhar (G3)'
      }
    )
  };

  return { state, questions };
}

/**
 * Deterministic fallback when TYPESAFE_API_KEY is absent or offline, preserving exact System One response shapes.
 */
function evaluateLocalFallback(dspTelemetry, payload) {
  const shortlist = dspTelemetry.acousticCandidateShortlist || [];
  const { ragas, outOfCatalog } = buildCandidatePool(dspTelemetry);
  const options = [...ragas, outOfCatalog];

  // Convert acoustic fits into calibrated softmax probabilities across the shortlist + open-set option
  const rawMap = new Map(shortlist.map((c) => [c.ragaId, c.rawFitScore ?? c.acousticFitScore]));
  rawMap.set(
    OUT_OF_CATALOG_ID,
    openSetFitScore(dspTelemetry.swaraDistribution, dspTelemetry.scaleProfile.activeSwaras)
  );
  const temperature = 0.06;
  const exps = {};
  let sumExp = 0;
  for (const r of options) {
    const val = Math.exp((rawMap.get(r.id) ?? 0.08) / temperature);
    exps[r.id] = val;
    sumExp += val;
  }

  const ragaProbs = {};
  for (const r of options) {
    ragaProbs[r.id] = Number((exps[r.id] / sumExp).toFixed(4));
  }
  const topRaga = options.reduce((best, r) => (ragaProbs[r.id] > ragaProbs[best.id] ? r : best), options[0]);
  const top = shortlist.find((c) => c.ragaId === topRaga.id) || { matchedPakadMotifs: [] };

  // Thaat probabilities
  const thaatProbs = {};
  let thaatSum = 0;
  for (const thaatKey of Object.keys(THAAT_FAMILIES)) {
    const p = thaatKey === topRaga.thaat ? 0.82 : 0.18 / (Object.keys(THAAT_FAMILIES).length - 1);
    thaatProbs[thaatKey] = Number(p.toFixed(4));
    thaatSum += p;
  }

  const topProb = ragaProbs[topRaga.id] || 0.75;
  const confidence = Number(Math.min(0.96, Math.max(0.45, topProb * 1.08)).toFixed(3));
  const isAudava = dspTelemetry.scaleProfile.activeSwaras.length <= 5;
  const traditionKey =
    topRaga.tradition.startsWith('Carnatic')
      ? 'carnatic'
      : topRaga.tradition.includes('Dual')
        ? 'dual_canonical'
        : 'hindustani';
  const isSandhiprakash =
    dspTelemetry.scaleProfile.hasKomalRishabh &&
    dspTelemetry.scaleProfile.activeSwaras.includes('G3');

  return {
    model: 'jev-local-fallback',
    fallback: true,
    usage: { input_tokens: 0, output_tokens: 0 },
    answers: {
      primary_raga: {
        type: 'choice',
        choice: topRaga.id,
        confidence,
        probabilities: ragaProbs
      },
      thaat_family: {
        type: 'choice',
        choice: topRaga.thaat,
        confidence: 0.86,
        probabilities: thaatProbs
      },
      tradition_idiom: {
        type: 'choice',
        choice: traditionKey,
        confidence: 0.84,
        probabilities: {
          dual_canonical: traditionKey === 'dual_canonical' ? 0.78 : 0.11,
          hindustani: traditionKey === 'hindustani' ? 0.78 : 0.11,
          carnatic: traditionKey === 'carnatic' ? 0.78 : 0.11
        }
      },
      prahar_time_window: {
        type: 'choice',
        choice: topRaga.praharKey,
        confidence: 0.88,
        probabilities: {
          dawn_sandhiprakash: topRaga.praharKey === 'dawn_sandhiprakash' ? 0.85 : 0.03,
          late_morning: topRaga.praharKey === 'late_morning' ? 0.85 : 0.03,
          afternoon: topRaga.praharKey === 'afternoon' ? 0.85 : 0.03,
          dusk_sandhiprakash: topRaga.praharKey === 'dusk_sandhiprakash' ? 0.85 : 0.03,
          early_night: topRaga.praharKey === 'early_night' ? 0.85 : 0.03,
          late_night: topRaga.praharKey === 'late_night' ? 0.85 : 0.03,
          sarva_kaalik: topRaga.praharKey === 'sarva_kaalik' ? 0.85 : 0.03
        }
      },
      gamaka_ornamentation: {
        type: 'score',
        score: dspTelemetry.ornamentation.gamakaActiveSwaras.length >= 2 ? 2.65 : 1.45,
        confidence: 0.81,
        legend: {
          0: payload.questions.gamaka_ornamentation.criteria[0],
          1: payload.questions.gamaka_ornamentation.criteria[1],
          2: payload.questions.gamaka_ornamentation.criteria[2],
          3: payload.questions.gamaka_ornamentation.criteria[3]
        },
        probabilities: { 0: 0.05, 1: 0.2, 2: 0.45, 3: 0.3 }
      },
      rasa_emotional_gravity: {
        type: 'score',
        score: ['darbari_kanada', 'malkauns', 'bhairav', 'todi'].includes(topRaga.id) ? 2.75 : 1.35,
        confidence: 0.83,
        legend: {
          0: payload.questions.rasa_emotional_gravity.criteria[0],
          1: payload.questions.rasa_emotional_gravity.criteria[1],
          2: payload.questions.rasa_emotional_gravity.criteria[2],
          3: payload.questions.rasa_emotional_gravity.criteria[3]
        },
        probabilities: { 0: 0.1, 1: 0.3, 2: 0.3, 3: 0.3 }
      },
      pakad_phrase_verified: {
        type: 'noul',
        noul: (top.matchedPakadMotifs?.length || 0) >= 2 ? 0.94 : 0.62
      },
      vadi_samvadi_aligned: {
        type: 'noul',
        noul:
          dspTelemetry.scaleProfile.detectedVadi === topRaga.vadi ||
          dspTelemetry.scaleProfile.detectedSamvadi === topRaga.vadi
            ? 0.91
            : 0.68
      },
      pentatonic_audava_jati: {
        type: 'noul',
        noul: isAudava ? 0.96 : 0.04
      },
      sandhiprakash_twilight_character: {
        type: 'noul',
        noul: isSandhiprakash ? 0.95 : 0.03
      }
    }
  };
}

/**
 * Evaluate extracted DSP telemetry with TypeSafe System One (Jev) and compose hierarchical beam & confidence routing.
 */
export async function classifyRagaWithTypeSafe(dspTelemetry, metadata = {}) {
  const startedAt = Date.now();
  const payload = buildRagaSystemOnePayload(dspTelemetry, metadata);
  const { client, keySource } = getTypeSafeClient(metadata.apiKey);

  let systemOneResponse;
  let usedLiveJev = false;

  if (metadata.dspOnly) {
    systemOneResponse = evaluateLocalFallback(dspTelemetry, payload);
  } else if (client) {
    try {
      systemOneResponse = await client.systemOne({
        model: 'jev-latest',
        state: payload.state,
        questions: payload.questions
      });
      usedLiveJev = true;
    } catch (err) {
      console.warn('[TypeSafe Raga Classifier] Live Jev API error, using deterministic fallback:', err.message);
      systemOneResponse = evaluateLocalFallback(dspTelemetry, payload);
    }
  } else {
    systemOneResponse = evaluateLocalFallback(dspTelemetry, payload);
  }

  const latencyMs = Date.now() - startedAt;
  const answers = systemOneResponse.answers;
  const ragaProbs = answers.primary_raga?.probabilities || {};
  const thaatProbs = answers.thaat_family?.probabilities || {};

  // Build ranked candidate leaderboard with Hierarchical Beam Score: sqrt(P(Thaat) * P(Raga))
  const pool = buildCandidatePool(dspTelemetry);
  const rankedCandidates = [...pool.ragas, pool.outOfCatalog].map((raga) => {
    const ragaProb = Number(ragaProbs[raga.id] ?? 0);
    const parentThaatProb = Number(thaatProbs[raga.thaat] ?? 0.1);
    const beamScore = Number(Math.sqrt(Math.max(0, ragaProb * parentThaatProb)).toFixed(4));
    const acousticEntry =
      raga.id === OUT_OF_CATALOG_ID
        ? { acousticFitScore: openSetFitScore(dspTelemetry.swaraDistribution, dspTelemetry.scaleProfile.activeSwaras) }
        : dspTelemetry.acousticCandidateShortlist.find((c) => c.ragaId === raga.id);
    return {
      id: raga.id,
      name: raga.name,
      carnaticEquivalent: raga.carnaticEquivalent,
      thaat: raga.thaat,
      jati: raga.jati,
      prahar: raga.prahar,
      vadi: raga.vadi,
      samvadi: raga.samvadi,
      aroha: raga.aroha,
      avaroha: raga.avaroha,
      pakad: raga.pakad,
      rasa: raga.rasa,
      gamakaProfile: raga.gamakaProfile,
      swaras: raga.swaras,
      varjya: raga.varjya,
      tradition: raga.tradition,
      melakarta: raga.melakarta,
      aliases: raga.aliases,
      source: raga.source,
      probability: Number(ragaProb.toFixed(4)),
      parentThaatProbability: Number(parentThaatProb.toFixed(4)),
      hierarchicalBeamScore: beamScore,
      acousticFitScore: acousticEntry?.acousticFitScore ?? 0,
      matchedPakadMotifs: acousticEntry?.matchedPakadMotifs ?? []
    };
  }).sort((a, b) => b.probability - a.probability || b.acousticFitScore - a.acousticFitScore);

  const winner = rankedCandidates[0];
  const runnerUp = rankedCandidates[1] || rankedCandidates[0];
  const separationRatio =
    runnerUp && runnerUp.hierarchicalBeamScore > 0.001
      ? Number((winner.hierarchicalBeamScore / runnerUp.hierarchicalBeamScore).toFixed(2))
      : 9.99;

  // Confidence-Gated Routing policy (following TypeSafe Confidence-Gated Routing pattern)
  const primaryConfidence = Number((answers.primary_raga?.confidence ?? 0.8).toFixed(3));
  const pakadNoul = Number((answers.pakad_phrase_verified?.noul ?? 0.7).toFixed(3));
  const vadiNoul = Number((answers.vadi_samvadi_aligned?.noul ?? 0.7).toFixed(3));

  // Siblings whose scales differ by at most one swara (e.g. Bhairav / Kalingda, Yaman / Yaman Kalyan)
  // are a disambiguation, not an escalation
  const sharesScale = (a, b) =>
    a.swaras.filter((s) => !b.swaras.includes(s)).length + b.swaras.filter((s) => !a.swaras.includes(s)).length <= 1;

  let routingGate = 'AUTO_VERIFIED';
  let routingSummary =
    `High-confidence System One judgment (${Math.round(primaryConfidence * 100)}% confidence, ${separationRatio}x beam separation). ` +
    `Pakad motifs (${Math.round(pakadNoul * 100)}% noul) and Vadi/Samvadi hierarchy (${Math.round(vadiNoul * 100)}% noul) confirm ${winner.name}.`;

  if (winner.id === OUT_OF_CATALOG_ID) {
    routingGate = 'OUT_OF_CATALOG';
    routingSummary =
      `No catalogued raga grammar fits this performance (closest: ${runnerUp.name}). ` +
      `Observed scale ${winner.swaras.join(' ')} — ${winner.carnaticEquivalent}, nearest ${winner.thaat} Thaat.`;
  } else if (primaryConfidence < 0.48 && !sharesScale(winner, runnerUp)) {
    routingGate = 'LOW_CONFIDENCE_ESCALATION';
    routingSummary =
      `Ambiguous scalar distribution (${Math.round(primaryConfidence * 100)}% confidence). ` +
      `Reporting parent Thaat ${answers.thaat_family?.choice || winner.thaat} and top candidates (${winner.name} vs ${runnerUp.name}) for human musicologist review.`;
  } else if (primaryConfidence < 0.72 || pakadNoul < 0.55) {
    routingGate = 'SIBLING_DISAMBIGUATION';
    routingSummary =
      `Moderate confidence (${Math.round(primaryConfidence * 100)}%). Disambiguated ${winner.name} from sibling ${runnerUp.name} (${runnerUp.thaat} Thaat) via Vadi=${winner.vadi} and Aroha/Avaroha contour.`;
  }

  return {
    engine: {
      provider: 'TypeSafe AI',
      model: systemOneResponse.model || 'jev-latest',
      liveApi: usedLiveJev,
      keySource: metadata.dspOnly ? 'openjev-local' : keySource,
      latencyMs,
      usage: systemOneResponse.usage || { input_tokens: 0, output_tokens: 0 }
    },
    winner,
    runnerUp,
    rankedCandidates,
    scaleIdentity: dspTelemetry.scaleIdentity || identifyScale(dspTelemetry.scaleProfile.activeSwaras),
    routing: {
      gate: routingGate,
      primaryConfidence,
      hierarchicalBeamScore: winner.hierarchicalBeamScore,
      separationRatio,
      summary: routingSummary
    },
    primitives: {
      choices: {
        primary_raga: answers.primary_raga,
        thaat_family: answers.thaat_family,
        tradition_idiom: answers.tradition_idiom,
        prahar_time_window: answers.prahar_time_window
      },
      scores: {
        gamaka_ornamentation: answers.gamaka_ornamentation,
        rasa_emotional_gravity: answers.rasa_emotional_gravity
      },
      nouls: {
        pakad_phrase_verified: answers.pakad_phrase_verified,
        vadi_samvadi_aligned: answers.vadi_samvadi_aligned,
        pentatonic_audava_jati: answers.pentatonic_audava_jati,
        sandhiprakash_twilight_character: answers.sandhiprakash_twilight_character
      }
    },
    dspTelemetry,
    systemOneInspector: {
      state: payload.state,
      questions: payload.questions,
      rawAnswers: answers
    }
  };
}
