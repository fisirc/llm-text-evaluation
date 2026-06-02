/* =================================================================
   LLM Verbal Reasoning Evaluation Report — Main JS
   ================================================================= */

// -----------------------------------------------------------------
// 1. CONSTANTS
// -----------------------------------------------------------------
const COLORS = ['#4fc3f7','#00c870','#f05555','#f0a030','#ff9800','#a78bfa','#ec4899','#9ca3af'];
const CHART_COLORS = COLORS.map(c=>c+'33');
const CHART_BORDERS = COLORS;
const ROBUSTNESS_METRICS = ['accuracy_drop','flip_rate','consistency','positive_transfer','negative_transfer','rank_consistency'];
const ROBUSTNESS_LABELS = {'accuracy_drop':'Acc. Drop','flip_rate':'Flip Rate','consistency':'Consistency','positive_transfer':'Pos. Transfer','negative_transfer':'Neg. Transfer','rank_consistency':'Rank Cons.'};

// -----------------------------------------------------------------
// 2. DATA & STATE
// -----------------------------------------------------------------
let DATA, AGG, PER_SAMPLE, MODELS, ATTACKS, TASKS, TASK_LABELS, ATTACK_LABELS;
let hasLogprobs = false;
const charts = {};

function initData() {
  DATA = window.BENCHMARK_DATA || {};
  MODELS = DATA.models || [];
  ATTACKS = DATA.attacks || [];
  TASKS = DATA.tasks || [];
  TASK_LABELS = DATA.task_labels || {};
  ATTACK_LABELS = DATA.attack_labels || {};
  AGG = DATA.aggregates || {};
  PER_SAMPLE = DATA.per_sample || {};

  // Check if any logprobs exist
  for (const sid in PER_SAMPLE) {
    const s = PER_SAMPLE[sid];
    for (const m in s.models) {
      for (const a in s.models[m]) {
        if (s.models[m][a].logprobs) { hasLogprobs = true; break; }
      }
      if (hasLogprobs) break;
    }
    if (hasLogprobs) break;
  }

  // Hide confidence tab if no logprobs
  if (!hasLogprobs) {
    const btn = document.querySelector('[data-tab="confidence"]');
    if (btn) btn.style.display = 'none';
  }
}

// -----------------------------------------------------------------
// 3. UTILITIES
// -----------------------------------------------------------------
function fmtPct(v) { return v==null?'—':(v*100).toFixed(1)+'%'; }
function fmtNum(v, d) { return v==null?'—':v.toFixed(d||2); }
function fmtMs(v) { return v==null?'—':Math.round(v).toLocaleString()+'ms'; }

function cellColor(v, mn, mx, invert) {
  if (v==null) return '#141414';
  const range = mx - mn || 1;
  let t = (v - mn) / range;
  if (invert) t = 1 - t;
  const h = Math.round(152 * t);
  const s = Math.round(70 - 40 * t);
  const l = Math.round(40 - 25 * t);
  return 'hsl('+h+','+s+'%,'+l+'%)';
}

function getBaselineAccuracy(model, task) {
  const bl = AGG[model]?.baseline;
  if (!bl || !bl.metrics?.tasks) return null;
  return bl.metrics.tasks[task]?.accuracy ?? null;
}

function getAttackData(model, attack) {
  return AGG[model]?.[attack] || null;
}

function getAttackLabel(file) {
  return ATTACK_LABELS[file] || file.replace(/\.json$/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function getAttackFromLabel(label) {
  return label;
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function makeChart(canvasId, type, labels, datasets, opts) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  charts[canvasId] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#888', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#ccc',
          callbacks: opts?.tooltipCallbacks || {}
        }
      },
      scales: type !== 'doughnut' && type !== 'radar' ? {
        x: { ticks: { color: '#666', font: { size: 10 } }, grid: { color: '#1a1a1a' } },
        y: { ticks: { color: '#666', font: { size: 10 } }, grid: { color: '#1a1a1a' }, ...opts?.yScale }
      } : undefined,
      ...opts?.extra
    }
  });
}

// -----------------------------------------------------------------
// 4. TAB SWITCHING
// -----------------------------------------------------------------
let activeTab = 'overview';
let tabRendered = {};

function showTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tabId));
  if (!tabRendered[tabId]) {
    tabRendered[tabId] = true;
    switch(tabId) {
      case 'overview': renderOverview(); break;
      case 'robustness': renderRobustness(); break;
      case 'pairs': renderLanguagePairs(); break;
      case 'confidence': renderConfidence(); break;
      case 'patterns': renderPatterns(); break;
      case 'comparison': renderComparison(); break;
    }
  }
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
}

// -----------------------------------------------------------------
// 5. TAB 1: OVERVIEW
// -----------------------------------------------------------------
function renderOverview() {
  renderOverviewStats();
  renderAccuracyChart();
  renderSummaryTable();
}

function renderOverviewStats() {
  const wrap = document.getElementById('overview-stats');
  let totalSamples = DATA.info?.total_samples || 0;
  let totalModels = MODELS.length;
  let totalAttacks = ATTACKS.length;
  let completedModels = 0, completedDatasets = 0;

  MODELS.forEach(m => {
    const md = AGG[m] || {};
    let allDone = true;
    for (const a of ['baseline', ...ATTACKS]) {
      if (md[a]?.metrics?.total > 0) completedDatasets++;
      else allDone = false;
    }
    if (allDone) completedModels++;
  });

  wrap.innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalSamples}</div><div class="stat-label">Samples</div></div>
    <div class="stat-card"><div class="stat-value">${totalModels}</div><div class="stat-label">Models</div></div>
    <div class="stat-card"><div class="stat-value">${totalAttacks}</div><div class="stat-label">Attacks</div></div>
    <div class="stat-card"><div class="stat-value">${TASKS.length}</div><div class="stat-label">Tasks</div></div>
    <div class="stat-card"><div class="stat-value">${completedDatasets}</div><div class="stat-label">Datasets Done</div></div>
    <div class="stat-card"><div class="stat-value">${completedModels}/${totalModels}</div><div class="stat-label">Models Complete</div></div>
  `;
}

function renderAccuracyChart() {
  const allAttacks = ['baseline', ...ATTACKS];
  const labels = allAttacks.map(a => a === 'baseline' ? 'Baseline (Spanish)' : (ATTACK_LABELS[a] || a));
  const datasets = MODELS.map((m, i) => {
    const data = allAttacks.map(a => {
      const d = getAttackData(m, a);
      return d?.metrics?.accuracy ?? null;
    });
    return {
      label: m.length > 30 ? m.slice(0,27)+'...' : m,
      data,
      backgroundColor: COLORS[i % COLORS.length] + '99',
      borderColor: COLORS[i % COLORS.length],
      borderWidth: 1
    };
  });

  makeChart('chart-accuracy', 'bar', labels, datasets, {
    yScale: { ticks: { callback: v => (v*100).toFixed(0)+'%' } }
  });
}

function renderSummaryTable() {
  const wrap = document.getElementById('summary-table-wrap');
  const hasRobustness = MODELS.some(m => ATTACKS.some(a => getAttackData(m, a)?.robustness));
  const hasRank = MODELS.some(m => ATTACKS.some(a => getAttackData(m, a)?.robustance?.rank_consistency != null));

  let html = '<table class="data-table"><thead><tr>';
  html += '<th>Model</th><th>Dataset</th><th>Total</th><th>Correct</th><th>Incorrect</th><th>Parse Errors</th><th>Accuracy</th><th>Avg Latency</th>';
  if (hasRobustness) {
    html += '<th>Acc. Drop</th><th>Flip Rate</th><th>Consistency</th><th>Pos. Transfer</th><th>Neg. Transfer</th>';
    if (hasRank) html += '<th>Rank Cons.</th>';
  }
  html += '</tr></thead><tbody>';

  MODELS.forEach(m => {
    const datasets = ['baseline', ...ATTACKS];
    datasets.forEach((a, ai) => {
      const d = getAttackData(m, a);
      if (!d || !d.metrics) return;
      const met = d.metrics;
      const rob = d.robustness;
      const atkDisplay = a === 'baseline' ? 'Baseline' : (ATTACK_LABELS[a] || a);

      html += '<tr>';
      html += `<td class="model-name">${esc(m)}</td>`;
      html += `<td>${esc(atkDisplay)}</td>`;
      html += `<td>${met.total}</td>`;
      html += `<td class="success">${met.correct}</td>`;
      html += `<td class="danger">${met.total - met.correct - met.failed}</td>`;
      html += `<td class="${met.failed>0?'cell-error':''}">${met.failed}</td>`;
      html += `<td>${fmtPct(met.accuracy)}</td>`;
      html += `<td>${fmtMs(met.avg_latency_ms)}</td>`;

      if (hasRobustness && rob) {
        html += `<td>${fmtPct(rob.accuracy_drop)}</td>`;
        html += `<td>${fmtPct(rob.flip_rate)}</td>`;
        html += `<td>${fmtPct(rob.consistency)}</td>`;
        html += `<td>${fmtPct(rob.positive_transfer)}</td>`;
        html += `<td>${fmtPct(rob.negative_transfer)}</td>`;
        if (hasRank) html += `<td>${fmtNum(rob.rank_consistency, 3)}</td>`;
      } else if (hasRobustness) {
        for (let i = 0; i < 5 + (hasRank?1:0); i++) html += '<td class="cell-na">—</td>';
      }
      html += '</tr>';
    });
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// -----------------------------------------------------------------
// 6. TAB 2: ROBUSTNESS
// -----------------------------------------------------------------
let robState = { attack: null, metric: 'accuracy_drop' };

function renderRobustness() {
  if (ATTACKS.length === 0) {
    document.getElementById('rob-heatmap-wrap').innerHTML = '<div class="empty-msg">No attacks evaluated yet.</div>';
    return;
  }

  // Attack selector (includes baseline)
  const sel = document.getElementById('rob-attack-sel');
  const allOptions = ['baseline', ...ATTACKS];
  sel.innerHTML = allOptions.map((a,i) => `<option value="${a}" ${i===0?'selected':''}>${a==='baseline'?'Baseline':(ATTACK_LABELS[a]||a)}</option>`).join('');
  robState.attack = allOptions[0];
  sel.onchange = () => { robState.attack = sel.value; renderRobustnessContent(); };

  // Metric buttons
  const btns = document.getElementById('rob-metric-btns');
  btns.innerHTML = ROBUSTNESS_METRICS.map((m,i) =>
    `<button class="metric-btn ${i===0?'active':''}" data-m="${m}">${ROBUSTNESS_LABELS[m]}</button>`
  ).join('');
  btns.querySelectorAll('.metric-btn').forEach(b => {
    b.addEventListener('click', () => {
      btns.querySelectorAll('.metric-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      robState.metric = b.dataset.m;
      renderRobustnessContent();
    });
  });

  renderRobustnessContent();
}

function renderRobustnessContent() {
  renderRobustnessHeatmap();
  renderRadarChart();
  renderRobustnessBarChart();
}

function renderRobustnessHeatmap() {
  const wrap = document.getElementById('rob-heatmap-wrap');
  const attack = robState.attack;

  if (attack === 'baseline') {
    // Show baseline accuracy per task
    let mn = 1, mx = 0;
    MODELS.forEach(m => {
      const bl = getAttackData(m, 'baseline');
      if (bl?.metrics?.tasks) {
        for (const t in bl.metrics.tasks) {
          const v = bl.metrics.tasks[t]?.accuracy;
          if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
        }
      }
    });
    if (mn === 1 && mx === 0) { mn = 0; mx = 1; }

    let html = '<table class="data-table"><thead><tr><th>Model</th>';
    TASKS.forEach(t => { html += `<th>${TASK_LABELS[t]||t}</th>`; });
    html += '</tr></thead><tbody>';

    MODELS.forEach(m => {
      html += `<tr><td class="model-name">${esc(m)}</td>`;
      const bl = getAttackData(m, 'baseline');
      TASKS.forEach(t => {
        const v = bl?.metrics?.tasks?.[t]?.accuracy ?? null;
        const bg = cellColor(v, mn, mx, false);
        html += `<td style="background:${bg};${v==null?'color:#2e2e2e':''}">${v==null?'—':fmtPct(v)}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
    return;
  }

  const metric = robState.metric;

  // Find min/max for color scale
  let mn = 1, mx = -1;
  MODELS.forEach(m => {
    const d = getAttackData(m, attack);
    if (d?.robustness_per_task) {
      for (const t in d.robustness_per_task) {
        const v = d.robustness_per_task[t]?.[metric];
        if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      }
    }
  });
  if (mn === 1 && mx === -1) { mn = 0; mx = 1; }

  let html = '<table class="data-table"><thead><tr><th>Model</th>';
  TASKS.forEach(t => { html += `<th>${TASK_LABELS[t]||t}</th>`; });
  html += '</tr></thead><tbody>';

  MODELS.forEach(m => {
    html += `<tr><td class="model-name">${esc(m)}</td>`;
    const d = getAttackData(m, attack);
    TASKS.forEach(t => {
      const v = d?.robustness_per_task?.[t]?.[metric] ?? null;
      const bg = cellColor(v, mn, mx, metric === 'accuracy_drop' || metric === 'flip_rate' || metric === 'negative_transfer');
      html += `<td style="background:${bg};${v==null?'color:#2e2e2e':''}">${v==null?'—':fmtNum(v,3)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function renderRadarChart() {
  const attack = robState.attack;
  const labels = TASKS.map(t => TASK_LABELS[t]||t);

  if (attack === 'baseline') {
    // Show baseline accuracy per task
    const datasets = MODELS.map((m, i) => {
      const bl = getAttackData(m, 'baseline');
      const data = TASKS.map(t => bl?.metrics?.tasks?.[t]?.accuracy ?? null);
      return {
        label: m.length > 25 ? m.slice(0,22)+'...' : m,
        data,
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: COLORS[i % COLORS.length] + '22',
        borderWidth: 2,
        pointRadius: 3
      };
    });

    makeChart('chart-radar', 'radar', labels, datasets, {
      extra: {
        scales: {
          r: {
            ticks: { color: '#666', backdropColor: 'transparent', font: { size: 9 } },
            grid: { color: '#222' },
            pointLabels: { color: '#888', font: { size: 10 } }
          }
        }
      }
    });
    return;
  }

  const datasets = MODELS.map((m, i) => {
    const d = getAttackData(m, attack);
    const data = TASKS.map(t => {
      const v = d?.robustness_per_task?.[t]?.[robState.metric];
      return v != null ? Math.max(0, v) : null;
    });
    return {
      label: m.length > 25 ? m.slice(0,22)+'...' : m,
      data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      borderWidth: 2,
      pointRadius: 3
    };
  });

  makeChart('chart-radar', 'radar', labels, datasets, {
    extra: {
      scales: {
        r: {
          ticks: { color: '#666', backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: '#222' },
          pointLabels: { color: '#888', font: { size: 10 } }
        }
      }
    }
  });
}

function renderRobustnessBarChart() {
  const attack = robState.attack;

  if (attack === 'baseline') {
    // Show baseline accuracy per model
    const datasets = MODELS.map((m, i) => ({
      label: m.length > 25 ? m.slice(0,22)+'...' : m,
      data: [getAttackData(m, 'baseline')?.metrics?.accuracy ?? null],
      backgroundColor: COLORS[i % COLORS.length] + '99',
      borderColor: COLORS[i % COLORS.length],
      borderWidth: 1
    }));

    makeChart('chart-robustness-bar', 'bar',
      ['Baseline Accuracy'],
      datasets,
      { yScale: { ticks: { callback: v => (v*100).toFixed(0)+'%' } } }
    );
    return;
  }

  const metrics = ['accuracy_drop','flip_rate','consistency','positive_transfer','negative_transfer'];

  const datasets = MODELS.map((m, i) => ({
    label: m.length > 25 ? m.slice(0,22)+'...' : m,
    data: metrics.map(metric => getAttackData(m, attack)?.robustness?.[metric] ?? null),
    backgroundColor: COLORS[i % COLORS.length] + '99',
    borderColor: COLORS[i % COLORS.length],
    borderWidth: 1
  }));

  makeChart('chart-robustness-bar', 'bar',
    metrics.map(m => ROBUSTNESS_LABELS[m]),
    datasets,
    { yScale: { ticks: { callback: v => (v*100).toFixed(0)+'%' } } }
  );
}

// -----------------------------------------------------------------
// 7. TAB 3: LANGUAGE PAIRS
// -----------------------------------------------------------------
let pairsState = { model: null };

function renderLanguagePairs() {
  if (MODELS.length === 0) return;

  const sel = document.getElementById('pairs-model-sel');
  sel.innerHTML = MODELS.map((m,i) => `<option value="${m}" ${i===0?'selected':''}>${esc(m)}</option>`).join('');
  pairsState.model = MODELS[0];
  sel.onchange = () => { pairsState.model = sel.value; renderLanguagePairsContent(); };

  renderLanguagePairsContent();
}

function renderLanguagePairsContent() {
  const model = pairsState.model;
  if (!model) return;

  // Build pairwise matrices
  const labels = ATTACKS.map(a => ATTACK_LABELS[a]||a);
  const n = ATTACKS.length;
  if (n < 2) {
    document.getElementById('consistency-matrix-wrap').innerHTML = '<div class="empty-msg">Need at least 2 attacks for pairwise analysis.</div>';
    return;
  }

  // Get pairwise values
  function getPW(metric) {
    const matrix = Array.from({length: n}, () => Array(n).fill(null));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) { matrix[i][j] = 1; continue; }
        const d = getAttackData(model, ATTACKS[i]);
        if (!d?.pairwise_robustness) continue;
        // Find the right key - try matching by label
        const targetFile = ATTACKS[j];
        // The pairwise_robustness keys are like "cross_lingual.french_base.json"
        // We need to find the matching entry
        for (const key in d.pairwise_robustness) {
          if (key.includes(targetFile.replace('_base','')) || key === targetFile || key.replace('.json','') === targetFile) {
            matrix[i][j] = d.pairwise_robustness[key][metric] ?? null;
            break;
          }
        }
      }
    }
    return matrix;
  }

  const consMatrix = getPW('consistency');
  const posMatrix = getPW('positive_transfer');
  const negMatrix = getPW('negative_transfer');

  function renderMatrix(containerId, matrix, invert) {
    const wrap = document.getElementById(containerId);
    let mn = 1, mx = 0;
    matrix.forEach(row => row.forEach(v => { if (v!=null) { mn=Math.min(mn,v); mx=Math.max(mx,v); } }));

    let html = '<table class="matrix-table"><thead><tr><th></th>';
    labels.forEach(l => { html += `<th>${esc(l)}</th>`; });
    html += '</tr></thead><tbody>';

    for (let i = 0; i < n; i++) {
      html += `<tr><th>${esc(labels[i])}</th>`;
      for (let j = 0; j < n; j++) {
        const v = matrix[i][j];
        if (i === j) {
          html += '<td class="diag">1.000</td>';
        } else {
          const bg = cellColor(v, mn, mx, invert);
          html += `<td style="background:${bg}">${v==null?'—':fmtNum(v,3)}</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  renderMatrix('consistency-matrix-wrap', consMatrix, false);
  renderMatrix('pos-transfer-matrix-wrap', posMatrix, false);
  renderMatrix('neg-transfer-matrix-wrap', negMatrix, true);

  // Average consistency bar chart
  const avgCons = MODELS.map(m => {
    const d = getAttackData(m, ATTACKS[0]);
    if (!d?.pairwise_robustness) return null;
    const vals = Object.values(d.pairwise_robustness).map(pw => pw.consistency).filter(v => v!=null);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  });

  makeChart('chart-avg-consistency', 'bar',
    MODELS.map(m => m.length > 25 ? m.slice(0,22)+'...' : m),
    [{
      label: 'Average Consistency',
      data: avgCons,
      backgroundColor: MODELS.map((_, i) => COLORS[i % COLORS.length] + '99'),
      borderColor: MODELS.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 1
    }],
    { yScale: { ticks: { callback: v => v.toFixed(3) } } }
  );

  // Average transfer rates
  const avgPos = MODELS.map(m => {
    const d = getAttackData(m, ATTACKS[0]);
    if (!d?.pairwise_robustness) return null;
    const vals = Object.values(d.pairwise_robustness).map(pw => pw.positive_transfer).filter(v => v!=null);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  });
  const avgNeg = MODELS.map(m => {
    const d = getAttackData(m, ATTACKS[0]);
    if (!d?.pairwise_robustness) return null;
    const vals = Object.values(d.pairwise_robustness).map(pw => pw.negative_transfer).filter(v => v!=null);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  });

  makeChart('chart-avg-transfer', 'bar',
    MODELS.map(m => m.length > 25 ? m.slice(0,22)+'...' : m),
    [
      { label: 'Pos. Transfer', data: avgPos, backgroundColor: '#00c87099', borderColor: '#00c870', borderWidth: 1 },
      { label: 'Neg. Transfer', data: avgNeg, backgroundColor: '#f0555599', borderColor: '#f05555', borderWidth: 1 }
    ],
    { yScale: { ticks: { callback: v => (v*100).toFixed(0)+'%' } } }
  );
}

// -----------------------------------------------------------------
// 8. TAB 4: CONFIDENCE
// -----------------------------------------------------------------
let confState = { model: null, attack: null };

function renderConfidence() {
  if (!hasLogprobs) {
    document.getElementById('panel-confidence').innerHTML = '<div class="empty-msg">No logprobs data available.</div>';
    return;
  }

  // Model selector - only models with logprobs
  const modelsWithLP = MODELS.filter(m => {
    for (const sid in PER_SAMPLE) {
      if (PER_SAMPLE[sid].models[m]) {
        for (const a in PER_SAMPLE[sid].models[m]) {
          if (PER_SAMPLE[sid].models[m][a].logprobs) return true;
        }
      }
    }
    return false;
  });

  const selM = document.getElementById('conf-model-sel');
  selM.innerHTML = modelsWithLP.map((m,i) => `<option value="${m}" ${i===0?'selected':''}>${esc(m)}</option>`).join('');
  confState.model = modelsWithLP[0] || MODELS[0];

  const selA = document.getElementById('conf-attack-sel');
  selA.innerHTML = ['baseline', ...ATTACKS].map((a,i) => `<option value="${a}" ${i===0?'selected':''}>${a==='baseline'?'Baseline':(ATTACK_LABELS[a]||a)}</option>`).join('');
  confState.attack = 'baseline';

  selM.onchange = () => { confState.model = selM.value; renderConfidenceContent(); };
  selA.onchange = () => { confState.attack = selA.value; renderConfidenceContent(); };

  renderConfidenceContent();
}

function renderConfidenceContent() {
  const model = confState.model;
  const attack = confState.attack;

  // Collect logprobs data for this model+attack
  const maxLogprobs = [];
  const entropies = [];
  const topK = {1:0, 2:0, 3:0, 4:0, 5:0};
  const calibration = {}; // bucket -> {correct, total}

  for (const sid in PER_SAMPLE) {
    const s = PER_SAMPLE[sid];
    const sd = s.models[model]?.[attack];
    if (!sd || !sd.logprobs) continue;

    const lp = sd.logprobs;
    const vals = Object.values(lp);

    // Max logprob
    maxLogprobs.push(Math.max(...vals));

    // Entropy
    const maxV = Math.max(...vals);
    const exps = vals.map(v => Math.exp(v - maxV));
    const sumE = exps.reduce((a,b)=>a+b, 0);
    const probs = exps.map(v => v/sumE);
    const entropy = -probs.reduce((acc,p) => acc + (p>0 ? p*Math.log2(p):0), 0);
    entropies.push(entropy);

    // Top-k accuracy
    const sorted = Object.entries(lp).sort((a,b) => b[1]-a[1]).map(e => parseInt(e[0]));
    const expected = s.expected;
    for (let k = 1; k <= 5; k++) {
      if (sorted.slice(0,k).includes(expected)) topK[k]++;
    }

    // Calibration
    const correctIdx = String(expected);
    const correctLp = lp[correctIdx];
    if (correctLp != null) {
      const allLp = Object.values(lp);
      const maxLp = Math.max(...allLp);
      const exps2 = allLp.map(v => Math.exp(v - maxLp));
      const sumE2 = exps2.reduce((a,b)=>a+b,0);
      const correctProb = Math.exp(correctLp - maxLp) / sumE2;
      const bucket = Math.floor(correctProb * 10) / 10;
      const key = bucket.toFixed(1);
      if (!calibration[key]) calibration[key] = {correct:0, total:0};
      calibration[key].total++;
      if (sd.correct) calibration[key].correct++;
    }
  }

  const totalWithLP = maxLogprobs.length;

  // Remove any previous empty overlays
  document.querySelectorAll('.conf-empty-overlay').forEach(el => el.remove());

  if (totalWithLP === 0) {
    ['chart-confidence','chart-entropy','chart-topk','chart-calibration'].forEach(id => {
      destroyChart(id);
      const el = document.getElementById(id);
      if (el) {
        const container = el.parentElement;
        const overlay = document.createElement('div');
        overlay.className = 'empty-msg conf-empty-overlay';
        overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1';
        overlay.textContent = 'No logprobs for this selection.';
        container.style.position = 'relative';
        container.appendChild(overlay);
      }
    });
    return;
  }

  // Confidence histogram
  const confBuckets = Array(20).fill(0);
  const confMin = Math.min(...maxLogprobs);
  const confMax = Math.max(...maxLogprobs);
  const confRange = confMax - confMin || 1;
  maxLogprobs.forEach(v => {
    const idx = Math.min(19, Math.floor((v - confMin) / confRange * 20));
    confBuckets[idx]++;
  });
  const confLabels = confBuckets.map((_,i) => (confMin + confRange * i / 20).toFixed(1));

  makeChart('chart-confidence', 'bar', confLabels, [{
    label: 'Frequency',
    data: confBuckets,
    backgroundColor: '#4fc3f799',
    borderColor: '#4fc3f7',
    borderWidth: 1
  }]);

  // Entropy histogram
  const entBuckets = Array(20).fill(0);
  const entMin = Math.min(...entropies);
  const entMax = Math.max(...entropies);
  const entRange = entMax - entMin || 1;
  entropies.forEach(v => {
    const idx = Math.min(19, Math.floor((v - entMin) / entRange * 20));
    entBuckets[idx]++;
  });
  const entLabels = entBuckets.map((_,i) => (entMin + entRange * i / 20).toFixed(2));

  makeChart('chart-entropy', 'bar', entLabels, [{
    label: 'Frequency',
    data: entBuckets,
    backgroundColor: '#a78bfa99',
    borderColor: '#a78bfa',
    borderWidth: 1
  }]);

  // Top-k accuracy
  const total = totalWithLP;
  makeChart('chart-topk', 'bar',
    ['Top-1', 'Top-2', 'Top-3', 'Top-4', 'Top-5'],
    [{
      data: [1,2,3,4,5].map(k => (topK[k]/total*100)),
      backgroundColor: ['#4fc3f799','#00c87099','#f0a03099','#a78bfa99','#ec489999'],
      borderColor: ['#4fc3f7','#00c870','#f0a030','#a78bfa','#ec4899'],
      borderWidth: 1
    }],
    { yScale: { ticks: { callback: v => v.toFixed(0)+'%' }, min: 0, max: 100 } }
  );

  // Calibration curve
  const calKeys = Object.keys(calibration).sort((a,b) => parseFloat(a)-parseFloat(b));
  const calData = calKeys.map(k => {
    const c = calibration[k];
    return c.total > 0 ? c.correct / c.total : 0;
  });

  makeChart('chart-calibration', 'line',
    calKeys,
    [{
      label: 'Actual Accuracy',
      data: calData,
      borderColor: '#4fc3f7',
      backgroundColor: '#4fc3f733',
      borderWidth: 2,
      pointRadius: 4,
      fill: true
    }],
    {
      yScale: { ticks: { callback: v => (v*100).toFixed(0)+'%' }, min: 0, max: 1 },
      extra: {
        plugins: {
          annotation: undefined
        }
      }
    }
  );
}

// -----------------------------------------------------------------
// 9. TAB 5: SAMPLE PATTERNS
// -----------------------------------------------------------------
let patternsState = { model: null, task: '(all)', minFlips: 0 };

function renderPatterns() {
  if (!patternsState.model && MODELS.length > 0) patternsState.model = MODELS[0];

  // Task selector
  const selT = document.getElementById('patterns-task-sel');
  selT.innerHTML = '<option value="(all)">All Tasks</option>' + TASKS.map(t => `<option value="${t}">${TASK_LABELS[t]||t}</option>`).join('');
  selT.onchange = () => { patternsState.task = selT.value; renderPatternsContent(); };

  // Min flips selector
  const selF = document.getElementById('patterns-minflips-sel');
  selF.innerHTML = Array.from({length: ATTACKS.length+1}, (_,i) => `<option value="${i}" ${i===0?'selected':''}>=${i}</option>`).join('');
  selF.onchange = () => { patternsState.minFlips = parseInt(selF.value); renderPatternsContent(); };

  // Model selector (add to controls)
  const controls = document.querySelector('#panel-patterns .controls');
  if (controls && MODELS.length > 1) {
    const selM = document.createElement('select');
    selM.innerHTML = MODELS.map((m,i) => `<option value="${m}" ${i===0?'selected':''}>${esc(m)}</option>`).join('');
    selM.onchange = () => { patternsState.model = selM.value; renderPatternsContent(); };
    const lbl = document.createElement('label');
    lbl.textContent = 'Model';
    controls.insertBefore(lbl, controls.firstChild);
    controls.insertBefore(selM, controls.firstChild.nextSibling);
  }

  renderPatternsContent();
}

function renderPatternsContent() {
  const model = patternsState.model;
  if (!model) return;

  // Compute flip data per sample
  const flips = {}; // sid -> count of attacks that flip from baseline correct to attack incorrect
  const taskFlips = {}; // task -> attack -> count

  for (const sid in PER_SAMPLE) {
    const s = PER_SAMPLE[sid];
    if (patternsState.task !== '(all)' && s.task !== patternsState.task) continue;

    const bl = s.models[model]?.baseline;
    if (!bl || !bl.correct) continue; // only consider baseline-correct samples

    let flipCount = 0;
    ATTACKS.forEach(a => {
      const ad = s.models[model]?.[a];
      if (ad && !ad.correct) {
        flipCount++;
        taskFlips[s.task] = taskFlips[s.task] || {};
        taskFlips[s.task][a] = (taskFlips[s.task][a] || 0) + 1;
      }
    });
    flips[sid] = flipCount;
  }

  // Flip hardness histogram
  const hardness = Array(ATTACKS.length + 1).fill(0);
  for (const sid in flips) hardness[flips[sid]]++;

  makeChart('chart-flip-hardness', 'bar',
    Array.from({length: ATTACKS.length+1}, (_,i) => i === 0 ? '0 (stable)' : `${i} flip${i>1?'s':''}`),
    [{
      label: 'Samples',
      data: hardness,
      backgroundColor: hardness.map((_,i) => i === 0 ? '#00c87099' : i <= 2 ? '#f0a03099' : '#f0555599'),
      borderColor: hardness.map((_,i) => i === 0 ? '#00c870' : i <= 2 ? '#f0a030' : '#f05555'),
      borderWidth: 1
    }]
  );

  // Task vulnerability stacked bar
  const taskData = {};
  TASKS.forEach(t => {
    taskData[t] = {};
    ATTACKS.forEach(a => { taskData[t][a] = 0; });
  });
  for (const t in taskFlips) {
    for (const a in taskFlips[t]) {
      if (taskData[t]) taskData[t][a] = taskFlips[t][a];
    }
  }

  const datasets = ATTACKS.map((a, i) => ({
    label: ATTACK_LABELS[a]||a,
    data: TASKS.map(t => taskData[t]?.[a] || 0),
    backgroundColor: COLORS[i % COLORS.length] + '99',
    borderColor: COLORS[i % COLORS.length],
    borderWidth: 1
  }));

  makeChart('chart-task-vuln', 'bar',
    TASKS.map(t => TASK_LABELS[t]||t),
    datasets,
    { extra: { scales: { x: { stacked: true }, y: { stacked: true } } } }
  );

  // Sample explorer table
  const wrap = document.getElementById('patterns-table-wrap');
  const rows = Object.entries(flips)
    .filter(([,c]) => c >= patternsState.minFlips)
    .sort((a,b) => b[1]-a[1]);

  let html = '<table class="data-table"><thead><tr><th>Sample</th><th>Task</th><th>Flips</th>';
  ATTACKS.forEach(a => { html += `<th>${ATTACK_LABELS[a]||a}</th>`; });
  html += '</tr></thead><tbody>';

  rows.forEach(([sid, count]) => {
    const s = PER_SAMPLE[sid];
    html += `<tr><td>${sid}</td><td>${TASK_LABELS[s.task]||s.task}</td><td>${count}</td>`;
    ATTACKS.forEach(a => {
      const ad = s.models[model]?.[a];
      if (ad) {
        const cls = ad.correct ? 'cell-good' : 'cell-bad';
        html += `<td class="${cls}">${ad.correct?'✓':'✗'}</td>`;
      } else {
        html += '<td class="cell-na">—</td>';
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// -----------------------------------------------------------------
// 10. TAB 6: MODEL COMPARISON
// -----------------------------------------------------------------
let cmpState = { modelA: null, modelB: null };

function renderComparison() {
  if (MODELS.length < 2) {
    document.getElementById('panel-comparison').innerHTML = '<div class="empty-msg">Need at least 2 models for comparison.</div>';
    return;
  }

  const selA = document.getElementById('cmp-model-a-sel');
  const selB = document.getElementById('cmp-model-b-sel');
  selA.innerHTML = MODELS.map((m,i) => `<option value="${m}" ${i===0?'selected':''}>${esc(m)}</option>`).join('');
  selB.innerHTML = MODELS.map((m,i) => `<option value="${m}" ${i===1?'selected':''}>${esc(m)}</option>`).join('');
  cmpState.modelA = MODELS[0];
  cmpState.modelB = MODELS[1];

  selA.onchange = () => { cmpState.modelA = selA.value; renderComparisonContent(); };
  selB.onchange = () => { cmpState.modelB = selB.value; renderComparisonContent(); };

  renderComparisonContent();
}

function renderComparisonContent() {
  const mA = cmpState.modelA, mB = cmpState.modelB;
  if (!mA || !mB) return;

  // Head-to-head stats on baseline
  let bothCorrect = 0, bothWrong = 0, aOnly = 0, bOnly = 0, total = 0;

  for (const sid in PER_SAMPLE) {
    const s = PER_SAMPLE[sid];
    const a = s.models[mA]?.baseline;
    const b = s.models[mB]?.baseline;
    if (!a || !b) continue;
    total++;
    if (a.correct && b.correct) bothCorrect++;
    else if (!a.correct && !b.correct) bothWrong++;
    else if (a.correct) aOnly++;
    else bOnly++;
  }

  const agree = bothCorrect + bothWrong;
  document.getElementById('cmp-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${fmtPct(agree/total)}</div><div class="stat-label">Agreement</div></div>
    <div class="stat-card"><div class="stat-value">${fmtPct(bothCorrect/total)}</div><div class="stat-label">Both Correct</div></div>
    <div class="stat-card"><div class="stat-value">${fmtPct(aOnly/total)}</div><div class="stat-label">${esc(mA.length>20?mA.slice(0,17)+'...':mA)} Only</div></div>
    <div class="stat-card"><div class="stat-value">${fmtPct(bOnly/total)}</div><div class="stat-label">${esc(mB.length>20?mB.slice(0,17)+'...':mB)} Only</div></div>
    <div class="stat-card"><div class="stat-value">${fmtPct(bothWrong/total)}</div><div class="stat-label">Both Wrong</div></div>
  `;

  // Scatter plot: per-task accuracy
  const scatterData = TASKS.map(t => {
    const accA = getBaselineAccuracy(mA, t) ?? 0;
    const accB = getBaselineAccuracy(mB, t) ?? 0;
    return { x: accA, y: accB, label: TASK_LABELS[t]||t };
  });

  destroyChart('chart-scatter');
  const ctx = document.getElementById('chart-scatter');
  if (ctx) {
    charts['chart-scatter'] = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          data: scatterData,
          backgroundColor: '#4fc3f799',
          borderColor: '#4fc3f7',
          borderWidth: 2,
          pointRadius: 8,
          pointHoverRadius: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: mA.length>25?mA.slice(0,22)+'...':mA+' Accuracy', color: '#888' }, ticks: { color: '#666', callback: v => (v*100).toFixed(0)+'%' }, grid: { color: '#1a1a1a' } },
          y: { title: { display: true, text: mB.length>25?mB.slice(0,22)+'...':mB+' Accuracy', color: '#888' }, ticks: { color: '#666', callback: v => (v*100).toFixed(0)+'%' }, grid: { color: '#1a1a1a' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            callbacks: {
              label: ctx => {
                const d = ctx.raw;
                return `${d.label}: ${mA}=${(d.x*100).toFixed(1)}%, ${mB}=${(d.y*100).toFixed(1)}%`;
              }
            }
          }
        }
      }
    });
  }

  // Agreement donut
  makeChart('chart-agreement', 'doughnut',
    ['Both Correct', `${esc(mA.length>15?mA.slice(0,12)+'...':mA)} Only`, `${esc(mB.length>15?mB.slice(0,12)+'...':mB)} Only`, 'Both Wrong'],
    [{
      data: [bothCorrect, aOnly, bOnly, bothWrong],
      backgroundColor: ['#00c87099','#4fc3f799','#a78bfa99','#f0555599'],
      borderColor: ['#00c870','#4fc3f7','#a78bfa','#f05555'],
      borderWidth: 2
    }]
  );
}

// -----------------------------------------------------------------
// 11. ESCAPE HELPER
// -----------------------------------------------------------------
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// -----------------------------------------------------------------
// 12. INFO BAR
// -----------------------------------------------------------------
function renderInfoBar() {
  const info = DATA.info || {};
  const started = info.started_at ? info.started_at.slice(0,19).replace('T',' ') : '—';
  const finished = info.finished_at ? info.finished_at.slice(0,19).replace('T',' ') : '—';
  const status = info.is_finished ? '<span class="status-ok">Completed</span>' : '<span class="status-partial">Partial</span>';

  document.getElementById('info-bar').innerHTML = `
    <span><strong>Start:</strong>${esc(started)}</span>
    <span><strong>End:</strong>${esc(finished)}</span>
    <span><strong>Dataset:</strong>${esc(info.baseline||'—')}</span>
    <span><strong>Status:</strong>${status}</span>
    <span><strong>Per-sample data:</strong>${PER_SAMPLE && Object.keys(PER_SAMPLE).length > 0 ? Object.keys(PER_SAMPLE).length + ' samples' : '—'}</span>
  `;
}

// -----------------------------------------------------------------
// 13. INIT
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initData();
  renderInfoBar();
  setupTabs();
  showTab('overview');
});
