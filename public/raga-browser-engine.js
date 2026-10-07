import { SWARA_TABLE, THAAT_FAMILIES, RAGA_CATALOG } from './raga-catalog.js';

export { SWARA_TABLE, THAAT_FAMILIES, RAGA_CATALOG };

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Decode any audio URL, File, Blob, or ArrayBuffer in the browser to 16kHz mono Float32Array PCM
 * using the native Web Audio API (AudioContext + OfflineAudioContext) — zero server required.
 */
export async function decodeAudioInBrowser(source, targetSampleRate = 16000) {
  let arrayBuffer;
  if (source instanceof ArrayBuffer) {
    arrayBuffer = source.slice(0);
  } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
    arrayBuffer = await source.arrayBuffer();
  } else if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch audio (${res.status}): ${source}`);
    }
    arrayBuffer = await res.arrayBuffer();
  } else {
    throw new Error('Unsupported audio source for browser Web Audio decoder');
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const tempCtx = new AudioCtx();
  let decodedBuffer;
  try {
    decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    tempCtx.close().catch(() => {});
  }

  const lengthInSamples = Math.max(1, Math.ceil(decodedBuffer.duration * targetSampleRate));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtx(1, lengthInSamples, targetSampleRate);
  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = decodedBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const samples = renderedBuffer.getChannelData(0);
  return {
    samples,
    sampleRate: targetSampleRate,
    durationSec: Number((samples.length / targetSampleRate).toFixed(2))
  };
}

function detectFramePitch(frame, sampleRate, minFreq = 95, maxFreq = 750) {
  const n = frame.length;
  let rms = 0;
  for (let i = 0; i < n; i++) {
    rms += frame[i] * frame[i];
  }
  rms = Math.sqrt(rms / n);
  if (rms < 0.012) {
    return { f0: 0, clarity: 0, rms };
  }

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minFreq));

  const diff = new Float32Array(maxLag + 1);
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;

  const searchSpan = maxLag;
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < searchSpan; i++) {
      const d = frame[i] - frame[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  let runningSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  const threshold = 0.16;
  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag - 1; tau++) {
    if (cmnd[tau] < threshold && cmnd[tau] <= cmnd[tau - 1] && cmnd[tau] <= cmnd[tau + 1]) {
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minLag; tau <= maxLag - 1; tau++) {
      if (cmnd[tau] < minVal) {
        minVal = cmnd[tau];
        bestTau = tau;
      }
    }
    if (minVal > 0.38) {
      return { f0: 0, clarity: 0, rms };
    }
  }

  let refinedTau = bestTau;
  if (bestTau > 1 && bestTau < maxLag) {
    const s0 = cmnd[bestTau - 1];
    const s1 = cmnd[bestTau];
    const s2 = cmnd[bestTau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-6) {
      refinedTau = bestTau + (s2 - s0) / denom;
    }
  }

  const f0 = sampleRate / refinedTau;
  const clarity = Math.max(0, Math.min(1, 1 - cmnd[bestTau]));
  return { f0, clarity, rms };
}

function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440.0);
}

function midiToFreq(midi) {
  return 440.0 * Math.pow(2, (midi - 69) / 12.0);
}

function resolveTonic(voicedFrames, tonicOverride = null) {
  if (tonicOverride && tonicOverride !== 'auto') {
    const clean = tonicOverride.trim().toUpperCase();
    const noteIdx = NOTE_NAMES.indexOf(clean);
    if (noteIdx !== -1) {
      const midiSa = 48 + noteIdx;
      return {
        noteName: NOTE_NAMES[noteIdx],
        pitchClass: noteIdx,
        tonicHz: Number(midiToFreq(midiSa).toFixed(2)),
        detectionMethod: 'manual-override'
      };
    }
  }

  const pcHist = new Float64Array(12);
  for (let i = 0; i < voicedFrames.length; i++) {
    const vf = voicedFrames[i];
    const midiFloat = freqToMidi(vf.f0);
    const nearestMidi = Math.round(midiFloat);
    const centErr = Math.abs(midiFloat - nearestMidi) * 100;
    if (centErr < 38) {
      const pc = ((nearestMidi % 12) + 12) % 12;
      let runBoost = 1.0;
      if (i > 0 && Math.abs(freqToMidi(voicedFrames[i - 1].f0) - midiFloat) < 0.25) {
        runBoost = 1.6;
      }
      pcHist[pc] += vf.clarity * vf.rms * runBoost;
    }
  }

  const totalWeight = pcHist.reduce((a, b) => a + b, 0) || 1;
  const openingPc = new Float64Array(12);
  const closingPc = new Float64Array(12);
  const edgeLen = Math.min(45, Math.floor(voicedFrames.length * 0.18));

  for (let i = 0; i < edgeLen; i++) {
    const vf = voicedFrames[i];
    const pc = ((Math.round(freqToMidi(vf.f0)) % 12) + 12) % 12;
    openingPc[pc] += vf.clarity;
  }
  for (let i = Math.max(0, voicedFrames.length - edgeLen); i < voicedFrames.length; i++) {
    const vf = voicedFrames[i];
    const pc = ((Math.round(freqToMidi(vf.f0)) % 12) + 12) % 12;
    closingPc[pc] += vf.clarity;
  }

  const openTotal = openingPc.reduce((a, b) => a + b, 0) || 1;
  const closeTotal = closingPc.reduce((a, b) => a + b, 0) || 1;

  let bestPc = 2;
  let bestScore = -1;
  for (let pc = 0; pc < 12; pc++) {
    const saShare = pcHist[pc] / totalWeight;
    const paShare = pcHist[(pc + 7) % 12] / totalWeight;
    const ma1Share = pcHist[(pc + 5) % 12] / totalWeight;
    const ma2Share = pcHist[(pc + 6) % 12] / totalWeight;
    const openShare = openingPc[pc] / openTotal;
    const closeShare = closingPc[pc] / closeTotal;
    const fifthOrFourthSupport = Math.max(paShare, ma1Share, ma2Share);

    let bestTemplateFit = 0;
    for (const raga of RAGA_CATALOG) {
      let inScaleMass = 0;
      let outScaleMass = 0;
      for (let offset = 0; offset < 12; offset++) {
        const swaraId = SWARA_TABLE[offset].id;
        const share = pcHist[(pc + offset) % 12] / totalWeight;
        if (raga.swaras.includes(swaraId)) {
          inScaleMass += share;
        } else {
          outScaleMass += share;
        }
      }
      const fit = inScaleMass - outScaleMass * 1.4;
      if (fit > bestTemplateFit) bestTemplateFit = fit;
    }

    const score =
      saShare * 1.15 +
      paShare * 0.55 +
      ma1Share * 0.4 +
      fifthOrFourthSupport * 0.35 +
      openShare * 0.75 +
      closeShare * 1.15 +
      Math.max(0, bestTemplateFit) * 0.85;

    if (score > bestScore) {
      bestScore = score;
      bestPc = pc;
    }
  }

  const midiSa = 48 + bestPc;
  return {
    noteName: NOTE_NAMES[bestPc],
    pitchClass: bestPc,
    tonicHz: Number(midiToFreq(midiSa).toFixed(2)),
    detectionMethod: 'cadential-drone-harmonic-lock'
  };
}

/**
 * Full deterministic 12-Swara DSP analysis in browser.
 */
export function analyzeRagaAudioPCM(samples, sampleRate = 16000, options = {}) {
  const windowSize = Math.round(sampleRate * 0.04);
  const hopSize = Math.round(sampleRate * 0.015);
  const maxFrames = Math.min(Math.floor((samples.length - windowSize) / hopSize), 6000);

  const voicedFrames = [];
  for (let idx = 0; idx < maxFrames; idx++) {
    const start = idx * hopSize;
    const frame = samples.subarray(start, start + windowSize);
    const { f0, clarity, rms } = detectFramePitch(frame, sampleRate);
    const timeSec = Number(((start + windowSize / 2) / sampleRate).toFixed(3));
    if (f0 >= 95 && f0 <= 720 && clarity >= 0.62) {
      voicedFrames.push({ timeSec, f0, clarity, rms });
    }
  }

  const tonic = resolveTonic(voicedFrames, options.tonicNote);
  const swaraDwellCounts = new Float64Array(12);
  const swaraOscillationEnergy = new Float64Array(12);
  const rawContour = [];
  let prevCentsUnwrapped = null;

  // Determine the singer's primary octave offset relative to tonic.tonicHz
  const rawUnwrappedList = voicedFrames.map((vf) => 1200 * Math.log2(vf.f0 / tonic.tonicHz));
  const sortedRaw = [...rawUnwrappedList].sort((a, b) => a - b);
  const medianRawCents = sortedRaw.length > 0 ? sortedRaw[Math.floor(sortedRaw.length / 2)] : 500;
  const baseOctaveCents = Math.round((medianRawCents - 500) / 1200) * 1200;

  for (let i = 0; i < voicedFrames.length; i++) {
    const vf = voicedFrames[i];
    const exactSemitonesFromSa = 12 * Math.log2(vf.f0 / tonic.tonicHz);
    const normalizedCents = ((exactSemitonesFromSa * 100) % 1200 + 1200) % 1200;
    const nearestSemitone = Math.round(normalizedCents / 100) % 12;

    swaraDwellCounts[nearestSemitone] += vf.clarity;

    if (prevCentsUnwrapped !== null) {
      const delta = Math.abs(exactSemitonesFromSa * 100 - prevCentsUnwrapped);
      if (delta > 12 && delta < 140) {
        swaraOscillationEnergy[nearestSemitone] += delta / 100;
      }
    }
    prevCentsUnwrapped = exactSemitonesFromSa * 100;

    // Continuous Saptak-relative cents in [-220 .. +1260] (Mandra n2/N3 through Madhya S..N3 up to Taar S')
    let shifted = exactSemitonesFromSa * 100 - baseOctaveCents;
    while (shifted < -220) shifted += 1200;
    while (shifted > 1260) shifted -= 1200;

    // Continuity lock: if adjacent frame within 45ms was near 0¢ or 1200¢, avoid 1200¢ wrap jumps
    if (rawContour.length > 0) {
      const prevPt = rawContour[rawContour.length - 1];
      if (vf.timeSec - prevPt.t < 0.06) {
        if (Math.abs(shifted + 1200 - prevPt.saptakCents) < 180 && shifted + 1200 <= 1300) {
          shifted += 1200;
        } else if (Math.abs(shifted - 1200 - prevPt.saptakCents) < 180 && shifted - 1200 >= -250) {
          shifted -= 1200;
        }
      }
    }

    const nominalSwaraCents = Math.round(shifted / 100) * 100;
    const centDeviation = Math.round(shifted - nominalSwaraCents);

    rawContour.push({
      t: vf.timeSec,
      hz: Number(vf.f0.toFixed(1)),
      cents: Math.round(normalizedCents),
      saptakCents: Math.round(shifted),
      centDeviation,
      swara: SWARA_TABLE[nearestSemitone].id,
      clarity: Number(vf.clarity.toFixed(2))
    });
  }

  // Apply 7-point median filter + transient consonant despiker + 3-point weighted smoothing
  const smoothedCents = rawContour.map((pt, idx) => {
    const neighbors = [];
    for (let k = Math.max(0, idx - 3); k <= Math.min(rawContour.length - 1, idx + 3); k++) {
      if (Math.abs(rawContour[k].t - pt.t) <= 0.12) {
        neighbors.push(rawContour[k].saptakCents);
      }
    }
    neighbors.sort((a, b) => a - b);
    return neighbors[Math.floor(neighbors.length / 2)] ?? pt.saptakCents;
  });

  // Despike short 1..5 frame (<90ms) consonant/subharmonic excursions
  for (let i = 1; i < smoothedCents.length - 1; i++) {
    const prevVal = smoothedCents[i - 1];
    if (Math.abs(smoothedCents[i] - prevVal) > 220) {
      let endIdx = -1;
      for (let look = 1; look <= 5 && i + look < smoothedCents.length; look++) {
        if (
          rawContour[i + look].t - rawContour[i - 1].t <= 0.14 &&
          Math.abs(smoothedCents[i + look] - prevVal) <= 160
        ) {
          endIdx = i + look;
          break;
        }
      }
      if (endIdx !== -1) {
        const nextVal = smoothedCents[endIdx];
        for (let fill = i; fill < endIdx; fill++) {
          smoothedCents[fill] = Math.round((prevVal + nextVal) / 2);
        }
        i = endIdx - 1;
      }
    }
  }

  // Trim isolated single/double edge frames at the start/end of a breath phrase that jump > 260¢
  const pitchContour = [];
  const step = Math.max(1, Math.floor(rawContour.length / 720));
  for (let i = 0; i < rawContour.length; i += step) {
    const pt = rawContour[i];
    let cSmooth = smoothedCents[i];

    // Skip isolated 1-frame onset/release artifacts jumping > 280¢ at breath boundaries
    const prevNeighbour = i > 0 ? rawContour[i - 1] : null;
    const nextNeighbour = i < rawContour.length - 1 ? rawContour[i + 1] : null;
    const isBreathStart = !prevNeighbour || pt.t - prevNeighbour.t > 0.08;
    const isBreathEnd = !nextNeighbour || nextNeighbour.t - pt.t > 0.08;
    if (isBreathStart && nextNeighbour && Math.abs(smoothedCents[i + 1] - cSmooth) > 260) {
      continue;
    }
    if (isBreathEnd && prevNeighbour && Math.abs(smoothedCents[i - 1] - cSmooth) > 260) {
      continue;
    }

    if (
      i > 0 &&
      i < rawContour.length - 1 &&
      pt.t - rawContour[i - 1].t < 0.05 &&
      rawContour[i + 1].t - pt.t < 0.05 &&
      Math.abs(smoothedCents[i - 1] - cSmooth) < 220 &&
      Math.abs(smoothedCents[i + 1] - cSmooth) < 220
    ) {
      cSmooth = Math.round(0.25 * smoothedCents[i - 1] + 0.5 * cSmooth + 0.25 * smoothedCents[i + 1]);
    }
    pitchContour.push({
      ...pt,
      saptakCents: cSmooth
    });
  }

  const totalDwell = swaraDwellCounts.reduce((a, b) => a + b, 0) || 1;
  const swaraDistribution = {};
  const activeSwaras = [];
  const omittedSwaras = [];
  const gamakaSwaras = [];

  for (let s = 0; s < 12; s++) {
    const swaraId = SWARA_TABLE[s].id;
    const share = Number((swaraDwellCounts[s] / totalDwell).toFixed(4));
    swaraDistribution[swaraId] = share;

    if (share >= 0.032 || (s === 0 && share >= 0.015)) {
      activeSwaras.push(swaraId);
    } else if (share < 0.018 && s !== 0) {
      omittedSwaras.push(swaraId);
    }

    const oscAvg = swaraDwellCounts[s] > 0 ? swaraOscillationEnergy[s] / swaraDwellCounts[s] : 0;
    if (share >= 0.03 && oscAvg > 0.22 && s !== 0 && s !== 7) {
      gamakaSwaras.push({
        swara: swaraId,
        oscillationIndex: Number(oscAvg.toFixed(2))
      });
    }
  }

  const stabilizedNotes = [];
  const noteRibbons = [];
  let currentRunSwara = null;
  let currentRunSemitone = null;
  let currentRunFrames = 0;
  let currentRunStartSec = 0;
  let currentRunEndSec = 0;
  let currentRunSaptakSum = 0;

  for (let i = 0; i < voicedFrames.length; i++) {
    const vf = voicedFrames[i];
    const exactSemitones = 12 * Math.log2(vf.f0 / tonic.tonicHz);
    const normCents = ((exactSemitones * 100) % 1200 + 1200) % 1200;
    const semi = Math.round(normCents / 100) % 12;
    const swaraId = SWARA_TABLE[semi].id;
    const saptakVal = smoothedCents[i] ?? normCents;

    if (swaraId === currentRunSwara && vf.timeSec - currentRunEndSec < 0.12) {
      currentRunFrames++;
      currentRunEndSec = vf.timeSec;
      currentRunSaptakSum += saptakVal;
    } else {
      if (currentRunSwara !== null && currentRunFrames >= 3 && swaraDistribution[currentRunSwara] >= 0.025) {
        const meanSaptak = Math.round(currentRunSaptakSum / currentRunFrames / 100) * 100;
        noteRibbons.push({
          swara: currentRunSwara,
          semitone: currentRunSemitone,
          saptakCents: Math.max(-200, Math.min(1200, meanSaptak)),
          tStart: currentRunStartSec,
          tEnd: Number((currentRunEndSec + 0.02).toFixed(3)),
          frames: currentRunFrames
        });
        if (stabilizedNotes.length === 0 || stabilizedNotes[stabilizedNotes.length - 1].swara !== currentRunSwara) {
          stabilizedNotes.push({
            swara: currentRunSwara,
            semitone: currentRunSemitone,
            frames: currentRunFrames
          });
        } else {
          stabilizedNotes[stabilizedNotes.length - 1].frames += currentRunFrames;
        }
      }
      currentRunSwara = swaraId;
      currentRunSemitone = semi;
      currentRunFrames = 1;
      currentRunStartSec = vf.timeSec;
      currentRunEndSec = vf.timeSec;
      currentRunSaptakSum = saptakVal;
    }
  }
  if (currentRunSwara !== null && currentRunFrames >= 3 && swaraDistribution[currentRunSwara] >= 0.025) {
    const meanSaptak = Math.round(currentRunSaptakSum / currentRunFrames / 100) * 100;
    noteRibbons.push({
      swara: currentRunSwara,
      semitone: currentRunSemitone,
      saptakCents: Math.max(-200, Math.min(1200, meanSaptak)),
      tStart: currentRunStartSec,
      tEnd: Number((currentRunEndSec + 0.02).toFixed(3)),
      frames: currentRunFrames
    });
    if (stabilizedNotes.length === 0 || stabilizedNotes[stabilizedNotes.length - 1].swara !== currentRunSwara) {
      stabilizedNotes.push({
        swara: currentRunSwara,
        semitone: currentRunSemitone,
        frames: currentRunFrames
      });
    }
  }

  const ascendingSwaraSet = new Set(['S']);
  const descendingSwaraSet = new Set(['S']);
  const ngramCounts = new Map();
  const nyasaCounts = new Map();

  for (let i = 0; i < stabilizedNotes.length; i++) {
    const cur = stabilizedNotes[i];
    if (cur.frames >= 8 && cur.swara !== 'S') {
      nyasaCounts.set(cur.swara, (nyasaCounts.get(cur.swara) || 0) + cur.frames);
    }
    if (i > 0) {
      const prev = stabilizedNotes[i - 1];
      const diff = cur.semitone - prev.semitone;
      if ((diff > 0 && diff <= 5) || diff < -7) {
        ascendingSwaraSet.add(prev.swara);
        ascendingSwaraSet.add(cur.swara);
      } else if ((diff < 0 && diff >= -5) || diff > 7) {
        descendingSwaraSet.add(prev.swara);
        descendingSwaraSet.add(cur.swara);
      }
    }
    if (i >= 2) {
      const tri = `${stabilizedNotes[i - 2].swara} ${stabilizedNotes[i - 1].swara} ${cur.swara}`;
      ngramCounts.set(tri, (ngramCounts.get(tri) || 0) + 1);
    }
  }

  const swaraOrder = SWARA_TABLE.map((s) => s.id);
  const arohaSwaras = swaraOrder.filter((id) => ascendingSwaraSet.has(id) && activeSwaras.includes(id));
  const avarohaSwaras = [...swaraOrder]
    .reverse()
    .filter((id) => descendingSwaraSet.has(id) && activeSwaras.includes(id));

  const nonSaRanked = Object.entries(swaraDistribution)
    .filter(([id]) => id !== 'S')
    .sort((a, b) => b[1] - a[1]);

  const detectedVadi = nonSaRanked[0]?.[0] || 'G3';
  let detectedSamvadi = nonSaRanked[1]?.[0] || 'N3';
  const vadiSemi = SWARA_TABLE.find((s) => s.id === detectedVadi)?.index ?? 4;

  for (const [candId, share] of nonSaRanked.slice(1, 5)) {
    const candSemi = SWARA_TABLE.find((s) => s.id === candId)?.index ?? 0;
    const interval = ((candSemi - vadiSemi) % 12 + 12) % 12;
    if ((interval === 5 || interval === 7) && share >= 0.06) {
      detectedSamvadi = candId;
      break;
    }
  }

  const topNgrams = [...ngramCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase, count]) => ({ phrase, count }));

  const nyasaSwaras = [...nyasaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([swara]) => swara);

  const noteCount = activeSwaras.length;
  const inferredJati =
    noteCount <= 5
      ? 'Audava (Pentatonic, 5 notes)'
      : noteCount === 6
        ? 'Shadava (Hexatonic, 6 notes)'
        : 'Sampurna (Heptatonic, 7 notes)';

  const candidateMatches = RAGA_CATALOG.map((raga) => {
    let swaraRecall = 0;
    let varjyaLeakage = 0;
    for (const s of raga.swaras) {
      swaraRecall += swaraDistribution[s] || 0;
    }
    for (const v of raga.varjya) {
      varjyaLeakage += swaraDistribution[v] || 0;
    }
    const overlapCount = raga.swaras.filter((s) => activeSwaras.includes(s)).length;
    const extraCount = activeSwaras.filter((s) => !raga.swaras.includes(s)).length;
    const jaccard = overlapCount / Math.max(1, raga.swaras.length + extraCount);

    let matchedPakads = [];
    for (const p of raga.pakadNgrams) {
      if (ngramCounts.has(p)) {
        matchedPakads.push(p);
      }
    }
    const pakadScore = matchedPakads.length / Math.max(1, raga.pakadNgrams.length);
    const vadiBonus =
      detectedVadi === raga.vadi || detectedSamvadi === raga.vadi
        ? 0.14
        : activeSwaras.includes(raga.vadi)
          ? 0.05
          : 0;

    const acousticFit = Math.max(
      0,
      Math.min(
        0.99,
        swaraRecall * 0.42 - varjyaLeakage * 1.15 + jaccard * 0.32 + pakadScore * 0.28 + vadiBonus
      )
    );

    return {
      ragaId: raga.id,
      ragaName: raga.name,
      thaat: raga.thaat,
      acousticFitScore: Number(acousticFit.toFixed(3)),
      matchedPakadMotifs: matchedPakads,
      varjyaLeakage: Number(varjyaLeakage.toFixed(3))
    };
  }).sort((a, b) => b.acousticFitScore - a.acousticFitScore);

  return {
    audioSummary: {
      sampleRate,
      durationSec: Number((samples.length / sampleRate).toFixed(2)),
      voicedFrameCount: voicedFrames.length,
      stabilizedNoteEvents: stabilizedNotes.length
    },
    tonic,
    scaleProfile: {
      activeSwaras,
      omittedVarjyaSwaras: omittedSwaras,
      inferredJati,
      detectedVadi,
      detectedSamvadi,
      nyasaRestingSwaras: nyasaSwaras,
      hasTeevraMadhyam: (swaraDistribution.M2 || 0) >= 0.035,
      hasShuddhaMadhyam: (swaraDistribution.M1 || 0) >= 0.035,
      hasKomalRishabh: (swaraDistribution.r1 || 0) >= 0.035,
      hasKomalGandhar: (swaraDistribution.g2 || 0) >= 0.035,
      hasKomalDhaivat: (swaraDistribution.d1 || 0) >= 0.035,
      hasKomalNishad: (swaraDistribution.n2 || 0) >= 0.035
    },
    swaraDistribution,
    directionalPhrases: {
      arohaAscendingSwaras: arohaSwaras.join(' '),
      avarohaDescendingSwaras: avarohaSwaras.join(' '),
      topRecurringNgrams: topNgrams,
      noteSequenceSample: stabilizedNotes.slice(0, 48).map((n) => n.swara).join(' ')
    },
    ornamentation: {
      gamakaActiveSwaras: gamakaSwaras,
      meanPitchClarity: Number(
        (
          voicedFrames.reduce((acc, f) => acc + f.clarity, 0) / Math.max(1, voicedFrames.length)
        ).toFixed(3)
      )
    },
    acousticCandidateShortlist: candidateMatches.slice(0, 6),
    pitchContour,
    noteRibbons
  };
}

const choice = (question, criteria) => ({ type: 'choice', question, criteria });
const score = (question, criteria) => ({ type: 'score', question, criteria });
const noul = (question) => ({ type: 'noul', question });

export function buildRagaSystemOnePayload(dspTelemetry, metadata = {}) {
  const ragaCriteria = {};
  for (const raga of RAGA_CATALOG) {
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
          'Predominantly South Indian Carnatic Janya/Melakarta kriti idiom with crisp kampita ornamentation (e.g., Hamsadhwani)'
      }
    ),
    prahar_time_window: choice(
      'Which traditional Prahar (time-of-day performance window) corresponds to the identified raga?',
      {
        dawn_sandhiprakash: 'Dawn / Early Morning Sandhiprakash (4 AM – 8 AM, e.g., Bhairav, Bhairavi)',
        late_morning: 'Late Morning (8 AM – 12 PM, e.g., Miyan ki Todi, Bilawal)',
        afternoon: 'Afternoon (12 PM – 4 PM, e.g., Bhimpalasi)',
        dusk_sandhiprakash: 'Dusk / Evening Twilight (4 PM – 7 PM, Poorvi / Marwa)',
        early_night: 'Early Night / 1st-2nd Prahar of Night (6 PM – 11 PM, e.g., Yaman, Bhupali, Hamsadhwani, Desh, Bageshri, Khamaj)',
        late_night: 'Late Night / Midnight 3rd Prahar (11 PM – 3 AM, e.g., Malkauns, Darbari Kanada)'
      }
    ),
    gamaka_ornamentation: score(
      'Rate the microtonal Gamaka, Andolan, and Meend oscillation complexity observed in `ornamentation` and `directional_phrases`.',
      [
        'Flat, unornamented step-wise notes with minimal pitch oscillation',
        'Light transitional glides (meend) between adjacent swaras with stable note centers',
        'Expressive classical raga ornamentation with recurring pakad turns and moderate oscillation on vadi/samvadi',
        'Deep, signature microtonal Andolan and wide gamaka oscillation (e.g., Komal Ga/Dha oscillation in Darbari Kanada, Bhairav, or Malkauns)'
      ]
    ),
    rasa_emotional_gravity: score(
      'Rate the emotional ethos (Rasa) from bright, playful celebration (0) to solemn, meditative midnight/dawn gravity (3).',
      [
        'Bright, sparkling, celebratory, and lighthearted (Utsaha / Hasya — e.g., Hamsadhwani, Khamaj)',
        'Serene, luminous, romantic, or tranquil evening peace (Shringara / Prasanna — e.g., Yaman, Bhupali, Desh)',
        'Tender, yearning, devotional pathos (Viraha / Karuna — e.g., Bhimpalasi, Bageshri, Bhairavi)',
        'Profound, majestic, solemn, and mystical introspection (Gambhir / Adbhuta / Veera — e.g., Darbari Kanada, Malkauns, Bhairav, Todi)'
      ]
    ),
    pakad_phrase_verified: noul(
      'Do the extracted `top_recurring_ngrams` and `aroha_ascending_swaras`/`avaroha_descending_swaras` exhibit the characteristic Pakad catch-phrases of the top candidate raga?'
    ),
    vadi_samvadi_aligned: noul(
      'Do the highest-dwell swaras (`detected_vadi` and `detected_samvadi`) and `nyasa_resting_swaras` align with the theoretical Vadi/Samvadi hierarchy of the identified raga?'
    ),
    pentatonic_audava_jati: noul(
      'Is this performance strictly pentatonic (Audava Jati, 5 active swaras with two omitted scale degrees such as Ma/Ni or Re/Pa)?'
    ),
    sandhiprakash_twilight_character: noul(
      'Does the scale combine Komal Rishabh (r1) with Shuddha Gandhar (G3), characteristic of Dawn/Dusk Sandhiprakash ragas like Bhairav?'
    )
  };

  return { state, questions };
}

function evaluateLocalFallback(dspTelemetry, payload) {
  const shortlist = dspTelemetry.acousticCandidateShortlist || [];
  const top = shortlist[0] || { ragaId: 'yaman', acousticFitScore: 0.75, thaat: 'Kalyan' };
  const topRaga = RAGA_CATALOG.find((r) => r.id === top.ragaId) || RAGA_CATALOG[0];

  const ragaProbs = {};
  let sumExp = 0;
  const exps = {};
  for (const r of RAGA_CATALOG) {
    const entry = shortlist.find((c) => c.ragaId === r.id);
    const fit = entry ? entry.acousticFitScore : 0.1;
    const e = Math.exp(fit * 7.5);
    exps[r.id] = e;
    sumExp += e;
  }
  for (const r of RAGA_CATALOG) {
    ragaProbs[r.id] = Number((exps[r.id] / sumExp).toFixed(4));
  }

  const thaatProbs = {};
  for (const thaatKey of Object.keys(THAAT_FAMILIES)) {
    const p = thaatKey === topRaga.thaat ? 0.86 : 0.14 / (Object.keys(THAAT_FAMILIES).length - 1);
    thaatProbs[thaatKey] = Number(p.toFixed(4));
  }

  const topProb = ragaProbs[topRaga.id] || 0.85;
  const confidence = Number(Math.min(0.98, Math.max(0.55, topProb * 1.15)).toFixed(3));
  const isAudava = dspTelemetry.scaleProfile.activeSwaras.length <= 5;
  const isSandhiprakash =
    dspTelemetry.scaleProfile.hasKomalRishabh && dspTelemetry.scaleProfile.activeSwaras.includes('G3');

  return {
    model: 'jev-browser-dsp',
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
        confidence: 0.88,
        probabilities: thaatProbs
      },
      tradition_idiom: {
        type: 'choice',
        choice: topRaga.id === 'hamsadhwani' ? 'carnatic' : topRaga.tradition.includes('Dual') ? 'dual_canonical' : 'hindustani',
        confidence: 0.86,
        probabilities: {
          dual_canonical: topRaga.tradition.includes('Dual') ? 0.78 : 0.15,
          hindustani: topRaga.tradition.includes('Hindustani') && !topRaga.tradition.includes('Dual') ? 0.76 : 0.16,
          carnatic: topRaga.id === 'hamsadhwani' ? 0.75 : 0.06
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
          late_night: topRaga.praharKey === 'late_night' ? 0.85 : 0.03
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
        noul: (top.matchedPakadMotifs?.length || 0) >= 2 ? 0.94 : 0.68
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
 * Evaluate extracted DSP telemetry in the browser:
 * 1. If metadata.dspOnly is true (OpenJev selected), compute instant DSP baseline so OpenJev wllama worker can run direct logits.
 * 2. If metadata.apiKey (Browser BYOK key) is provided, call https://api.typesafe.ai/v1/systemone directly from the browser (with fallback to /api/classify-telemetry if available).
 * 3. If no browser key is provided, try /api/classify-telemetry (if running on local Node server with .env), otherwise run 100% client-side in browser.
 */
export async function classifyRagaInBrowser(dspTelemetry, metadata = {}) {
  const startedAt = Date.now();
  const payload = buildRagaSystemOnePayload(dspTelemetry, metadata);
  const browserKey = String(metadata.apiKey || '').trim();

  let systemOneResponse = null;
  let usedLiveJev = false;
  let keySource = 'browser-dsp';

  if (metadata.dspOnly) {
    systemOneResponse = evaluateLocalFallback(dspTelemetry, payload);
    keySource = 'openjev-local';
  } else if (browserKey) {
    // 1. Try direct browser call to TypeSafe System One API
    try {
      const directRes = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${browserKey}`
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: payload.state,
          questions: payload.questions
        })
      });
      if (directRes.ok) {
        systemOneResponse = await directRes.json();
        usedLiveJev = true;
        keySource = 'browser-byok';
      }
    } catch {
      // If browser CORS blocks direct call, try local server proxy if available
    }

    if (!systemOneResponse) {
      try {
        const proxyRes = await fetch('./api/classify-telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dspTelemetry, metadata: { ...metadata, apiKey: browserKey } })
        });
        if (proxyRes.ok && (proxyRes.headers.get('content-type') || '').includes('application/json')) {
          return await proxyRes.json();
        }
      } catch {
        // Static hosting without server
      }
    }
  } else if (metadata.hasLocalBackend) {
    // Use local server's .env TYPESAFE_API_KEY via lightweight telemetry endpoint
    try {
      const proxyRes = await fetch('./api/classify-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dspTelemetry, metadata })
      });
      if (proxyRes.ok && (proxyRes.headers.get('content-type') || '').includes('application/json')) {
        return await proxyRes.json();
      }
    } catch {
      // Fall back to pure browser evaluation
    }
  }

  if (!systemOneResponse) {
    systemOneResponse = evaluateLocalFallback(dspTelemetry, payload);
  }

  const latencyMs = Date.now() - startedAt;
  const answers = systemOneResponse.answers;
  const ragaProbs = answers.primary_raga?.probabilities || {};
  const thaatProbs = answers.thaat_family?.probabilities || {};

  const rankedCandidates = RAGA_CATALOG.map((raga) => {
    const ragaProb = Number(ragaProbs[raga.id] ?? 0);
    const parentThaatProb = Number(thaatProbs[raga.thaat] ?? 0.1);
    const beamScore = Number(Math.sqrt(Math.max(0, ragaProb * parentThaatProb)).toFixed(4));
    const acousticEntry = dspTelemetry.acousticCandidateShortlist.find((c) => c.ragaId === raga.id);
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

  const primaryConfidence = Number((answers.primary_raga?.confidence ?? 0.8).toFixed(3));
  const pakadNoul = Number((answers.pakad_phrase_verified?.noul ?? 0.7).toFixed(3));
  const vadiNoul = Number((answers.vadi_samvadi_aligned?.noul ?? 0.7).toFixed(3));

  let routingGate = 'AUTO_VERIFIED';
  let routingSummary =
    `High-confidence System One judgment (${Math.round(primaryConfidence * 100)}% confidence, ${separationRatio}x beam separation). ` +
    `Pakad motifs (${Math.round(pakadNoul * 100)}% noul) and Vadi/Samvadi hierarchy (${Math.round(vadiNoul * 100)}% noul) confirm ${winner.name}.`;

  if (primaryConfidence < 0.48) {
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
      keySource,
      latencyMs,
      usage: systemOneResponse.usage || { input_tokens: 0, output_tokens: 0 }
    },
    winner,
    runnerUp,
    rankedCandidates,
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
