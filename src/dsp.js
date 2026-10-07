import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SWARA_TABLE, RAGA_CATALOG } from './raga-catalog.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Decode an audio Buffer or file path (.mp3, .wav, .m4a, .ogg, .flac) to 16kHz mono Float32 PCM using ffmpeg.
 */
export function decodeAudioToPCM(inputBufferOrPath, sampleRate = 16000) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(inputBufferOrPath);
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', isBuffer ? 'pipe:0' : String(inputBufferOrPath),
      '-f', 'f32le',
      '-ac', '1',
      '-ar', String(sampleRate),
      'pipe:1'
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';

    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      }
      const rawBuf = Buffer.concat(chunks);
      const floatCount = Math.floor(rawBuf.byteLength / 4);
      const samples = new Float32Array(floatCount);
      for (let i = 0; i < floatCount; i++) {
        samples[i] = rawBuf.readFloatLE(i * 4);
      }
      resolve({ samples, sampleRate, durationSec: Number((floatCount / sampleRate).toFixed(2)) });
    });

    if (isBuffer) {
      proc.stdin.write(inputBufferOrPath);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * Estimate fundamental frequency f0 for a single frame using normalized autocorrelation / YIN difference.
 */
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

  // Difference function d(tau) and cumulative mean normalized difference d'(tau)
  const diff = new Float32Array(maxLag + 1);
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    const limit = n - maxLag;
    for (let i = 0; i < limit; i++) {
      const delta = frame[i] - frame[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
    runningSum += sum;
    cmnd[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1;
  }

  // Find first minimum of cmnd below threshold
  const threshold = 0.18;
  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmnd[tau] < minVal) {
        minVal = cmnd[tau];
        bestTau = tau;
      }
    }
    if (minVal > 0.42) {
      return { f0: 0, clarity: 0, rms };
    }
  }

  // Parabolic interpolation around bestTau
  let refinedTau = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const y0 = cmnd[bestTau - 1];
    const y1 = cmnd[bestTau];
    const y2 = cmnd[bestTau + 1];
    const denom = 2 * (2 * y1 - y2 - y0);
    if (Math.abs(denom) > 1e-6) {
      refinedTau = bestTau + (y2 - y0) / denom;
    }
  }

  const f0 = sampleRate / refinedTau;
  const clarity = Math.max(0, Math.min(1, 1 - cmnd[bestTau]));
  return { f0, clarity, rms };
}

/**
 * Convert frequency (Hz) to MIDI float (A4 = 440Hz = 69).
 */
function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Detect Tonic (Sa) pitch class and base Hz from voiced frames, cadential nyasa anchors,
 * and persistent drone/harmonic consonance, or use explicit user override.
 */
function resolveTonic(voicedFrames, tonicOverride = null) {
  if (tonicOverride && tonicOverride !== 'auto') {
    const clean = String(tonicOverride).trim().toUpperCase();
    const pcIndex = NOTE_NAMES.indexOf(clean);
    if (pcIndex !== -1) {
      const midiSa = 48 + pcIndex; // Octave 3 reference (C3 = 48, ~130.81 Hz)
      return {
        noteName: NOTE_NAMES[pcIndex],
        pitchClass: pcIndex,
        tonicHz: Number(midiToFreq(midiSa).toFixed(2)),
        detectionMethod: 'user-specified'
      };
    }
  }

  // 1. Accumulate pitch class salience weighted by clarity and stability
  const pcHist = new Float64Array(12);
  for (let i = 0; i < voicedFrames.length; i++) {
    const { f0, clarity } = voicedFrames[i];
    const midi = freqToMidi(f0);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    let stabilityBonus = 1.0;
    if (i > 0 && Math.abs(freqToMidi(voicedFrames[i - 1].f0) - midi) < 0.25) {
      stabilityBonus = 1.6;
    }
    pcHist[pc] += clarity * stabilityBonus;
  }

  const totalWeight = pcHist.reduce((a, b) => a + b, 0) || 1;

  // 2. Opening & Final Cadential (Nyasa) Resolution Anchors
  // In Indian classical music, phrases/recordings establish Sa at the start and resolve to Sa at the end.
  const openingWindow = voicedFrames.slice(0, Math.min(35, Math.floor(voicedFrames.length * 0.12)));
  const closingWindow = voicedFrames.slice(Math.max(0, voicedFrames.length - Math.min(45, Math.floor(voicedFrames.length * 0.15))));

  const openingPc = new Float64Array(12);
  for (const vf of openingWindow) {
    const pc = ((Math.round(freqToMidi(vf.f0)) % 12) + 12) % 12;
    openingPc[pc] += vf.clarity;
  }
  const closingPc = new Float64Array(12);
  for (const vf of closingWindow) {
    const pc = ((Math.round(freqToMidi(vf.f0)) % 12) + 12) % 12;
    closingPc[pc] += vf.clarity;
  }

  const openTotal = openingPc.reduce((a, b) => a + b, 0) || 1;
  const closeTotal = closingPc.reduce((a, b) => a + b, 0) || 1;

  // 3. Score each candidate pitch class as Shadja (Sa)
  let bestPc = 2; // Default D
  let bestScore = -1;
  for (let pc = 0; pc < 12; pc++) {
    const saShare = pcHist[pc] / totalWeight;
    const paShare = pcHist[(pc + 7) % 12] / totalWeight;
    const ma1Share = pcHist[(pc + 5) % 12] / totalWeight;
    const ma2Share = pcHist[(pc + 6) % 12] / totalWeight;

    const openShare = openingPc[pc] / openTotal;
    const closeShare = closingPc[pc] / closeTotal;

    // A valid Indian raga tonic almost always has strong Fifth (Pa) or Fourth (Ma1/Ma2) support
    const fifthOrFourthSupport = Math.max(paShare, ma1Share, ma2Share);

    // Check how well the pitch histogram rotated to `pc` as Sa fits known Raga scale templates
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
      ma1Share * 0.40 +
      fifthOrFourthSupport * 0.35 +
      openShare * 0.75 +
      closeShare * 1.15 +
      Math.max(0, bestTemplateFit) * 0.85;

    if (score > bestScore) {
      bestScore = score;
      bestPc = pc;
    }
  }

  const midiSa = 48 + bestPc; // C3..B3 reference
  return {
    noteName: NOTE_NAMES[bestPc],
    pitchClass: bestPc,
    tonicHz: Number(midiToFreq(midiSa).toFixed(2)),
    detectionMethod: 'cadential-drone-harmonic-lock'
  };
}

/**
 * Full deterministic DSP analysis of mono Float32 PCM audio for Indian Classical Raga telemetry.
 */
export function analyzeRagaAudioPCM(samples, sampleRate = 16000, options = {}) {
  const windowSize = Math.round(sampleRate * 0.04); // 40ms
  const hopSize = Math.round(sampleRate * 0.015);   // 15ms hop
  const maxFrames = Math.min(Math.floor((samples.length - windowSize) / hopSize), 6000); // up to 90s analyzed

  const rawFrames = [];
  const voicedFrames = [];

  for (let idx = 0; idx < maxFrames; idx++) {
    const start = idx * hopSize;
    const slice = samples.subarray(start, start + windowSize);
    const timeSec = Number(((start + windowSize / 2) / sampleRate).toFixed(3));
    const { f0, clarity, rms } = detectFramePitch(slice, sampleRate);
    const frameObj = { index: idx, timeSec, f0, clarity, rms };
    rawFrames.push(frameObj);
    if (f0 > 0 && clarity >= 0.55) {
      voicedFrames.push(frameObj);
    }
  }

  const tonic = resolveTonic(voicedFrames, options.tonicNote);
  const swaraDwellCounts = new Float64Array(12);
  const swaraCentDeviations = Array.from({ length: 12 }, () => []);
  const swaraOscillationEnergy = new Float64Array(12);

  const rawContour = [];
  let prevCentsUnwrapped = null;

  const rawUnwrappedList = voicedFrames.map((vf) => 1200 * Math.log2(vf.f0 / tonic.tonicHz));
  const sortedRaw = [...rawUnwrappedList].sort((a, b) => a - b);
  const medianRawCents = sortedRaw.length > 0 ? sortedRaw[Math.floor(sortedRaw.length / 2)] : 500;
  const baseOctaveCents = Math.round((medianRawCents - 500) / 1200) * 1200;

  for (let i = 0; i < voicedFrames.length; i++) {
    const vf = voicedFrames[i];
    const exactSemitonesFromSa = 12 * Math.log2(vf.f0 / tonic.tonicHz);
    const normalizedCents = ((exactSemitonesFromSa * 100) % 1200 + 1200) % 1200;

    // Nearest semitone 0..11
    const nearestSemitone = Math.round(normalizedCents / 100) % 12;
    const nominalCents = nearestSemitone * 100;
    let centDev = normalizedCents - nominalCents;
    if (centDev > 600) centDev -= 1200;
    if (centDev < -600) centDev += 1200;

    swaraDwellCounts[nearestSemitone] += vf.clarity;
    swaraCentDeviations[nearestSemitone].push(centDev);

    if (prevCentsUnwrapped !== null) {
      const delta = Math.abs(exactSemitonesFromSa * 100 - prevCentsUnwrapped);
      if (delta > 12 && delta < 140) {
        swaraOscillationEnergy[nearestSemitone] += delta / 100;
      }
    }
    prevCentsUnwrapped = exactSemitonesFromSa * 100;

    let shifted = exactSemitonesFromSa * 100 - baseOctaveCents;
    while (shifted < -220) shifted += 1200;
    while (shifted > 1260) shifted -= 1200;

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

  const pitchContour = [];
  const step = Math.max(1, Math.floor(rawContour.length / 720));
  for (let i = 0; i < rawContour.length; i += step) {
    const pt = rawContour[i];
    let cSmooth = smoothedCents[i];

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

  // Segment voiced frames into discrete stabilized Swara notes to extract Aroha, Avaroha, Nyasa, and Pakad n-grams
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
        if (
          stabilizedNotes.length === 0 ||
          stabilizedNotes[stabilizedNotes.length - 1].swara !== currentRunSwara
        ) {
          stabilizedNotes.push({
            swara: currentRunSwara,
            semitone: currentRunSemitone,
            durationFrames: currentRunFrames
          });
        } else {
          stabilizedNotes[stabilizedNotes.length - 1].durationFrames += currentRunFrames;
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
    if (
      stabilizedNotes.length === 0 ||
      stabilizedNotes[stabilizedNotes.length - 1].swara !== currentRunSwara
    ) {
      stabilizedNotes.push({
        swara: currentRunSwara,
        semitone: currentRunSemitone,
        durationFrames: currentRunFrames
      });
    }
  }

  // Extract 3-grams, 4-grams, ascending (Aroha) and descending (Avaroha) runs, and Nyasa (long sustained resting notes)
  const ngramCounts = new Map();
  const arohaSet = new Set(['S']);
  const avarohaSet = new Set(['S']);
  const nyasaCounts = new Map();

  for (let i = 0; i < stabilizedNotes.length; i++) {
    const note = stabilizedNotes[i];
    if (note.durationFrames >= 10) {
      nyasaCounts.set(note.swara, (nyasaCounts.get(note.swara) || 0) + note.durationFrames);
    }
    if (i >= 1) {
      const prev = stabilizedNotes[i - 1];
      const diff = ((note.semitone - prev.semitone) + 12) % 12;
      if (diff > 0 && diff <= 5) {
        arohaSet.add(prev.swara);
        arohaSet.add(note.swara);
      } else if (diff >= 7 && diff < 12) {
        avarohaSet.add(prev.swara);
        avarohaSet.add(note.swara);
      }
    }
    if (i >= 2) {
      const tri = `${stabilizedNotes[i - 2].swara} ${stabilizedNotes[i - 1].swara} ${stabilizedNotes[i].swara}`;
      ngramCounts.set(tri, (ngramCounts.get(tri) || 0) + 1);
    }
    if (i >= 3) {
      const quad = `${stabilizedNotes[i - 3].swara} ${stabilizedNotes[i - 2].swara} ${stabilizedNotes[i - 1].swara} ${stabilizedNotes[i].swara}`;
      ngramCounts.set(quad, (ngramCounts.get(quad) || 0) + 1);
    }
  }

  const topNgrams = Array.from(ngramCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([phrase, count]) => ({ phrase, count }));

  // Determine Vadi (dominant non-Sa swara) and Samvadi (second dominant or consonant 4th/5th partner)
  const nonSaRanked = SWARA_TABLE
    .filter((s) => s.index !== 0 && swaraDistribution[s.id] >= 0.03)
    .map((s) => {
      const nyasaBonus = (nyasaCounts.get(s.id) || 0) * 0.0015;
      // Slight priority to melodic swaras over pure Pa drone when comparable
      const droneDiscount = s.id === 'P' ? 0.78 : 1.0;
      return {
        id: s.id,
        index: s.index,
        score: (swaraDistribution[s.id] + nyasaBonus) * droneDiscount,
        share: swaraDistribution[s.id]
      };
    })
    .sort((a, b) => b.score - a.score);

  const detectedVadi = nonSaRanked[0]?.id || 'G3';
  const detectedSamvadi =
    nonSaRanked.find(
      (cand) =>
        cand.id !== detectedVadi &&
        ([5, 7].includes(Math.abs(cand.index - (nonSaRanked[0]?.index || 0))) || cand.share >= 0.08)
    )?.id ||
    nonSaRanked[1]?.id ||
    'N3';

  const nyasaSwaras = Array.from(nyasaCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([swara]) => swara);

  const swaraOrder = SWARA_TABLE.map((s) => s.id);
  const arohaSwaras = swaraOrder.filter((id) => arohaSet.has(id) && activeSwaras.includes(id));
  const avarohaSwaras = [...swaraOrder].reverse().filter((id) => avarohaSet.has(id) && activeSwaras.includes(id));

  const activeCount = activeSwaras.length;
  const inferredJati =
    activeCount <= 5
      ? 'Audava (5-note Pentatonic)'
      : activeCount === 6
        ? 'Shadava (6-note Hexatonic)'
        : 'Sampurna (7-note Heptatonic)';

  // Compute deterministic acoustic-grammar match score against each Raga in RAGA_CATALOG
  const allDetectedPhrases = topNgrams.map((n) => n.phrase).join(' | ');
  const sequenceStr = stabilizedNotes.map((n) => n.swara).join(' ');

  const candidateMatches = RAGA_CATALOG.map((raga) => {
    // 1. Swara coverage & varjya penalty
    let swaraRecall = 0;
    for (const s of raga.swaras) {
      swaraRecall += swaraDistribution[s] || 0;
    }
    let varjyaLeakage = 0;
    for (const v of raga.varjya) {
      varjyaLeakage += swaraDistribution[v] || 0;
    }

    // 2. Pakad n-gram matches in sequenceStr
    const matchedPakads = raga.pakadNgrams.filter(
      (ng) => sequenceStr.includes(ng) || allDetectedPhrases.includes(ng)
    );
    const pakadScore = raga.pakadNgrams.length > 0 ? matchedPakads.length / raga.pakadNgrams.length : 0;

    // 3. Exact scale set Jaccard similarity
    const activeSet = new Set(activeSwaras);
    const ragaSet = new Set(raga.swaras);
    const intersection = raga.swaras.filter((s) => activeSet.has(s)).length;
    const union = new Set([...activeSwaras, ...raga.swaras]).size || 1;
    const jaccard = intersection / union;

    // 4. Vadi / Samvadi alignment
    const vadiBonus =
      (detectedVadi === raga.vadi ? 0.14 : 0) +
      (detectedSamvadi === raga.samvadi || detectedVadi === raga.samvadi ? 0.08 : 0);

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

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`${cmd} exited with ${code}: ${stderr.trim() || stdout.trim()}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Fetch a real vocal recording from YouTube via yt-dlp (by URL or search query),
 * scan 26-second windows to skip spoken intros and isolate pure singing, and export a normalized MP3 clip.
 */
export async function fetchYoutubeVocalClip(queryOrUrl, samplesDir, sampleRate = 16000) {
  const input = String(queryOrUrl || '').trim();
  if (!input) {
    throw new Error('Missing YouTube URL or search query');
  }

  const isUrl = /^https?:\/\//i.test(input);
  const targetSpec = isUrl ? input : `ytsearch1:${input}`;

  // 1. Fetch video metadata (id, title, webpage_url)
  const metaRes = await runCommand('yt-dlp', [
    '--no-playlist',
    '--dump-single-json',
    '--flat-playlist',
    targetSpec
  ]);

  const parsedMeta = JSON.parse(metaRes.stdout);
  const entry = parsedMeta.entries ? parsedMeta.entries[0] : parsedMeta;
  if (!entry || !entry.id) {
    throw new Error(`No YouTube video found for: ${input}`);
  }

  const videoId = String(entry.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const title = entry.title || `YouTube Vocal (${videoId})`;
  const webpageUrl = entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${videoId}`;

  const tmpRawMp3 = path.join(os.tmpdir(), `raga-yt-raw-${videoId}.mp3`);
  const outFilename = `yt-${videoId}.mp3`;
  const outMp3Path = path.join(samplesDir, outFilename);

  if (!fs.existsSync(tmpRawMp3)) {
    await runCommand('yt-dlp', [
      '--no-playlist',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--download-sections', '*0:00-1:40',
      '-o', tmpRawMp3,
      `https://www.youtube.com/watch?v=${videoId}`
    ]);
  }

  const { samples: fullSamples } = await decodeAudioToPCM(tmpRawMp3, sampleRate);
  const totalSec = fullSamples.length / sampleRate;

  // 2. Slide a 26s window across the track to skip spoken English/Hindi intros and lock onto pure vocal swaras
  let bestWindow = { startSec: 0, durationSec: Math.min(26, totalSec), score: -1 };
  const windowDur = 26;

  if (totalSec > windowDur + 4) {
    for (let startSec = 0; startSec <= totalSec - 14; startSec += 4) {
      const endSec = Math.min(totalSec, startSec + windowDur);
      if (endSec - startSec < 12) continue;
      const slice = fullSamples.subarray(
        Math.floor(startSec * sampleRate),
        Math.floor(endSec * sampleRate)
      );
      const tel = analyzeRagaAudioPCM(slice, sampleRate);
      const topFit = tel.acousticCandidateShortlist[0]?.acousticFitScore || 0;
      const clarity = tel.ornamentation.meanPitchClarity || 0;
      const voicedRatio = Math.min(1, tel.audioSummary.voicedFrameCount / 600);
      const windowScore = topFit * 1.3 + clarity * 0.6 + voicedRatio * 0.4;
      if (windowScore > bestWindow.score) {
        bestWindow = {
          startSec,
          durationSec: Math.round(endSec - startSec),
          score: windowScore
        };
      }
    }
  }

  // 3. Export the trimmed vocal window to public/samples/yt-<id>.mp3 so the browser player can stream it
  await runCommand('ffmpeg', [
    '-y',
    '-ss', String(bestWindow.startSec),
    '-t', String(bestWindow.durationSec),
    '-i', tmpRawMp3,
    '-af', `afade=t=in:st=0:d=0.35,afade=t=out:st=${Math.max(0.5, bestWindow.durationSec - 0.5)}:d=0.5`,
    '-ac', '1',
    '-ar', '44100',
    '-b:a', '128k',
    outMp3Path
  ]);

  const { samples } = await decodeAudioToPCM(outMp3Path, sampleRate);
  return {
    videoId,
    title,
    youtubeUrl: webpageUrl,
    windowStartSec: bestWindow.startSec,
    windowEndSec: bestWindow.startSec + bestWindow.durationSec,
    publicAudioUrl: `/samples/${outFilename}`,
    filename: outFilename,
    samples,
    sampleRate
  };
}

