const browserFetch = self.fetch.bind(self);
self.fetch = (input, init = {}) => browserFetch(input, { ...init, referrerPolicy: 'no-referrer' });

const { Wllama, LoggerWithoutDebug } = await import('./vendor/wllama/index.js');

export const OPENJEV_MODELS = {
  'qwen3-0.6b': {
    name: 'Qwen3 0.6B',
    size: '639 MB',
    url: 'https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf',
    labelBase: 32
  },
  'minicpm5-2b': {
    name: 'MiniCPM5 2B',
    size: '1.56 GB',
    url: 'https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/2079a22f3beaa4e306449978533478fe0522f4b3/MiniCPM5-2B-Q4_K_M.gguf',
    labelBase: 54
  },
  'qwen3.5-4b': {
    name: 'Qwen3.5 4B',
    size: '3.01 GB',
    url: 'https://huggingface.co/bartowski/Qwen_Qwen3.5-4B-GGUF/resolve/4168f45a16a1290d65a4ec0fa312ae917a4c15d6/Qwen_Qwen3.5-4B-Q4_K_M.gguf',
    labelBase: 32
  }
};

const labelsFor = (count) => Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
let engine = null;
let loadedModelId = null;

function send(type, data = {}) {
  self.postMessage({ type, ...data });
}

function softmax(values) {
  const maxVal = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - maxVal));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / total);
}

function extractOptionLogprobs(response, labels) {
  const entries = response.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs ?? [];
  return labels.map((label) => {
    const ascii = label.charCodeAt(0);
    const entry = entries.find((item) => item.token === label || (item.bytes?.length === 1 && item.bytes[0] === ascii));
    return Number.isFinite(Number(entry?.logprob)) ? Number(entry.logprob) : -12;
  });
}

async function loadModel(requestedModelId) {
  if (engine && loadedModelId === requestedModelId) {
    const selected = OPENJEV_MODELS[loadedModelId];
    send('ready', { warmupMs: 0, modelId: loadedModelId, modelName: selected.name });
    return;
  }
  if (engine) {
    try {
      await engine.exit();
    } catch {
      // ignore
    }
    engine = null;
    loadedModelId = null;
  }

  if (!Object.hasOwn(OPENJEV_MODELS, requestedModelId)) {
    throw new Error(`Unknown OpenJev model: ${requestedModelId}`);
  }

  const selected = OPENJEV_MODELS[requestedModelId];
  const wasmUrl = new URL('./vendor/wllama/wasm/wllama.wasm', self.location.href).href;

  engine = new Wllama(
    { default: wasmUrl },
    { logger: LoggerWithoutDebug, suppressNativeLog: true, parallelDownloads: 4 }
  );

  send('loading', { message: `Downloading or reading ${selected.name} (${selected.size}) from browser cache...` });
  const loadStart = performance.now();

  await engine.loadModelFromUrl(selected.url, {
    n_ctx: 2048,
    n_batch: 512,
    n_gpu_layers: 999,
    cache_prompt: false,
    progressCallback: ({ loaded, total }) => {
      const pct = total ? Math.round((loaded / total) * 100) : 0;
      send('progress', {
        loaded,
        total,
        percent: pct,
        text: total ? `${pct}% of ${selected.name} (${selected.size})` : `Loading ${selected.name}...`
      });
    }
  });

  const loadMs = Math.round(performance.now() - loadStart);
  send('loaded', { loadMs, modelId: requestedModelId, modelName: selected.name });
  send('loading', { message: `Warming up ${selected.name} direct logit pass...` });

  const warmupStart = performance.now();
  await engine.createChatCompletion({
    messages: [{ role: 'user', content: 'Reply with the single word ready.' }],
    max_tokens: 1,
    temperature: 0,
    cache_prompt: false,
    chat_template_kwargs: { enable_thinking: false }
  });

  loadedModelId = requestedModelId;
  send('ready', {
    warmupMs: Math.round(performance.now() - warmupStart),
    loadMs,
    modelId: requestedModelId,
    modelName: selected.name
  });
}

async function runSingleDirectChoice(stateText, questionText, optionItems) {
  const labels = labelsFor(optionItems.length);
  const optionLines = optionItems.map((item, idx) => `${labels[idx]}. ${item.description}`).join('\n');
  const grammar = `root ::= ${labels.map((l) => `"${l}"`).join(' | ')}`;
  const labelBase = OPENJEV_MODELS[loadedModelId].labelBase;

  const response = await engine.createChatCompletion({
    messages: [
      {
        role: 'system',
        content: 'Make the requested musicological decision from the supplied acoustic state. Follow the output format exactly.'
      },
      {
        role: 'user',
        content: `State:\n${stateText}\n\nQuestion:\n${questionText}\n\nAllowed options:\n${optionLines}\n\nReply with exactly one option letter from: ${labels.join(', ')}.`
      }
    ],
    max_tokens: 1,
    temperature: 1,
    top_k: 0,
    top_p: 1,
    logprobs: true,
    top_logprobs: 20,
    logit_bias: Object.fromEntries(labels.map((_, idx) => [String(labelBase + idx), 100])),
    grammar,
    cache_prompt: false,
    chat_template_kwargs: { enable_thinking: false }
  });

  const logits = extractOptionLogprobs(response, labels);
  const probs = softmax(logits);
  const probMap = {};
  let bestKey = optionItems[0].key;
  let bestProb = -1;

  optionItems.forEach((item, idx) => {
    const p = Number(probs[idx].toFixed(4));
    probMap[item.key] = p;
    if (p > bestProb) {
      bestProb = p;
      bestKey = item.key;
    }
  });

  return {
    choice: bestKey,
    confidence: Number(Math.min(0.99, Math.max(0.45, bestProb * 1.15)).toFixed(3)),
    probabilities: probMap,
    inputTokens: response.usage?.prompt_tokens ?? 0
  };
}

async function evaluateRagaState({ state, catalogRagas, thaats }) {
  if (!engine || !loadedModelId) {
    throw new Error('OpenJev model is not loaded yet. Click "Load OpenJev Model" first.');
  }

  const startedAt = performance.now();
  const compactState = JSON.stringify({
    detected_tonic_sa: state.detected_tonic_sa,
    scale_profile: state.scale_profile,
    directional_phrases: state.directional_phrases,
    acoustic_candidate_shortlist: state.acoustic_candidate_shortlist?.slice(0, 5)
  }, null, 2);

  // 1. Direct 1-token logit readout for primary_raga (12 options A..L)
  const ragaOptions = catalogRagas.map((r) => ({
    key: r.id,
    description: `${r.name} (${r.thaat} Thaat) — Swaras: ${r.swaras.join(' ')}; Omitted: ${r.varjya.join(' ')}; Vadi: ${r.vadi}; Pakad: ${r.pakad}`
  }));

  const primaryRagaRes = await runSingleDirectChoice(
    compactState,
    'Which Indian classical raga is performed in this recording based on the active swaras, omitted varjya notes, pakad motifs, and acoustic shortlist?',
    ragaOptions
  );

  // 2. Direct 1-token logit readout for thaat_family (9 options A..I)
  const thaatOptions = Object.entries(thaats).map(([key, desc]) => ({
    key,
    description: `${key} Thaat — ${desc}`
  }));

  const thaatRes = await runSingleDirectChoice(
    compactState,
    'Which parent Thaat family governs the scale profile in this recording?',
    thaatOptions
  );

  // 3. Direct 1-token logit readout for pakad_phrase_verified Noul (A = Yes, B = No)
  const pakadRes = await runSingleDirectChoice(
    compactState,
    'Do the recurring swara n-grams and aroha/avaroha contour match the canonical pakad of the top candidate raga?',
    [
      { key: 'yes', description: 'Yes — canonical pakad phrases and directional swara transitions are verified' },
      { key: 'no', description: 'No — pakad phrases do not match' }
    ]
  );

  const latencyMs = Math.round(performance.now() - startedAt);
  const selectedModel = OPENJEV_MODELS[loadedModelId];

  send('evaluated', {
    model: `openjev/${loadedModelId} (${selectedModel.name})`,
    latencyMs,
    inputTokens: primaryRagaRes.inputTokens + thaatRes.inputTokens + pakadRes.inputTokens,
    readouts: 3,
    primary_raga: primaryRagaRes,
    thaat_family: thaatRes,
    pakad_noul: pakadRes.probabilities.yes ?? 0.8
  });
}

self.addEventListener('message', async ({ data }) => {
  try {
    if (data.type === 'load') {
      await loadModel(data.modelId);
    } else if (data.type === 'evaluate') {
      await evaluateRagaState(data.payload);
    }
  } catch (err) {
    send('error', { message: err?.message || String(err) });
  }
});
