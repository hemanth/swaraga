import {
  SWARA_TABLE,
  THAAT_FAMILIES,
  RAGA_CATALOG,
  decodeAudioInBrowser,
  analyzeRagaAudioPCM,
  classifyRagaInBrowser
} from './raga-browser-engine.js?v=3';

const SWARA_LIST = [
  { index: 0, id: 'S', label: 'Shadja (Sa)' },
  { index: 1, id: 'r1', label: 'Komal Re (r1)' },
  { index: 2, id: 'R2', label: 'Shuddha Re (R2)' },
  { index: 3, id: 'g2', label: 'Komal Ga (g2)' },
  { index: 4, id: 'G3', label: 'Shuddha Ga (G3)' },
  { index: 5, id: 'M1', label: 'Shuddha Ma (M1)' },
  { index: 6, id: 'M2', label: 'Teevra Ma (M2)' },
  { index: 7, id: 'P', label: 'Pancham (Pa)' },
  { index: 8, id: 'd1', label: 'Komal Dha (d1)' },
  { index: 9, id: 'D2', label: 'Shuddha Dha (D2)' },
  { index: 10, id: 'n2', label: 'Komal Ni (n2)' },
  { index: 11, id: 'N3', label: 'Shuddha Ni (N3)' }
];

let catalogData = null;
let currentClassification = null;
let activeSampleUrl = null;
let mediaRecorder = null;
let isRecording = false;
let hasLocalBackend = false;
let revealTimers = [];

// OpenJev (openjev.com) In-Browser Wllama Worker state
let openjevWorker = null;
let openjevLoadedModel = null;
let openjevLoadingModel = null;
let openjevPendingEvalResolve = null;

const audioEl = document.getElementById('raga-audio-el');
const tonicSelect = document.getElementById('tonic-select');
const dropzone = document.getElementById('mp3-dropzone');
const fileInput = document.getElementById('mp3-file-input');
const btnBrowse = document.getElementById('btn-browse-mp3');
const btnMic = document.getElementById('btn-mic-record');
const micBtnLabel = document.getElementById('mic-btn-label');
const samplePillsEl = document.getElementById('sample-pills');
const pitchCanvas = document.getElementById('pitch-contour-canvas');

const engineModeSelect = document.getElementById('engine-mode-select');
const byokKeyGroup = document.getElementById('byok-key-group');
const jevApiKeyInput = document.getElementById('jev-api-key-input');
const btnSaveApiKey = document.getElementById('btn-save-api-key');
const apiKeyStatusBadge = document.getElementById('api-key-status-badge');
const openjevControls = document.getElementById('openjev-controls');
const openjevStatusText = document.getElementById('openjev-status-text');
const btnLoadOpenjev = document.getElementById('btn-load-openjev');
const loadOpenjevLabel = document.getElementById('load-openjev-label');

function getBrowserApiKey() {
  try {
    return (jevApiKeyInput?.value || localStorage.getItem('typesafe_jev_api_key') || '').trim();
  } catch {
    return (jevApiKeyInput?.value || '').trim();
  }
}

function isOpenJevSelected() {
  return String(engineModeSelect?.value || '').startsWith('openjev:');
}

function getSelectedOpenJevModelId() {
  const val = String(engineModeSelect?.value || '');
  return val.startsWith('openjev:') ? val.slice('openjev:'.length) : 'qwen3-0.6b';
}

function updateApiKeyBadge() {
  const k = getBrowserApiKey();
  if (apiKeyStatusBadge) {
    apiKeyStatusBadge.textContent = k
      ? 'BROWSER KEY ACTIVE'
      : hasLocalBackend
        ? 'SERVER .ENV'
        : 'OPENJEV LOCAL (NO KEY)';
  }
}

try {
  const savedKey = localStorage.getItem('typesafe_jev_api_key') || '';
  if (savedKey && jevApiKeyInput) {
    jevApiKeyInput.value = savedKey;
  }
} catch {
  // ignore storage errors
}
updateApiKeyBadge();

function ensureOpenJevWorker() {
  if (openjevWorker) return openjevWorker;
  openjevWorker = new Worker('./openjev-worker.js?v=3', { type: 'module' });
  const headerStatusEl = document.getElementById('engine-status-text');
  openjevWorker.addEventListener('message', ({ data }) => {
    if (data.type === 'loading') {
      if (openjevStatusText) openjevStatusText.textContent = data.message;
      if (loadOpenjevLabel) loadOpenjevLabel.textContent = 'Loading...';
      if (headerStatusEl && !currentClassification) {
        headerStatusEl.textContent = `OPENJEV · LOADING LOCAL MODEL`;
      }
    } else if (data.type === 'progress') {
      if (openjevStatusText) openjevStatusText.textContent = data.text;
      if (headerStatusEl && typeof data.percent === 'number' && !currentClassification) {
        headerStatusEl.textContent = `OPENJEV · LOADING ${data.percent}%`;
      }
    } else if (data.type === 'ready') {
      openjevLoadedModel = data.modelId;
      openjevLoadingModel = null;
      if (openjevStatusText) {
        openjevStatusText.textContent = `${data.modelName} Ready (warmup ${data.warmupMs}ms · 1-token direct logit readout)`;
      }
      if (loadOpenjevLabel) loadOpenjevLabel.textContent = `${data.modelName} Loaded`;
      if (headerStatusEl && !currentClassification) {
        headerStatusEl.textContent = `OPENJEV ${data.modelId.toUpperCase()} · READY`;
      }
      if (currentClassification) {
        applyOpenJevToClassification(currentClassification);
      }
    } else if (data.type === 'evaluated') {
      if (openjevPendingEvalResolve) {
        openjevPendingEvalResolve(data);
        openjevPendingEvalResolve = null;
      }
    } else if (data.type === 'error') {
      openjevLoadingModel = null;
      if (openjevStatusText) openjevStatusText.textContent = `OpenJev Error: ${data.message}`;
      if (loadOpenjevLabel) loadOpenjevLabel.textContent = 'Retry Load Model';
      if (openjevPendingEvalResolve) {
        openjevPendingEvalResolve(null);
        openjevPendingEvalResolve = null;
      }
    }
  });
  return openjevWorker;
}

function triggerOpenJevLoad(modelId = getSelectedOpenJevModelId()) {
  if (openjevLoadedModel === modelId || openjevLoadingModel === modelId) return;
  openjevLoadingModel = modelId;
  const worker = ensureOpenJevWorker();
  worker.postMessage({ type: 'load', modelId });
}

async function applyOpenJevToClassification(data) {
  if (!catalogData) return data;
  if (!isOpenJevSelected() && engineModeSelect) {
    engineModeSelect.value = 'openjev:qwen3-0.6b';
    syncEngineModeUI();
  }
  const targetModelId = getSelectedOpenJevModelId();
  const worker = ensureOpenJevWorker();

  if (openjevLoadedModel !== targetModelId) {
    if (openjevStatusText) {
      openjevStatusText.textContent = `Auto-loading ${targetModelId} in browser via WebAssembly (showing acoustic DSP until model warmup completes)...`;
    }
    triggerOpenJevLoad(targetModelId);
    return data;
  }

  if (openjevStatusText) {
    openjevStatusText.textContent = `Running ${targetModelId} 1-token direct logit readout over ${data.rankedCandidates.length} candidates...`;
  }

  const evalRes = await new Promise((resolve) => {
    openjevPendingEvalResolve = resolve;
    worker.postMessage({
      type: 'evaluate',
      payload: {
        state: data.systemOneInspector.state,
        // Shortlisted candidates + open-set option (the full catalog exceeds the 1-token A..Z label space)
        catalogRagas: data.rankedCandidates,
        thaats: catalogData.thaats
      }
    });
  });

  if (!evalRes) return data;

  // Merge OpenJev direct logit probabilities into the classification object
  data.engine = {
    provider: 'OpenJev (openjev.com)',
    model: evalRes.model,
    liveApi: true,
    keySource: 'openjev-browser-wllama',
    latencyMs: evalRes.latencyMs,
    usage: { input_tokens: evalRes.inputTokens, output_tokens: evalRes.readouts }
  };

  data.primitives.choices.primary_raga = {
    type: 'choice',
    choice: evalRes.primary_raga.choice,
    confidence: evalRes.primary_raga.confidence,
    probabilities: evalRes.primary_raga.probabilities
  };
  data.primitives.choices.thaat_family = {
    type: 'choice',
    choice: evalRes.thaat_family.choice,
    confidence: evalRes.thaat_family.confidence,
    probabilities: evalRes.thaat_family.probabilities
  };
  data.primitives.nouls.pakad_phrase_verified = {
    type: 'noul',
    noul: Number(evalRes.pakad_noul.toFixed(3))
  };

  data.rankedCandidates = data.rankedCandidates
    .map((c) => {
      const pRaga = Number(evalRes.primary_raga.probabilities[c.id] ?? c.probability);
      const pThaat = Number(evalRes.thaat_family.probabilities[c.thaat] ?? c.parentThaatProbability);
      const beam = Number(Math.sqrt(Math.max(0, pRaga * pThaat)).toFixed(4));
      return {
        ...c,
        probability: pRaga,
        parentThaatProbability: pThaat,
        hierarchicalBeamScore: beam
      };
    })
    .sort((a, b) => b.probability - a.probability || b.acousticFitScore - a.acousticFitScore);

  data.winner = data.rankedCandidates[0];
  data.runnerUp = data.rankedCandidates[1] || data.rankedCandidates[0];
  data.routing.primaryConfidence = evalRes.primary_raga.confidence;
  data.routing.hierarchicalBeamScore = data.winner.hierarchicalBeamScore;
  data.routing.summary = `Evaluated locally in browser via OpenJev (${evalRes.model}) using 1-token direct option logit readout (${evalRes.latencyMs}ms, zero JSON decoding). Winner: ${data.winner.name}.`;

  if (openjevStatusText) {
    openjevStatusText.textContent = `${evalRes.model} · 3 direct logit readouts in ${evalRes.latencyMs}ms`;
  }
  renderClassification(data);
  return data;
}

// Top Utility Drawers (Engine / BYOK / OpenJev, Eval & Science, & How It Works Architecture)
const btnToggleEngine = document.getElementById('btn-toggle-engine');
const btnCloseEngine = document.getElementById('btn-close-engine');
const drawerEngine = document.getElementById('drawer-engine');

const btnToggleEval = document.getElementById('btn-toggle-eval');
const btnCloseEval = document.getElementById('btn-close-eval');
const drawerEval = document.getElementById('drawer-eval');

const btnToggleArch = document.getElementById('btn-toggle-arch');
const btnCloseArch = document.getElementById('btn-close-arch');
const drawerArch = document.getElementById('drawer-arch');

const btnToggleYt = document.getElementById('btn-toggle-yt');
const youtubeFetchRow = document.getElementById('youtube-fetch-row');

function closeAllDrawersExcept(keepDrawer) {
  for (const [dr, btn] of [
    [drawerEngine, btnToggleEngine],
    [drawerEval, btnToggleEval],
    [drawerArch, btnToggleArch]
  ]) {
    if (dr && dr !== keepDrawer) {
      dr.hidden = true;
      btn?.setAttribute('aria-expanded', 'false');
    }
  }
}

if (btnToggleEngine && drawerEngine) {
  btnToggleEngine.addEventListener('click', () => {
    const willOpen = drawerEngine.hidden;
    closeAllDrawersExcept(drawerEngine);
    drawerEngine.hidden = !willOpen;
    btnToggleEngine.setAttribute('aria-expanded', String(willOpen));
  });
}
if (btnCloseEngine && drawerEngine) {
  btnCloseEngine.addEventListener('click', () => {
    drawerEngine.hidden = true;
    btnToggleEngine?.setAttribute('aria-expanded', 'false');
  });
}

if (btnToggleEval && drawerEval) {
  btnToggleEval.addEventListener('click', () => {
    const willOpen = drawerEval.hidden;
    closeAllDrawersExcept(drawerEval);
    drawerEval.hidden = !willOpen;
    btnToggleEval.setAttribute('aria-expanded', String(willOpen));
  });
}
if (btnCloseEval && drawerEval) {
  btnCloseEval.addEventListener('click', () => {
    drawerEval.hidden = true;
    btnToggleEval?.setAttribute('aria-expanded', 'false');
  });
}

if (btnToggleArch && drawerArch) {
  btnToggleArch.addEventListener('click', () => {
    const willOpen = drawerArch.hidden;
    closeAllDrawersExcept(drawerArch);
    drawerArch.hidden = !willOpen;
    btnToggleArch.setAttribute('aria-expanded', String(willOpen));
  });
}
if (btnCloseArch && drawerArch) {
  btnCloseArch.addEventListener('click', () => {
    drawerArch.hidden = true;
    btnToggleArch?.setAttribute('aria-expanded', 'false');
  });
}

let evalBenchmarkData = null;
let activeEvalSlice = 'all';
let activeProbeId = 'yaman';

function renderEvalMatrixTable() {
  const tbody = document.getElementById('eval-matrix-tbody');
  if (!tbody || !evalBenchmarkData?.engines) return;

  tbody.innerHTML = evalBenchmarkData.engines
    .map((eng, idx) => {
      const isWinner = idx === 0;
      const isMrlRow = eng.id.startsWith('eg2_dsp_text_');
      const isDimmed = activeEvalSlice === 'mrl' && !isMrlRow && idx > 1;
      const delta = eng.slices.tonicDropDelta;
      const deltaStr = `${delta >= 0 ? '+' : ''}${delta}%`;
      const deltaColor = delta <= -20 ? '#f87171' : delta <= -8 ? '#fbbf24' : '#34d399';

      return `
        <tr class="${isWinner ? 'eval-row-winner' : ''} ${isDimmed ? 'eval-row-dimmed' : ''}">
          <td>
            <div style="font-weight:600; color:#fff;">${eng.name}</div>
            <div class="mono-label" style="font-size:0.71rem;">${eng.family} · ${eng.dim}d</div>
          </td>
          <td>
            <div class="mono-value" style="font-size:0.75rem;">${eng.params}</div>
            <div class="mono-label" style="font-size:0.7rem;">${eng.modality}</div>
          </td>
          <td class="${activeEvalSlice === 'all' || activeEvalSlice === 'mrl' ? 'eval-col-focus' : ''}">
            <div class="eval-bar-cell">
              <div style="display:flex; justify-content:space-between; font-family:var(--font-mono);">
                <strong>${eng.top1Accuracy14}%</strong>
                <span class="mono-label" style="font-size:0.7rem;">[${eng.ci95[0]}–${eng.ci95[1]}%]</span>
              </div>
              <div class="eval-bar-track">
                <div class="eval-bar-fill" style="width:${Math.max(4, eng.top1Accuracy14)}%;"></div>
              </div>
            </div>
          </td>
          <td class="${activeEvalSlice === 'mrl' ? 'eval-col-focus' : ''}" style="font-family:var(--font-mono);">
            ${eng.top3Recall14}%
          </td>
          <td style="font-family:var(--font-mono);">
            <strong>${eng.top1Accuracy962}%</strong> <span class="mono-label">/ ${eng.top5Recall962}%</span>
          </td>
          <td style="font-family:var(--font-mono);">${eng.macroF1}%</td>
          <td class="${activeEvalSlice === 'tonic' ? 'eval-col-focus' : ''}" style="font-family:var(--font-mono);">
            ${eng.slices.canonicalTonic}%
          </td>
          <td class="${activeEvalSlice === 'tonic' ? 'eval-col-focus' : ''}" style="font-family:var(--font-mono);">
            ${eng.slices.transposedTonic}% <span style="color:${deltaColor}; font-size:0.74rem;">(${deltaStr})</span>
          </td>
          <td class="${activeEvalSlice === 'sibling' ? 'eval-col-focus' : ''}" style="font-family:var(--font-mono);">
            <strong>${eng.slices.siblingPairs}%</strong>
          </td>
          <td style="font-family:var(--font-mono); white-space:nowrap;">
            ${eng.latency.p50Ms} ms <span class="mono-label" style="font-size:0.69rem;">(p95 ${Math.round(eng.latency.p95Ms)})</span>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderEvalProbeStage(probeId = activeProbeId) {
  activeProbeId = probeId;
  const stage = document.getElementById('eval-probe-stage');
  const probe = evalBenchmarkData?.sampleProbes?.[probeId];
  if (!stage || !probe) return;

  document.querySelectorAll('#eval-probe-pills [data-probe-id]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-probe-id') === probeId);
  });

  const renderTopList = (items = [], metricLabel = 'cos') =>
    items
      .map((item, i) => {
        const isHit = item.id === probe.id;
        const cls = i === 0 ? (isHit ? 'hit' : 'miss') : isHit ? 'hit' : '';
        return `
          <div class="eval-probe-rank ${cls}">
            <span>#${i + 1} ${item.name.replace('Raga ', '')}</span>
            <span>${metricLabel}=${Number(item.score).toFixed(4)}</span>
          </div>
        `;
      })
      .join('');

  stage.innerHTML = `
    <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid var(--card-border);">
      <span class="mono-value">Ground Truth: <strong>${probe.label}</strong></span>
      <span class="mono-label">YIN Tonic: <strong>${probe.detectedTonic}</strong> · Swaras: <strong>${probe.activeSwaras}</strong> · Vadi: <strong>${probe.detectedVadi}</strong></span>
    </div>
    <div class="mono-label" style="margin-top:8px; font-size:0.72rem; word-break:break-word; opacity:0.85;">
      <strong>EmbeddingGemma 2 Asymmetric Query:</strong> <code>${probe.queryText}</code>
    </div>
    <div class="eval-probe-grid">
      <div class="eval-probe-col">
        <div class="mono-label">1. SWARAGA (YIN + SYSTEM ONE)</div>
        ${renderTopList(probe.systemOneTop3, 'P')}
      </div>
      <div class="eval-probe-col">
        <div class="mono-label">2. EMBEDDINGGEMMA 2 HYBRID (768d)</div>
        ${renderTopList(probe.eg2Hybrid768Top3, 'cos')}
      </div>
      <div class="eval-probe-col">
        <div class="mono-label">3. EMBEDDINGGEMMA 2 MRL (128d)</div>
        ${renderTopList(probe.eg2Hybrid128Top3, 'cos')}
      </div>
      <div class="eval-probe-col">
        <div class="mono-label">4. EG2 ZERO-SHOT (AUDIO→TEXT)</div>
        ${renderTopList(probe.eg2ZeroShotTop3, 'cos')}
      </div>
    </div>
  `;
}

async function initEvalScienceTab() {
  try {
    const res = await fetch('./eval-results.json');
    if (res.ok) {
      evalBenchmarkData = await res.json();
      renderEvalMatrixTable();
      renderEvalProbeStage(activeProbeId);
    }
  } catch (err) {
    console.warn('Could not load eval-results.json:', err);
  }

  document.querySelectorAll('.eval-slice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeEvalSlice = btn.getAttribute('data-eval-slice') || 'all';
      document.querySelectorAll('.eval-slice-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderEvalMatrixTable();
    });
  });

  document.querySelectorAll('#eval-probe-pills [data-probe-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderEvalProbeStage(btn.getAttribute('data-probe-id'));
    });
  });

  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab === 'eval' && drawerEval) {
    closeAllDrawersExcept(drawerEval);
    drawerEval.hidden = false;
    btnToggleEval?.setAttribute('aria-expanded', 'true');
  }
}
initEvalScienceTab();

if (btnToggleYt && youtubeFetchRow) {
  btnToggleYt.addEventListener('click', () => {
    youtubeFetchRow.hidden = !youtubeFetchRow.hidden;
    if (!youtubeFetchRow.hidden) {
      document.getElementById('youtube-url-input')?.focus();
    }
  });
}

function setLoadingState(loading, labelText = '') {
  const titleEl = document.getElementById('dropzone-title');
  const subEl = document.getElementById('dropzone-sub');
  const gateBadge = document.getElementById('routing-gate-badge');
  if (loading) {
    titleEl.textContent = `Classifying "${labelText}" via 16 kHz YIN + ${isOpenJevSelected() ? 'OpenJev' : 'TypeSafe Jev'}...`;
    subEl.textContent = 'Extracting F0 pitch contour, 12-swara dwell histogram, and System One judgments...';
    if (gateBadge) gateBadge.textContent = 'EVALUATING...';
  } else {
    titleEl.textContent = 'Drop an .mp3 / .wav recording here, or sing into the microphone';
    subEl.textContent = 'Decoded locally at 16 kHz via Web Audio API · YIN F0 pitch contour + 10 parallel Jev judgments';
  }
}

async function classifyBySampleUrl(sampleUrl, autoPlay = false) {
  const relUrl = sampleUrl.startsWith('/') ? `.${sampleUrl}` : sampleUrl;
  activeSampleUrl = relUrl;
  const sampleMeta = catalogData?.samples?.find(
    (s) => s.sampleUrl === sampleUrl || `.${s.sampleUrl}` === relUrl
  );
  const filename = sampleMeta?.vocalSource || sampleUrl.split('/').pop();
  document.getElementById('active-track-name').textContent = filename;

  const ytLink = document.getElementById('active-yt-link');
  if (ytLink && sampleMeta?.youtubeUrl) {
    ytLink.href = sampleMeta.youtubeUrl;
    ytLink.style.display = 'inline';
  }

  audioEl.src = relUrl;
  if (autoPlay) {
    audioEl.play().catch(() => {});
  }

  document.querySelectorAll('.sample-pill').forEach((pill) => {
    const pillUrl = pill.getAttribute('data-url');
    pill.classList.toggle('active', pillUrl === sampleUrl || `.${pillUrl}` === relUrl);
  });

  setLoadingState(true, filename);
  try {
    // 1. Decode MP3 -> 16kHz mono Float32 PCM directly in the browser via Web Audio API
    const { samples, sampleRate } = await decodeAudioInBrowser(relUrl, 16000);
    // 2. Run 12-Swara YIN pitch tracking + Tonic lock + Pakad n-gram DSP in browser
    const dspTelemetry = analyzeRagaAudioPCM(samples, sampleRate, { tonicNote: tonicSelect.value });
    // 3. Classify via browser BYOK TypeSafe API, OpenJev wllama, or local backend / in-browser DSP
    const data = await classifyRagaInBrowser(dspTelemetry, {
      filename,
      apiKey: getBrowserApiKey(),
      dspOnly: isOpenJevSelected() || (!hasLocalBackend && !getBrowserApiKey()),
      hasLocalBackend
    });
    currentClassification = data;
    renderClassification(data);
    if (isOpenJevSelected() || (!data.engine.liveApi && !getBrowserApiKey())) {
      await applyOpenJevToClassification(data);
    }
  } catch (err) {
    document.getElementById('routing-summary').textContent = `Error: ${err.message}`;
  } finally {
    setLoadingState(false);
  }
}

async function classifyByYoutubeUrl(youtubeQuery) {
  const q = String(youtubeQuery || '').trim();
  if (!q) return;
  const ytBtnLabel = document.getElementById('yt-btn-label');
  if (ytBtnLabel) ytBtnLabel.textContent = 'Fetching via yt-dlp...';
  setLoadingState(true, `YouTube: ${q}`);

  try {
    const res = await fetch('./api/classify-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: q,
        tonicNote: tonicSelect.value,
        apiKey: getBrowserApiKey(),
        dspOnly: isOpenJevSelected()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'YouTube extraction failed');

    if (data.youtubeClip) {
      activeSampleUrl = data.youtubeClip.publicAudioUrl;
      audioEl.src = data.youtubeClip.publicAudioUrl;
      audioEl.play().catch(() => {});
      document.getElementById('active-track-name').textContent =
        `${data.youtubeClip.title} (${data.youtubeClip.windowStartSec}s–${data.youtubeClip.windowEndSec}s)`;
      const ytLink = document.getElementById('active-yt-link');
      if (ytLink && data.youtubeClip.youtubeUrl) {
        ytLink.href = data.youtubeClip.youtubeUrl;
        ytLink.style.display = 'inline';
      }
      document.querySelectorAll('.sample-pill').forEach((pill) => pill.classList.remove('active'));
    }

    currentClassification = data;
    renderClassification(data);
    if (isOpenJevSelected() || (!data.engine.liveApi && !getBrowserApiKey())) {
      await applyOpenJevToClassification(data);
    }
  } catch (err) {
    document.getElementById('routing-summary').textContent = `YouTube Error: ${err.message}`;
  } finally {
    if (ytBtnLabel) ytBtnLabel.textContent = 'Fetch YouTube Vocal';
    setLoadingState(false);
  }
}

async function classifyUploadedFile(file) {
  if (!file) return;
  document.querySelectorAll('.sample-pill').forEach((pill) => pill.classList.remove('active'));
  document.getElementById('active-track-name').textContent = file.name;

  const blobUrl = URL.createObjectURL(file);
  audioEl.src = blobUrl;

  setLoadingState(true, file.name);
  try {
    // Decode uploaded MP3/WAV/WebM directly in browser via Web Audio API (no server upload needed)
    const { samples, sampleRate } = await decodeAudioInBrowser(file, 16000);
    const dspTelemetry = analyzeRagaAudioPCM(samples, sampleRate, { tonicNote: tonicSelect.value });
    const data = await classifyRagaInBrowser(dspTelemetry, {
      filename: file.name,
      apiKey: getBrowserApiKey(),
      dspOnly: isOpenJevSelected() || (!hasLocalBackend && !getBrowserApiKey()),
      hasLocalBackend
    });
    currentClassification = data;
    renderClassification(data);
    if (isOpenJevSelected() || (!data.engine.liveApi && !getBrowserApiKey())) {
      await applyOpenJevToClassification(data);
    }
  } catch (err) {
    document.getElementById('routing-summary').textContent = `Error: ${err.message}`;
  } finally {
    setLoadingState(false);
  }
}

function renderClassification(data) {
  const { winner, routing, primitives, dspTelemetry, engine, systemOneInspector } = data;

  // Engine badge
  const statusText = document.getElementById('engine-status-text');
  const sourceTag =
    engine.keySource === 'browser-byok'
      ? 'BROWSER KEY'
      : engine.keySource === 'openjev-browser-wllama'
        ? 'OPENJEV WLLAMA'
        : engine.liveApi
          ? 'LIVE API'
          : 'DSP BASELINE';
  statusText.textContent = `${engine.model.toUpperCase()} · ${sourceTag} · ${engine.latencyMs}ms`;

  // Active tonic badge
  document.getElementById('active-tonic-badge').textContent =
    `Sa = ${dspTelemetry.tonic.noteName} (${dspTelemetry.tonic.tonicHz} Hz)`;

  // Winner card
  document.getElementById('routing-gate-badge').textContent = routing.gate;
  const tradChoice = primitives.choices.tradition_idiom?.choice || 'dual_canonical';
  document.getElementById('winner-tradition').textContent =
    tradChoice === 'dual_canonical'
      ? 'HINDUSTANI & CARNATIC DUAL EQUIVALENCE'
      : tradChoice === 'carnatic'
        ? 'CARNATIC MELAKARTA / JANYA IDIOM'
        : 'HINDUSTANI CLASSICAL THAAT IDIOM';

  document.getElementById('winner-raga-name').textContent = winner.name;
  document.getElementById('winner-carnatic').textContent = `Carnatic: ${winner.carnaticEquivalent}`;
  document.getElementById('winner-prob').textContent = `${Math.round(winner.probability * 100)}%`;
  document.getElementById('winner-conf').textContent = routing.primaryConfidence.toFixed(2);
  document.getElementById('winner-beam').textContent = routing.hierarchicalBeamScore.toFixed(2);

  document.getElementById('winner-thaat').textContent =
    `${winner.thaat} (P=${Math.round((primitives.choices.thaat_family?.probabilities?.[winner.thaat] ?? 0.8) * 100)}%)`;
  document.getElementById('winner-vadi').textContent =
    `${winner.jati.split(' ')[0]} · Vadi ${winner.vadi} / Samvadi ${winner.samvadi}`;
  document.getElementById('winner-prahar').textContent = winner.prahar;
  document.getElementById('winner-scale').textContent = `${winner.aroha} / ${winner.avaroha}`;
  document.getElementById('winner-pakad').textContent = winner.pakad;
  document.getElementById('routing-summary').textContent = routing.summary;

  // Telemetry phrases
  document.getElementById('contour-stats-badge').textContent =
    `${dspTelemetry.audioSummary.voicedFrameCount} voiced frames · ${dspTelemetry.audioSummary.durationSec}s`;
  document.getElementById('dsp-aroha').textContent =
    dspTelemetry.directionalPhrases.arohaAscendingSwaras || 'S R2 G3 P D2';
  document.getElementById('dsp-avaroha').textContent =
    dspTelemetry.directionalPhrases.avarohaDescendingSwaras || 'D2 P G3 R2 S';
  document.getElementById('dsp-ngrams').textContent =
    (dspTelemetry.directionalPhrases.topRecurringNgrams || [])
      .slice(0, 4)
      .map((n) => `${n.phrase} (${n.count})`)
      .join(' · ') || '—';

  document.getElementById('detected-vadi-badge').textContent =
    `Detected Vadi: ${dspTelemetry.scaleProfile.detectedVadi} · Samvadi: ${dspTelemetry.scaleProfile.detectedSamvadi}`;

  // 12-Swara Histogram Bars
  const swaraContainer = document.getElementById('swara-bars-container');
  const dist = dspTelemetry.swaraDistribution || {};
  const maxShare = Math.max(0.15, ...Object.values(dist));

  swaraContainer.innerHTML = SWARA_LIST.map((s, idx) => {
    const share = dist[s.id] || 0;
    const widthPct = Math.min(100, Math.round((share / maxShare) * 100));
    const isAllowed = winner.swaras.includes(s.id);
    let role = isAllowed ? 'SWARA' : 'VARJYA';
    let strongRole = false;
    if (s.id === 'S') {
      role = 'SHADJA';
      strongRole = true;
    } else if (s.id === dspTelemetry.scaleProfile.detectedVadi) {
      role = 'VADI';
      strongRole = true;
    } else if (s.id === dspTelemetry.scaleProfile.detectedSamvadi) {
      role = 'SAMVADI';
      strongRole = true;
    }

    return `
      <div class="swara-row" style="--stagger-i: ${idx}">
        <span class="swara-id">${s.id}</span>
        <span class="swara-name">${s.label}</span>
        <div class="bar-track">
          <div class="bar-fill ${isAllowed ? '' : 'dim'}" style="width: ${widthPct}%"></div>
        </div>
        <span class="swara-pct">${(share * 100).toFixed(1)}%</span>
        <span class="swara-role ${strongRole ? 'role-strong' : ''}">${role}</span>
      </div>
    `;
  }).join('');

  // 04 // Choice Primitive List
  const choiceContainer = document.getElementById('choice-candidates-list');
  choiceContainer.innerHTML = data.rankedCandidates
    .slice(0, 6)
    .map((c, idx) => {
      const pct = Math.round(c.probability * 100);
      return `
        <div class="choice-item" style="--stagger-i: ${idx}">
          <div class="choice-item-top">
            <span>${idx + 1}. <strong>${c.name}</strong> <span style="color:#a1a1aa">(${c.thaat})</span></span>
            <span>${pct}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${idx === 0 ? '' : 'dim'}" style="width: ${Math.max(3, pct)}%"></div>
          </div>
          <div class="choice-item-sub">
            <span>Beam: ${c.hierarchicalBeamScore.toFixed(2)} · Fit: ${c.acousticFitScore.toFixed(2)}</span>
            <span>Vadi: ${c.vadi}/${c.samvadi}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // 05 // Score Primitives
  const scoreContainer = document.getElementById('score-primitives-container');
  const scoreEntries = [
    {
      key: 'gamaka_ornamentation',
      title: 'gamaka_ornamentation',
      data: primitives.scores.gamaka_ornamentation
    },
    {
      key: 'rasa_emotional_gravity',
      title: 'rasa_emotional_gravity',
      data: primitives.scores.rasa_emotional_gravity
    }
  ];

  scoreContainer.innerHTML = scoreEntries
    .map((entry, idx) => {
      const s = entry.data || { score: 1.5, confidence: 0.8, legend: {} };
      const nearestLevel = Math.round(s.score);
      const pct = Math.min(100, Math.max(0, Math.round((s.score / 3) * 100)));
      const levelDesc = s.legend?.[nearestLevel] || '';
      return `
        <div class="score-card-item" style="--stagger-i: ${idx}">
          <div class="score-header">
            <span>${entry.title}</span>
            <span><strong>${Number(s.score).toFixed(2)}</strong> / 3.00 <span style="color:#71717a">(conf ${Number(s.confidence).toFixed(2)})</span></span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="score-legend-text">Level ${nearestLevel}: ${levelDesc}</div>
        </div>
      `;
    })
    .join('');

  // 05 // Noul Primitives
  const noulContainer = document.getElementById('noul-primitives-container');
  const noulEntries = [
    {
      id: 'pakad_phrase_verified',
      desc: 'Observed n-grams contain the canonical Pakad catch-phrases',
      val: primitives.nouls.pakad_phrase_verified?.noul ?? 0
    },
    {
      id: 'vadi_samvadi_aligned',
      desc: 'Dominant dwell & resting swaras match theoretical Vadi/Samvadi',
      val: primitives.nouls.vadi_samvadi_aligned?.noul ?? 0
    },
    {
      id: 'pentatonic_audava_jati',
      desc: 'Strict 5-note Audava pentatonic scale structure (7 swaras Varjya)',
      val: primitives.nouls.pentatonic_audava_jati?.noul ?? 0
    },
    {
      id: 'sandhiprakash_twilight_character',
      desc: 'Twilight Sandhiprakash signature (Komal r1 + Shuddha G3)',
      val: primitives.nouls.sandhiprakash_twilight_character?.noul ?? 0
    }
  ];

  noulContainer.innerHTML = noulEntries
    .map((n, idx) => {
      const pct = Math.round(n.val * 100);
      return `
        <div class="noul-card-item" style="--stagger-i: ${idx + 2}">
          <div class="noul-header">
            <span>${n.id}</span>
            <span><strong>${n.val.toFixed(2)}</strong> (${pct}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${pct >= 50 ? '' : 'dim'}" style="width: ${pct}%"></div>
          </div>
          <div class="score-legend-text">${n.desc}</div>
        </div>
      `;
    })
    .join('');

  // Assign stagger indices to static sub-items in Card 1 & Card 2
  document.querySelectorAll('.winner-metrics .metric-box').forEach((el, i) => el.style.setProperty('--stagger-i', i));
  document.querySelectorAll('.winner-grammar-grid .grammar-item').forEach((el, i) => el.style.setProperty('--stagger-i', i + 2));
  document.querySelectorAll('.phrase-telemetry-bar > div').forEach((el, i) => el.style.setProperty('--stagger-i', i));

  // Inspector JSON
  document.getElementById('inspector-request-json').textContent = JSON.stringify(
    {
      model: 'jev-latest',
      state: systemOneInspector.state,
      questions: systemOneInspector.questions
    },
    null,
    2
  );
  document.getElementById('inspector-response-json').textContent = JSON.stringify(
    {
      model: engine.model,
      usage: engine.usage,
      answers: systemOneInspector.rawAnswers
    },
    null,
    2
  );

  triggerProgressiveReveal();
}

let scrollObserver = null;
let contourRevealProgress = 1;
let contourSweepRaf = null;

function animateContourSweep() {
  if (contourSweepRaf) cancelAnimationFrame(contourSweepRaf);
  const start = performance.now();
  const duration = 780;
  contourRevealProgress = 0.04;

  const tick = (now) => {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    // Cubic ease-out
    contourRevealProgress = 1 - Math.pow(1 - t, 3);
    drawPitchContourCanvas();
    if (t < 1) {
      contourSweepRaf = requestAnimationFrame(tick);
    } else {
      contourRevealProgress = 1;
      contourSweepRaf = null;
    }
  };
  contourSweepRaf = requestAnimationFrame(tick);
}

function triggerProgressiveReveal() {
  const resultsContainer = document.getElementById('progressive-results');
  if (resultsContainer) {
    resultsContainer.hidden = false;
  }

  for (const timer of revealTimers) {
    clearTimeout(timer);
  }
  revealTimers = [];

  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  const revealCards = document.querySelectorAll('.reveal-card[data-reveal-step]');
  revealCards.forEach((card) => {
    card.classList.remove('is-visible');
    card.classList.add('is-mounted');
  });

  contourRevealProgress = 0.08;
  drawPitchContourCanvas();

  // Reveal Card 1 (01 // IDENTIFIED RAGA) immediately with smooth entrance
  const firstCard = document.querySelector('.reveal-card[data-reveal-step="1"]');
  if (firstCard) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        firstCard.classList.add('is-visible');
      });
    });
  }

  // IntersectionObserver reveals each subsequent card (02..06) as the user scrolls down
  if ('IntersectionObserver' in window) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target;
          const step = card.getAttribute('data-reveal-step');
          if (entry.isIntersecting) {
            if (!card.classList.contains('is-visible')) {
              card.classList.add('is-visible');
              if (step === '2') {
                animateContourSweep();
              }
            }
          } else if (step !== '1' && entry.boundingClientRect.top > window.innerHeight * 0.9) {
            // Reset cards below the fold when scrolling back up so scrolling down animates them again
            card.classList.remove('is-visible');
            if (step === '2') {
              contourRevealProgress = 0.08;
              drawPitchContourCanvas();
            }
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -48px 0px'
      }
    );

    revealCards.forEach((card) => {
      if (card.getAttribute('data-reveal-step') !== '1') {
        scrollObserver.observe(card);
      }
    });
  } else {
    revealCards.forEach((card) => card.classList.add('is-visible'));
    contourRevealProgress = 1;
    drawPitchContourCanvas();
  }
}

const contourLiveBadge = document.getElementById('contour-live-badge');
let contourHoverTimeSec = null;

const SAPTAK_LANES = [
  { cents: -200, id: 'n2', label: 'n2\u0323', sargam: 'ni\u0323' },
  { cents: -100, id: 'N3', label: 'N3\u0323', sargam: 'Ni\u0323' },
  { cents: 0,    id: 'S',  label: 'S',   sargam: 'Sa' },
  { cents: 100,  id: 'r1', label: 'r1',  sargam: 're' },
  { cents: 200,  id: 'R2', label: 'R2',  sargam: 'Re' },
  { cents: 300,  id: 'g2', label: 'g2',  sargam: 'ga' },
  { cents: 400,  id: 'G3', label: 'G3',  sargam: 'Ga' },
  { cents: 500,  id: 'M1', label: 'M1',  sargam: 'Ma' },
  { cents: 600,  id: 'M2', label: 'M2',  sargam: 'Ma#' },
  { cents: 700,  id: 'P',  label: 'P',   sargam: 'Pa' },
  { cents: 800,  id: 'd1', label: 'd1',  sargam: 'dha' },
  { cents: 900,  id: 'D2', label: 'D2',  sargam: 'Dha' },
  { cents: 1000, id: 'n2', label: 'n2',  sargam: 'ni' },
  { cents: 1100, id: 'N3', label: 'N3',  sargam: 'Ni' },
  { cents: 1200, id: 'S',  label: "S'",  sargam: "Sa'" }
];

const SARGAM_SHORT = {
  S: 'Sa', r1: 're', R2: 'Re', g2: 'ga', G3: 'Ga',
  M1: 'Ma', M2: 'Ma#', P: 'Pa', d1: 'dha', D2: 'Dha', n2: 'ni', N3: 'Ni'
};

function drawPitchContourCanvas() {
  if (!pitchCanvas || !currentClassification) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const rect = pitchCanvas.getBoundingClientRect();
  const cssW = Math.max(480, Math.round(rect.width || 920));
  const cssH = Math.max(260, Math.round(rect.height || 360));

  if (pitchCanvas.width !== Math.round(cssW * dpr) || pitchCanvas.height !== Math.round(cssH * dpr)) {
    pitchCanvas.width = Math.round(cssW * dpr);
    pitchCanvas.height = Math.round(cssH * dpr);
  }

  const ctx = pitchCanvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);

  // Studio dark carbon background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, cssW, cssH);

  const { dspTelemetry, winner } = currentClassification;
  const contour = dspTelemetry.pitchContour || [];
  const ribbons = dspTelemetry.noteRibbons || [];
  const totalDur = Math.max(1, dspTelemetry.audioSummary?.durationSec || 12);

  const padLeft = 68;
  const padRight = 56;
  const padTop = 20;
  const padBottom = 28;
  const plotW = cssW - padLeft - padRight;
  const plotH = cssH - padTop - padBottom;

  const minCents = -230;
  const maxCents = 1250;
  const centsSpan = maxCents - minCents;
  const centsToY = (c) => {
    const clamped = Math.max(minCents, Math.min(maxCents, c));
    return padTop + plotH - ((clamped - minCents) / centsSpan) * plotH;
  };
  const timeToX = (t) => padLeft + (Math.max(0, Math.min(totalDur, t)) / totalDur) * plotW;

  // 1. Vertical time grid & bottom axis ticks
  const stepSec = totalDur <= 10 ? 2 : totalDur <= 22 ? 3 : 5;
  ctx.font = '500 11px "Geist Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let t = 0; t <= totalDur; t += stepSec) {
    const x = timeToX(t);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(`${t}s`, x, padTop + plotH + 7);
  }

  // 2. Horizontal Swarasthana lanes (-200¢ Mandra n2 through +1200¢ Taar S')
  const bandHalfH = (42 / centsSpan) * plotH;
  for (const lane of SAPTAK_LANES) {
    const y = centsToY(lane.cents);
    const inRaga = winner.swaras.includes(lane.id);
    const isVadiOrSamvadi = lane.id === winner.vadi || lane.id === winner.samvadi;
    const isAnchor = lane.cents === 0 || lane.cents === 700 || lane.cents === 1200;

    // Highlight Vadi/Samvadi & Shadja/Pancham shruti bands
    if (isVadiOrSamvadi) {
      ctx.fillStyle = 'rgba(240, 80, 50, 0.08)';
      ctx.fillRect(padLeft, y - bandHalfH, plotW, bandHalfH * 2);
    } else if (isAnchor) {
      ctx.fillStyle = 'rgba(244, 244, 246, 0.035)';
      ctx.fillRect(padLeft, y - bandHalfH * 0.85, plotW, bandHalfH * 1.7);
    }

    ctx.save();
    if (isAnchor) {
      ctx.strokeStyle = 'rgba(244, 244, 246, 0.26)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
    } else if (isVadiOrSamvadi) {
      ctx.strokeStyle = 'rgba(240, 80, 50, 0.34)';
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = inRaga ? 'rgba(244, 244, 245, 0.12)' : 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.8;
    }
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();
    ctx.restore();

    // Left axis Swara + Sargam label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = isVadiOrSamvadi || isAnchor ? '700 12px "Geist Mono", monospace' : '500 11.5px "Geist Mono", monospace';
    ctx.fillStyle = isVadiOrSamvadi
      ? '#f05032'
      : inRaga
        ? '#f4f4f6'
        : '#52525b';
    ctx.fillText(lane.label, 10, y);

    ctx.font = '500 10.5px "Geist Mono", monospace';
    ctx.fillStyle = isVadiOrSamvadi
      ? 'rgba(240, 80, 50, 0.9)'
      : inRaga
        ? '#a1a1aa'
        : '#3f3f46';
    ctx.fillText(lane.sargam, 36, y);

    // Right axis cents readout on key anchors
    if (lane.cents % 200 === 0 || isAnchor) {
      ctx.textAlign = 'right';
      ctx.font = '500 10.5px "Geist Mono", monospace';
      ctx.fillStyle = isAnchor ? '#d4d4d8' : '#71717a';
      const sign = lane.cents > 0 ? '+' : '';
      ctx.fillText(`${sign}${lane.cents}¢`, cssW - 8, y);
    }
  }

  // Clip note ribbons & F0 curve to contourRevealProgress for left-to-right scroll reveal sweep
  ctx.save();
  ctx.beginPath();
  ctx.rect(padLeft, 0, Math.max(2, plotW * contourRevealProgress), cssH);
  ctx.clip();

  // 3. Held-Swara Note Ribbons (Svara-Lipi Transcription Blocks)
  for (const rib of ribbons) {
    const x1 = timeToX(rib.tStart);
    const x2 = Math.max(x1 + 3, timeToX(rib.tEnd));
    const rw = x2 - x1;
    const ry = centsToY(rib.saptakCents ?? (rib.semitone * 100));
    const rh = Math.max(12, bandHalfH * 1.65);
    const isVadi = rib.swara === winner.vadi || rib.swara === winner.samvadi;
    const inRaga = winner.swaras.includes(rib.swara);

    ctx.fillStyle = isVadi
      ? 'rgba(240, 80, 50, 0.24)'
      : inRaga
        ? 'rgba(244, 244, 246, 0.14)'
        : 'rgba(161, 161, 170, 0.08)';
    ctx.strokeStyle = isVadi
      ? 'rgba(240, 80, 50, 0.58)'
      : inRaga
        ? 'rgba(244, 244, 246, 0.30)'
        : 'rgba(161, 161, 170, 0.16)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x1, ry - rh / 2, rw, rh, 3);
    } else {
      ctx.rect(x1, ry - rh / 2, rw, rh);
    }
    ctx.fill();
    ctx.stroke();

    // Print inline Sargam label inside longer sustained Nyasa/Alap notes
    if (rw >= 26) {
      const labelTxt = rib.saptakCents >= 1150 ? "Sa'" : (SARGAM_SHORT[rib.swara] || rib.swara);
      ctx.font = '600 11px "Geist Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isVadi ? '#ff947d' : '#f4f4f6';
      ctx.fillText(labelTxt, x1 + 5, ry);
    }
  }

  // 4. Continuous F0 Pitch Trajectory (Unwrapped Saptak Cents + Quadratic Bezier Smoothing)
  if (contour.length > 0) {
    const segments = [];
    const leapConnectors = [];
    let currentSeg = [];

    for (let i = 0; i < contour.length; i++) {
      const pt = contour[i];
      const cVal = pt.saptakCents ?? pt.cents;
      const x = timeToX(pt.t);
      const y = centsToY(cVal);
      const node = { x, y, pt, cVal };

      if (currentSeg.length === 0) {
        currentSeg.push(node);
      } else {
        const prev = currentSeg[currentSeg.length - 1];
        const dt = pt.t - prev.pt.t;
        const dc = Math.abs(cVal - prev.cVal);
        if (dt > 0.20 || dc > 310) {
          if (dt <= 0.16 && currentSeg.length >= 2) {
            leapConnectors.push({ from: prev, to: node });
          }
          segments.push(currentSeg);
          currentSeg = [node];
        } else {
          currentSeg.push(node);
        }
      }
    }
    if (currentSeg.length > 0) segments.push(currentSeg);

    // Filter out tiny isolated 1-point noise specks that jumped far from neighbors
    const cleanSegments = segments.filter((seg) => seg.length >= 2 || segments.length <= 3);

    // Draw subtle dotted interval-leap connectors between rapid swara transitions
    if (leapConnectors.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 244, 246, 0.24)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      for (const lc of leapConnectors) {
        ctx.moveTo(lc.from.x, lc.from.y);
        ctx.lineTo(lc.to.x, lc.to.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const traceSmoothSegments = () => {
      ctx.beginPath();
      for (const seg of cleanSegments) {
        if (seg.length === 1) {
          ctx.moveTo(seg[0].x - 1, seg[0].y);
          ctx.lineTo(seg[0].x + 1, seg[0].y);
          continue;
        }
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length - 1; i++) {
          const xc = (seg[i].x + seg[i + 1].x) / 2;
          const yc = (seg[i].y + seg[i + 1].y) / 2;
          ctx.quadraticCurveTo(seg[i].x, seg[i].y, xc, yc);
        }
        const last = seg[seg.length - 1];
        ctx.lineTo(last.x, last.y);
      }
    };

    // Subtle ambient halo under F0 trajectory
    ctx.save();
    ctx.strokeStyle = 'rgba(240, 80, 50, 0.30)';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    traceSmoothSegments();
    ctx.stroke();
    ctx.restore();

    // Primary high-contrast F0 trajectory
    ctx.save();
    ctx.strokeStyle = '#f4f4f6';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    traceSmoothSegments();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // 5. Active Playhead OR Interactive Hover Crosshair + Live Telemetry Readout
  const activeTime =
    contourHoverTimeSec !== null
      ? contourHoverTimeSec
      : audioEl && audioEl.duration > 0 && audioEl.currentTime > 0
        ? audioEl.currentTime
        : null;

  let inspectedPt = null;
  if (activeTime !== null && contour.length > 0) {
    let bestDist = Infinity;
    for (const pt of contour) {
      const d = Math.abs(pt.t - activeTime);
      if (d < bestDist) {
        bestDist = d;
        inspectedPt = pt;
      }
    }
    if (bestDist > 0.35) inspectedPt = null;
  }

  if (activeTime !== null) {
    const cursorX = timeToX(activeTime);
    ctx.save();
    ctx.strokeStyle = contourHoverTimeSec !== null ? 'rgba(244, 244, 246, 0.55)' : '#f05032';
    ctx.lineWidth = contourHoverTimeSec !== null ? 1.2 : 1.6;
    if (contourHoverTimeSec !== null) ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cursorX, padTop);
    ctx.lineTo(cursorX, padTop + plotH);
    ctx.stroke();
    ctx.restore();

    // If this is the audio playhead (not hover), draw a compact playhead tag at top
    if (contourHoverTimeSec === null) {
      const tagTxt = `▶ ${activeTime.toFixed(1)}s`;
      ctx.font = '600 10.5px "Geist Mono", monospace';
      const tagW = ctx.measureText(tagTxt).width + 12;
      const tagX = Math.min(padLeft + plotW - tagW, Math.max(padLeft, cursorX - tagW / 2));
      ctx.fillStyle = '#f05032';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(tagX, 3, tagW, 15, 3);
      } else {
        ctx.rect(tagX, 3, tagW, 15);
      }
      ctx.fill();
      ctx.fillStyle = '#09090b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagTxt, tagX + 6, 10.5);
    }

    if (inspectedPt) {
      const cVal = inspectedPt.saptakCents ?? inspectedPt.cents;
      const py = centsToY(cVal);
      const px = timeToX(inspectedPt.t);

      // Highlight dot on the F0 curve
      ctx.fillStyle = '#f05032';
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const dev = inspectedPt.centDeviation ?? 0;
      const devStr = `${dev >= 0 ? '+' : ''}${dev}¢`;
      const sargamName = cVal >= 1150 ? "Sa'" : (SARGAM_SHORT[inspectedPt.swara] || inspectedPt.swara);
      const badgeText = `${inspectedPt.t.toFixed(2)}s · ${inspectedPt.swara} (${sargamName}) · ${inspectedPt.hz} Hz · ${devStr}`;

      if (contourLiveBadge) {
        contourLiveBadge.textContent = badgeText;
      }

      // Draw floating HUD pill near cursor when hovering
      if (contourHoverTimeSec !== null) {
        ctx.font = '600 11.5px "Geist Mono", monospace';
        const tw = ctx.measureText(badgeText).width + 16;
        const th = 24;
        const bx = Math.min(padLeft + plotW - tw - 4, Math.max(padLeft + 4, cursorX - tw / 2));
        const by = Math.max(padTop + 4, py - 30);

        ctx.fillStyle = 'rgba(20, 20, 24, 0.94)';
        ctx.strokeStyle = 'rgba(240, 80, 50, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, tw, th, 4);
        } else {
          ctx.rect(bx, by, tw, th);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f4f4f6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + 8, by + th / 2);
      }
    } else if (contourLiveBadge && contourHoverTimeSec !== null) {
      contourLiveBadge.textContent = `${activeTime.toFixed(2)}s · Unvoiced / Breath Pause`;
    }
  } else if (contourLiveBadge) {
    contourLiveBadge.textContent = `Sa = ${dspTelemetry.tonic.noteName} (${dspTelemetry.tonic.tonicHz} Hz) · ${ribbons.length} Swara Phrases · Hover or click to seek`;
  }

  ctx.restore();
}

// Interactive hover & click-to-seek on Pitch Contour Canvas
if (pitchCanvas) {
  const getCanvasTimeFromEvent = (e) => {
    if (!currentClassification) return null;
    const rect = pitchCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeft = 68;
    const padRight = 56;
    const plotW = Math.max(1, rect.width - padLeft - padRight);
    const ratio = Math.max(0, Math.min(1, (x - padLeft) / plotW));
    const totalDur = currentClassification.dspTelemetry?.audioSummary?.durationSec || audioEl?.duration || 12;
    return ratio * totalDur;
  };

  pitchCanvas.addEventListener('mousemove', (e) => {
    contourHoverTimeSec = getCanvasTimeFromEvent(e);
    drawPitchContourCanvas();
  });

  pitchCanvas.addEventListener('mouseleave', () => {
    contourHoverTimeSec = null;
    drawPitchContourCanvas();
  });

  pitchCanvas.addEventListener('click', (e) => {
    const seekSec = getCanvasTimeFromEvent(e);
    if (seekSec !== null && audioEl && audioEl.src) {
      audioEl.currentTime = Math.min(audioEl.duration || seekSec, seekSec);
      if (audioEl.paused) {
        audioEl.play().catch(() => {});
      }
      drawPitchContourCanvas();
    }
  });
}

window.addEventListener('resize', () => {
  if (currentClassification) drawPitchContourCanvas();
});

// Animate playhead while audio plays
function syncPlayheadLoop() {
  if (audioEl && !audioEl.paused) {
    drawPitchContourCanvas();
  }
  requestAnimationFrame(syncPlayheadLoop);
}
requestAnimationFrame(syncPlayheadLoop);
audioEl.addEventListener('seeked', drawPitchContourCanvas);
audioEl.addEventListener('pause', drawPitchContourCanvas);

// Wire Dropzone & File Input
btnBrowse.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) classifyUploadedFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) classifyUploadedFile(file);
});

tonicSelect.addEventListener('change', () => {
  if (fileInput.files?.[0]) {
    classifyUploadedFile(fileInput.files[0]);
  } else if (activeSampleUrl) {
    classifyBySampleUrl(activeSampleUrl, false);
  }
});

// Wire Live Microphone Recording
btnMic.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    isRecording = true;
    micBtnLabel.textContent = 'Stop Recording...';

    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };
    mediaRecorder.onstop = () => {
      isRecording = false;
      micBtnLabel.textContent = 'Record 8s Clip';
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const recordedFile = new File([blob], 'live-mic-raga.webm', { type: blob.type });
      classifyUploadedFile(recordedFile);
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 8000);
  } catch (err) {
    micBtnLabel.textContent = 'Mic Unavailable';
    setTimeout(() => {
      micBtnLabel.textContent = 'Record 8s Clip';
    }, 2500);
  }
});

// Copy curl command
document.getElementById('btn-copy-curl').addEventListener('click', async () => {
  const curlCmd = `curl -s -X POST ${window.location.origin}/api/classify-mp3 \\\n  -H "Content-Type: audio/mpeg" \\\n  -H "X-Filename: raga-yaman.mp3" \\\n  --data-binary @public/samples/raga-yaman.mp3 | jq .`;
  try {
    await navigator.clipboard.writeText(curlCmd);
    const label = document.getElementById('copy-curl-label');
    label.textContent = 'Copied curl';
    setTimeout(() => {
      label.textContent = 'Copy curl';
    }, 1800);
  } catch {
    // ignore
  }
});

// Wire Decision Engine Mode & BYOK / OpenJev Controls
const btnModeCloud = document.getElementById('btn-mode-cloud');
const btnModeOpenjev = document.getElementById('btn-mode-openjev');
const btnToggleKeyVis = document.getElementById('btn-toggle-key-vis');
const btnClearApiKey = document.getElementById('btn-clear-api-key');

function syncEngineModeUI() {
  const openJevMode = isOpenJevSelected();
  if (byokKeyGroup) byokKeyGroup.style.display = openJevMode ? 'none' : 'flex';
  if (openjevControls) openjevControls.style.display = openJevMode ? 'flex' : 'none';
  if (btnModeCloud) btnModeCloud.classList.toggle('active', !openJevMode);
  if (btnModeOpenjev) btnModeOpenjev.classList.toggle('active', openJevMode);

  if (openJevMode) {
    const modelId = getSelectedOpenJevModelId();
    if (loadOpenjevLabel) {
      loadOpenjevLabel.textContent =
        openjevLoadedModel === modelId
          ? `${modelId} Ready`
          : openjevLoadingModel === modelId
            ? 'Loading...'
            : `Load & Run ${modelId}`;
    }
    triggerOpenJevLoad(modelId);
    if (currentClassification && openjevLoadedModel === modelId) {
      applyOpenJevToClassification(currentClassification);
    }
  } else if (activeSampleUrl && currentClassification) {
    classifyBySampleUrl(activeSampleUrl, false);
  }
}

if (engineModeSelect) {
  engineModeSelect.addEventListener('change', syncEngineModeUI);
}

if (btnModeCloud && engineModeSelect) {
  btnModeCloud.addEventListener('click', () => {
    engineModeSelect.value = 'typesafe-cloud';
    syncEngineModeUI();
  });
}

if (btnModeOpenjev && engineModeSelect) {
  btnModeOpenjev.addEventListener('click', () => {
    if (!isOpenJevSelected()) {
      engineModeSelect.value = 'openjev:qwen3-0.6b';
    }
    syncEngineModeUI();
  });
}

if (btnToggleKeyVis && jevApiKeyInput) {
  btnToggleKeyVis.addEventListener('click', () => {
    const isPwd = jevApiKeyInput.type === 'password';
    jevApiKeyInput.type = isPwd ? 'text' : 'password';
    btnToggleKeyVis.textContent = isPwd ? 'Hide' : 'Show';
  });
}

if (btnClearApiKey && jevApiKeyInput) {
  btnClearApiKey.addEventListener('click', () => {
    jevApiKeyInput.value = '';
    try {
      localStorage.removeItem('typesafe_jev_api_key');
    } catch {
      // ignore
    }
    updateApiKeyBadge();
    if (!hasLocalBackend && engineModeSelect) {
      engineModeSelect.value = 'openjev:qwen3-0.6b';
      syncEngineModeUI();
    }
    if (activeSampleUrl) {
      classifyBySampleUrl(activeSampleUrl, false);
    }
  });
}

if (btnSaveApiKey && jevApiKeyInput) {
  const saveAndReclassify = () => {
    const val = jevApiKeyInput.value.trim();
    try {
      if (val) {
        localStorage.setItem('typesafe_jev_api_key', val);
      } else {
        localStorage.removeItem('typesafe_jev_api_key');
      }
    } catch {
      // ignore
    }
    if (val && isOpenJevSelected() && engineModeSelect) {
      engineModeSelect.value = 'typesafe-cloud';
      syncEngineModeUI();
    }
    updateApiKeyBadge();
    const saveLabel = document.getElementById('save-key-label');
    if (saveLabel) {
      saveLabel.textContent = val ? 'Key Active' : hasLocalBackend ? 'Using .env' : 'OpenJev Local';
      setTimeout(() => {
        saveLabel.textContent = 'Apply Key';
      }, 1500);
    }
    if (activeSampleUrl) {
      classifyBySampleUrl(activeSampleUrl, false);
    }
  };
  btnSaveApiKey.addEventListener('click', saveAndReclassify);
  jevApiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndReclassify();
    }
  });
}

if (btnLoadOpenjev) {
  btnLoadOpenjev.addEventListener('click', () => {
    const modelId = getSelectedOpenJevModelId();
    triggerOpenJevLoad(modelId);
  });
}

// Wire Live YouTube Vocal Fetcher
const ytInputEl = document.getElementById('youtube-url-input');
const ytBtnEl = document.getElementById('btn-fetch-youtube');
if (ytBtnEl && ytInputEl) {
  ytBtnEl.addEventListener('click', () => {
    classifyByYoutubeUrl(ytInputEl.value);
  });
  ytInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      classifyByYoutubeUrl(ytInputEl.value);
    }
  });
}

// Initialize Catalog & Default Sample Classification (100% browser-first, zero server required)
async function initStudio() {
  try {
    // Build catalog directly in the browser from raga-browser-engine.js
    catalogData = {
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
        sampleUrl: `.${r.sampleFile}`,
        youtubeUrl: r.youtubeUrl || null,
        vocalSource: r.vocalSource || 'Human Vocal Clip'
      }))
    };

    // Probe if local Node server (for yt-dlp and .env key) is running (localhost only)
    let hasServerKey = false;
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    if (isLocalhost) {
      try {
        const probe = await fetch('./api/catalog', { method: 'GET' });
        const contentType = probe.headers.get('content-type') || '';
        if (probe.ok && contentType.includes('application/json')) {
          const probeJson = await probe.json();
          hasLocalBackend = Boolean(probeJson?.ragas);
          hasServerKey = Boolean(probeJson?.engine?.liveJevReady);
        }
      } catch {
        hasLocalBackend = false;
        hasServerKey = false;
      }
    }

    const ytFetchBar = document.querySelector('.youtube-fetch-bar');
    if (ytFetchBar && !hasLocalBackend) {
      ytFetchBar.style.display = 'none';
    }
    updateApiKeyBadge();

    // If there is no TypeSafe API key (neither browser BYOK nor local backend .env),
    // automatically switch to OpenJev Local WASM and load the local model in the browser.
    if (!hasServerKey && !getBrowserApiKey() && engineModeSelect) {
      engineModeSelect.value = 'openjev:qwen3-0.6b';
      syncEngineModeUI();
    }

    // Render Sample Pills
    samplePillsEl.innerHTML = catalogData.samples
      .map(
        (s) => `
        <button type="button" class="sample-pill ${s.sampleUrl === activeSampleUrl ? 'active' : ''}" data-url="${s.sampleUrl}">
          ${s.name.replace('Raga ', '')} · ${s.thaat}
        </button>
      `
      )
      .join('');

    samplePillsEl.querySelectorAll('.sample-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        classifyBySampleUrl(url, true);
      });
    });

    // Render Raga Grammar Matrix in Tab 2 (curated ragas, janya lexicon, Wikipedia ragas, and 72 Melakartas)
    const catalogGrid = document.getElementById('catalog-grid');
    const catalogCount = document.getElementById('catalog-count');
    const CATALOG_PAGE = 60;
    const renderCatalogGrid = (query = '') => {
      const q = query.trim().toLowerCase();
      const matches = q
        ? catalogData.ragas.filter((r) =>
            [r.name, ...(r.aliases || []), r.thaat, r.carnaticEquivalent, r.swaras.join(' ')]
              .join(' | ')
              .toLowerCase()
              .includes(q)
          )
        : catalogData.ragas;
      catalogCount.textContent = `${matches.length} of ${catalogData.ragas.length} ragas${
        matches.length > CATALOG_PAGE ? ` · showing first ${CATALOG_PAGE}` : ''
      }`;
      catalogGrid.innerHTML = matches
        .slice(0, CATALOG_PAGE)
        .map(
          (r) => `
        <div class="catalog-raga-card">
          <div class="choice-item-top">
            <h3>${r.name}</h3>
            <span class="mono-badge">${r.thaat} Thaat</span>
          </div>
          <div class="mono-label">${r.carnaticEquivalent}</div>
          <div class="mono-value">Swaras: ${r.swaras.join(' ')}</div>
          <div class="mono-label">Pakad: ${r.pakad}</div>
          <div class="choice-item-sub">
            <span>Vadi: ${r.vadi} / Samvadi: ${r.samvadi}</span>
            <span>${r.prahar.split('(')[0].trim()}</span>
          </div>
        </div>
      `
        )
        .join('');
    };
    renderCatalogGrid();
    document.getElementById('catalog-search').addEventListener('input', (e) => renderCatalogGrid(e.target.value));

    // Start on the clean input stage; only auto-classify if ?sample=... is passed in the URL
    const urlSample = new URLSearchParams(window.location.search).get('sample');
    if (urlSample) {
      const matched = catalogData.samples.find((s) => s.id.includes(urlSample) || s.sampleUrl.includes(urlSample));
      if (matched) {
        await classifyBySampleUrl(matched.sampleUrl, false);
      }
    }

    // Register WebMCP tools for Agent-Ready Level 5 browser agents
    if (typeof navigator !== 'undefined' && 'modelContext' in navigator && navigator.modelContext?.registerTool) {
      navigator.modelContext.registerTool({
        name: 'list_ragas',
        description: 'Return the raga catalog (~960 ragas: 12 curated, ~880 named Hindustani/Carnatic janya ragas, and all 72 Melakartas) with swarasthanas, parent Thaats, Vadi/Samvadi, and Pakad motifs.',
        parameters: {
          type: 'object',
          properties: {
            thaat: { type: 'string', description: 'Optional parent Thaat filter (e.g. Kalyan, Bhairav, Asavari)' }
          }
        },
        handler: async ({ thaat } = {}) => {
          const list = thaat
            ? RAGA_CATALOG.filter((r) => r.thaat.toLowerCase() === String(thaat).toLowerCase())
            : RAGA_CATALOG;
          return { count: list.length, ragas: list };
        }
      });

      navigator.modelContext.registerTool({
        name: 'classify_sample_raga',
        description: 'Classify one of the 6 reference vocal recordings (yaman, bhairav, bhupali, malkauns, darbari_kanada, hamsadhwani) and return its telemetry and System One probabilities.',
        parameters: {
          type: 'object',
          properties: {
            ragaId: { type: 'string', description: 'Sample raga ID to classify (e.g. yaman, bhairav, malkauns)' }
          },
          required: ['ragaId']
        },
        handler: async ({ ragaId }) => {
          const matched = catalogData?.samples?.find(
            (s) => s.id === ragaId || s.id.includes(String(ragaId || '').toLowerCase())
          );
          if (!matched) {
            return { error: `Unknown sample ragaId: ${ragaId}` };
          }
          await classifyBySampleUrl(matched.sampleUrl, false);
          return currentClassification;
        }
      });
    }
  } catch (err) {
    console.error('Failed to initialize studio:', err);
  }
}

initStudio();
