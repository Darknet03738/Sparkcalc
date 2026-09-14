// ═══════════════════════════════════════════════════════════════
const N_HARM = 40;
let harmV = new Array(N_HARM+1).fill(0);  // stores RAW input (peak or rms depending on mode)
let harmI = new Array(N_HARM+1).fill(0);
let inputMode = 'voltage';
let amplitudeMode = 'rms'; // 'rms' or 'peak'
let manualVoltageLevel = false; // Track if user manually changed it

// ── Helpers: always return RMS regardless of input mode ──
function rmsV(n) { return amplitudeMode === 'peak' ? (harmV[n] || 0) / Math.SQRT2 : (harmV[n] || 0); }
function rmsI(n) { return amplitudeMode === 'peak' ? (harmI[n] || 0) / Math.SQRT2 : (harmI[n] || 0); }
function peakV(n) { return amplitudeMode === 'peak' ? (harmV[n] || 0) : (harmV[n] || 0) * Math.SQRT2; }
function peakI(n) { return amplitudeMode === 'peak' ? (harmI[n] || 0) : (harmI[n] || 0) * Math.SQRT2; }
// Arrays of all RMS values (for sums)
function allRmsV() { const a=[0]; for(let n=1;n<=N_HARM;n++) a.push(rmsV(n)); return a; }
function allRmsI() { const a=[0]; for(let n=1;n<=N_HARM;n++) a.push(rmsI(n)); return a; }

let waveAnglesV=[], waveFundV=[], waveFourierV=[];
let waveAnglesI=[], waveFundI=[], waveFourierI=[];

let chartHarms=null, chartFourier=null;
let chartSpecV=null, chartSpecI=null, chartVrms=null, chartIrms=null;
let selectedHarms = new Set([1, 3, 5]);
const hideEl=(el)=>{ if(!el) return; el.classList.add('is-hidden'); el.style.display='none'; };
const showBlock=(el)=>{ if(!el) return; el.classList.remove('is-hidden'); el.style.display='block'; };
const isHidden=(el)=>!el || el.classList.contains('is-hidden') || el.style.display==='none';

// ═══════════════════════════════════════════════════════════════
// NTC 5001 LIMITS
// ═══════════════════════════════════════════════════════════════
function autoDetectVoltageLevel(v1) {
  if (v1 <= 0) return 'bt';
  if (v1 <= 1000) return 'bt';
  if (v1 <= 69000) return 'mt1';
  if (v1 <= 161000) return 'mt2';
  return 'at';
}

function getTHDvLimit() {
  const level = document.getElementById('voltageLevel').value;
  // BT: NTC 5001 §7.9.5 no define límites explícitos para BT.
  // Se usa MT1 como referencia conservadora (práctica habitual en Colombia).
  if (level === 'bt' || level === 'mt1') return { individual:3.0, thd:5.0, label:'1kV < Vn ≤ 69kV', isBT: level==='bt' };
  if (level === 'mt2') return { individual:1.5, thd:2.5, label:'69kV < Vn ≤ 161kV', isBT: false };
  return { individual:1.0, thd:1.5, label:'Vn ≥ 161kV', isBT: false };
}

function getCurrentLimitsTable() {
  const level = document.getElementById('voltageLevel').value;
  if (level === 'bt' || level === 'mt1') return {
    label: '120V < Vn ≤ 69kV',
    rows: [
      { label:'< 20',     maxRatio:20,       tdd:5.0,  h:[4.0,2.0,1.5,0.6,0.3] },
      { label:'20 < 50',  maxRatio:50,       tdd:8.0,  h:[7.0,3.5,2.5,1.0,0.5] },
      { label:'50 < 100', maxRatio:100,      tdd:12.0, h:[10.0,4.5,4.0,1.5,0.7] },
      { label:'100<1000', maxRatio:1000,     tdd:15.0, h:[12.0,5.5,5.0,2.0,1.0] },
      { label:'> 1000',   maxRatio:Infinity, tdd:20.0, h:[15.0,7.0,6.0,2.5,1.4] },
    ]
  };
  if (level === 'mt2') return {
    label: '69kV < Vn ≤ 161kV',
    rows: [
      { label:'< 20',     maxRatio:20,       tdd:2.5,  h:[2.0,1.0,0.75,0.3,0.15] },
      { label:'20 < 50',  maxRatio:50,       tdd:4.0,  h:[3.5,1.75,1.25,0.5,0.25] },
      { label:'50 < 100', maxRatio:100,      tdd:6.0,  h:[5.0,2.25,2.0,0.75,0.35] },
      { label:'100<1000', maxRatio:1000,     tdd:7.5,  h:[6.0,2.75,2.5,1.0,0.5] },
      { label:'> 1000',   maxRatio:Infinity, tdd:10.0, h:[7.5,3.5,3.0,1.25,0.7] },
    ]
  };
  return {
    label: 'Vn > 161kV',
    rows: [
      { label:'< 25',  maxRatio:25,       tdd:1.5,  h:[1.0,0.5,0.38,0.15,0.1] },
      { label:'25<50',  maxRatio:50,       tdd:2.5,  h:[2.0,1.0,0.75,0.3,0.15] },
      { label:'≥ 50',   maxRatio:Infinity, tdd:3.75, h:[3.0,1.5,1.15,0.45,0.22] },
    ]
  };
}

function getTDDLimit() {
  const table = getCurrentLimitsTable();
  const sel = document.getElementById('iscIlSelect');
  const idx = sel ? (parseInt(sel.value) || 0) : 0;
  return table.rows[Math.min(idx, table.rows.length - 1)];
}

function getIndividualCurrentLimit(h) {
  const limit = getTDDLimit();
  if (h < 11)  return limit.h[0];
  if (h < 17)  return limit.h[1];
  if (h < 23)  return limit.h[2];
  if (h < 35)  return limit.h[3];
  return limit.h[4];
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
window.addEventListener('load', function() {
  buildHarmTable();
  buildHarmSelector();
  buildNormTableI();
  buildIscIlSelect();

  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => showTab(parseInt(btn.dataset.tab)));
  });

  setupToggleGroup('inputTypeToggle', val => {
    inputMode = val;
    document.getElementById('inputModePill').textContent = val === 'voltage' ? 'TENSIÓN' : 'CORRIENTE';
    updateTableHeaders();
    buildHarmTable();
  });

  setupToggleGroup('amplitudeTypeToggle', val => {
    amplitudeMode = val;
    const isPeak = val === 'peak';
    document.getElementById('ampModePill').textContent = isPeak ? 'PICO' : 'RMS';
    document.getElementById('ampModePill').style.background = isPeak ? '#FF851B' : 'var(--accent3)';
    document.getElementById('ampTypeHint').innerHTML = isPeak
      ? 'Los valores se interpretan como <b style="color:#FF851B">PICO</b>. Internamente se convierten a RMS (÷√2).'
      : 'Los valores se interpretan como <b>RMS</b>.';
    updateTableHeaders();
    buildHarmTable();
  });

  setupToggleGroup('harmSignalToggle', () => updateHarmChart());
  document.getElementById('harmCycles').addEventListener('input', () => updateHarmChart());

  setupToggleGroup('fourierSignalToggle', () => updateFourierChart());
  setupToggleGroup('fourierShowToggle', () => updateFourierChart());
  document.getElementById('fourierCycles').addEventListener('input', () => updateFourierChart());

  // When voltage level changes manually
  document.getElementById('voltageLevel').addEventListener('change', () => {
    manualVoltageLevel = true;
    document.getElementById('autoDetectBadge').textContent = 'MANUAL';
    document.getElementById('autoDetectBadge').style.background = 'rgba(255,208,0,.2)';
    document.getElementById('autoDetectBadge').style.color = 'var(--accent)';
    buildIscIlSelect(); // Rebuild Isc/IL options for new voltage level
    manualIscIl = false; // reset manual override so it re-auto-selects
    buildNormTableI();
  });

  // Build Isc/IL select options based on current voltage level
  function buildIscIlSelect() {
    const table = getCurrentLimitsTable();
    const sel = document.getElementById('iscIlSelect');
    const currentVal = +document.getElementById('iscIl').value || 20;
    sel.innerHTML = '';
    table.rows.forEach((row, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = 'Isc/IL ' + row.label + '  →  TDD límite: ' + row.tdd + '%';
      sel.appendChild(opt);
    });
    // Select the row matching current ratio
    autoSelectIscIlRange(currentVal, false);
  }

  function autoSelectIscIlRange(ratio, isManual) {
    if (isManual) return; // don't override if user manually picked
    const table = getCurrentLimitsTable();
    const sel = document.getElementById('iscIlSelect');
    let idx = table.rows.length - 1;
    for (let i = 0; i < table.rows.length; i++) {
      if (ratio < table.rows[i].maxRatio || table.rows[i].maxRatio === Infinity) { idx = i; break; }
    }
    sel.value = idx;
  }

  let manualIscIl = false;

  // IL changes recalculate ratio
  document.getElementById('ilValue').addEventListener('input', () => {
    const il = +document.getElementById('ilValue').value || 1;
    const isc = +document.getElementById('iscValue').value || 0;
    const ratio = Math.round(isc / il);
    document.getElementById('iscIl').value = ratio;
    document.getElementById('iscIlCalcVal').textContent = ratio;
    manualIscIl = false;
    autoSelectIscIlRange(ratio, false);
    buildNormTableI();
  });

  // Manual Isc input - mark as manual
  document.getElementById('iscValue').addEventListener('input', () => {
    const badge = document.getElementById('autoIscBadge');
    badge.textContent = 'MANUAL';
    badge.style.background = '';
    badge.style.color = '';
    const il = +document.getElementById('ilValue').value || 1;
    const isc = +document.getElementById('iscValue').value || 0;
    const ratio = Math.round(isc / il);
    document.getElementById('iscIl').value = ratio;
    document.getElementById('iscIlCalcVal').textContent = ratio;
    manualIscIl = false;
    autoSelectIscIlRange(ratio, false);
    buildNormTableI();
  });

  // Toggle transformer calculator panel
  document.getElementById('btnToggleTrafo').addEventListener('click', () => {
    const panel = document.getElementById('trafoCalcPanel');
    const isVisible = !isHidden(panel);
    isVisible ? hideEl(panel) : showBlock(panel);
    document.getElementById('btnToggleTrafo').textContent = isVisible
      ? '⚙ Calcular desde datos del transformador'
      : '✕ Cerrar calculador';
  });

  // Calculate Isc from transformer data
  document.getElementById('btnCalcIsc').addEventListener('click', () => {
    const kva = +document.getElementById('trafoKVA').value || 0;
    const vn  = +document.getElementById('trafoVn').value || 1;
    const zcc = +document.getElementById('trafoZcc').value || 1;
    if (kva <= 0 || vn <= 0 || zcc <= 0) {
      document.getElementById('iscCalcResult').textContent = '⚠ Verifique los datos ingresados';
      return;
    }
    // Isc_3f = S / (√3 × Vn × Zcc/100)
    const isc = (kva * 1000) / (Math.sqrt(3) * vn * (zcc / 100));
    document.getElementById('iscValue').value = isc.toFixed(1);
    document.getElementById('iscCalcResult').innerHTML =
      `Isc = ${(kva*1000).toFixed(0)} / (√3 × ${vn} × ${(zcc/100).toFixed(4)}) = <b style="color:var(--accent3)">${isc.toFixed(1)} A</b>`;
    // Update badge and recalculate ratio
    const badge = document.getElementById('autoIscBadge');
    badge.textContent = 'AUTO-CALCULADO';
    badge.style.background = 'rgba(0,116,217,.2)';
    badge.style.color = 'var(--accent3)';
    const il = +document.getElementById('ilValue').value || 1;
    const ratio = Math.round(isc / il);
    document.getElementById('iscIl').value = ratio;
    document.getElementById('iscIlCalcVal').textContent = ratio;
    manualIscIl = false;
    autoSelectIscIlRange(ratio, false);
    buildNormTableI();
  });

  // Also auto-calc when transformer inputs change
  ['trafoKVA','trafoVn','trafoZcc'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      document.getElementById('btnCalcIsc').click();
    });
  });

  // Manual select override
  document.getElementById('iscIlSelect').addEventListener('change', () => {
    manualIscIl = true;
    const badge = document.getElementById('autoIscIlBadge');
    badge.textContent = 'MANUAL';
    badge.style.background = 'rgba(255,208,0,.2)';
    badge.style.color = 'var(--accent)';
    buildNormTableI();
  });

  document.getElementById('harm_table').addEventListener('input', function(e) {
    const inp = e.target;
    const n = parseInt(inp.dataset.hnum);
    if (!n) return;
    if (inputMode === 'voltage') {
      harmV[n] = parseFloat(inp.value) || 0;
      // Auto-detect voltage level from V1
      if (n === 1 && !manualVoltageLevel) {
        const detected = autoDetectVoltageLevel(rmsV(1));
        document.getElementById('voltageLevel').value = detected;
        buildNormTableI();
      }
    } else {
      harmI[n] = parseFloat(inp.value) || 0;
    }
    updateTableRow(n);
  });

  document.getElementById('btnClear').addEventListener('click', clearAll);
  document.getElementById('btnCalc').addEventListener('click', recalc);

  // Load whiteboard example
  document.getElementById('btnNeutralExample').addEventListener('click', () => {
    // Whiteboard peak values: I1=20, I3=16, I5=11, I7=6, I9=3, I11=2
    const examplePeak = { 1:20, 3:16, 5:11, 7:6, 9:3, 11:2 };

    // Switch to current mode if not already
    if (inputMode !== 'current') {
      const toggleBtns = document.getElementById('inputTypeToggle').querySelectorAll('button');
      toggleBtns.forEach(b => b.classList.remove('active'));
      toggleBtns[1].classList.add('active');
      inputMode = 'current';
      document.getElementById('inputModePill').textContent = 'CORRIENTE';
    }

    // Switch global amplitude to peak mode
    amplitudeMode = 'peak';
    const ampBtns = document.getElementById('amplitudeTypeToggle').querySelectorAll('button');
    ampBtns.forEach(b => b.classList.remove('active'));
    ampBtns[1].classList.add('active');
    document.getElementById('ampModePill').textContent = 'PICO';
    document.getElementById('ampModePill').style.background = '#FF851B';
    document.getElementById('ampTypeHint').innerHTML =
      'Los valores se interpretan como <b style="color:#FF851B">PICO</b>. Internamente se convierten a RMS (÷√2). <span style="color:#FF851B;">Ejemplo del tablero cargado.</span>';

    // Clear all currents and load example
    for (let n = 1; n <= N_HARM; n++) harmI[n] = 0;
    for (const [h, pk] of Object.entries(examplePeak)) {
      harmI[+h] = pk; // store as peak — all calcs will use rmsI(n)
    }

    updateTableHeaders();
    buildHarmTable();
    recalc();

    // Scroll to neutral section
    setTimeout(() => {
      showTab(3);
      setTimeout(() => {
        const el = document.getElementById('neutralMetrics');
        if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
      }, 200);
    }, 300);
  });
});

function setupToggleGroup(id, callback) {
  const group = document.getElementById(id);
  group.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callback(btn.dataset.val);
    });
  });
}
function getToggleValue(id) {
  const active = document.getElementById(id).querySelector('button.active');
  return active ? active.dataset.val : '';
}

// ═══════════════════════════════════════════════════════════════
// TABLE
// ═══════════════════════════════════════════════════════════════
function updateTableHeaders() {
  const isV = inputMode === 'voltage';
  const isPeak = amplitudeMode === 'peak';
  const u = isV ? 'V' : 'A';
  const lbl = isV ? 'V' : 'I';
  if (isPeak) {
    document.getElementById('thInputCol').innerHTML = `${lbl} Pico (${u}) <span style="font-size:.6rem;color:#FF851B;">ENTRADA</span>`;
    document.getElementById('thConvCol').innerHTML = `${lbl} RMS (${u}) <span style="font-size:.6rem;color:var(--accent3);">÷√2</span>`;
  } else {
    document.getElementById('thInputCol').innerHTML = `${lbl} RMS (${u}) <span style="font-size:.6rem;color:var(--accent3);">ENTRADA</span>`;
    document.getElementById('thConvCol').innerHTML = `${lbl} Pico (${u}) <span style="font-size:.6rem;color:var(--text2);">×√2</span>`;
  }
  document.getElementById('thDh').textContent = isV ? 'd_H Tensión (%)' : 'd_H Corriente (%)';
}

function buildHarmTable() {
  const tbody = document.getElementById('harm_table');
  tbody.innerHTML = '';
  const f1 = +document.getElementById('p_f1').value || 60;
  const isV = inputMode === 'voltage';
  const isPeak = amplitudeMode === 'peak';
  const arr = isV ? harmV : harmI;
  const getRms = isV ? rmsV : rmsI;
  const base = getRms(1) || 1; // base is always RMS of fundamental

  for (let n = 1; n <= N_HARM; n++) {
    const tr = document.createElement('tr');
    const rms_n = getRms(n);
    const peak_n = isV ? peakV(n) : peakI(n);
    const dH = base > 0 ? (rms_n / base * 100) : 0;
    const isFund = n === 1;
    const style = isFund ? 'style="background:rgba(0,112,60,.15)"' : '';
    const badgeCls = isFund ? 'thd-fund' : badgeClass(dH, isV);
    // Converted column value
    const convVal = isPeak ? rms_n : peak_n;
    const convColor = isPeak ? 'color:var(--accent3)' : 'color:var(--text2)';
    tr.innerHTML = `
      <td class="harm-num" ${style}>${n}${isFund?' ★':''}</td>
      <td style="font-family:var(--mono);color:var(--text2)">${(n*f1).toFixed(1)}</td>
      <td class="input-cell"><input class="harmonic-input" type="number" id="hinp_${n}" value="${arr[n]}" step="0.01" min="0" data-hnum="${n}" title="Amplitud del armonico H${n}" aria-label="Amplitud del armonico H${n}" placeholder="0.00"></td>
      <td style="font-family:var(--mono);${convColor}" id="hconv_${n}">${convVal.toFixed(3)}</td>
      <td id="hdh_${n}"><span class="thd-badge ${badgeCls}">${isFund?'FUND':dH.toFixed(2)+'%'}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

function updateTableRow(n) {
  const isV = inputMode === 'voltage';
  const isPeak = amplitudeMode === 'peak';
  const getRms = isV ? rmsV : rmsI;
  const getPeak = isV ? peakV : peakI;
  const base = getRms(1) || 1;
  const rms_n = getRms(n);
  const dH = base > 0 ? (rms_n / base * 100) : 0;
  const convEl = document.getElementById('hconv_' + n);
  const dhEl = document.getElementById('hdh_' + n);
  const convVal = isPeak ? rms_n : getPeak(n);
  if (convEl) convEl.textContent = convVal.toFixed(3);
  if (n === 1) {
    if (dhEl) dhEl.innerHTML = '<span class="thd-badge thd-fund">FUND</span>';
    for (let i = 2; i <= N_HARM; i++) updateTableRow(i);
  } else {
    const cls = badgeClass(dH, isV);
    if (dhEl) dhEl.innerHTML = `<span class="thd-badge ${cls}">${dH.toFixed(2)}%</span>`;
  }
}

function badgeClass(pct, isV) {
  if (isV === undefined) isV = true;
  const limit = isV ? getTHDvLimit().individual : getIndividualCurrentLimit(2);
  if (pct <= limit) return 'thd-ok';
  if (pct <= limit * 2) return 'thd-warn';
  return 'thd-bad';
}

function clearAll() {
  for (let n = 1; n <= N_HARM; n++) {
    harmV[n] = 0; harmI[n] = 0;
  }
  manualVoltageLevel = false;
  document.getElementById('autoDetectBadge').textContent = 'AUTO-DETECTADO';
  document.getElementById('autoDetectBadge').style.background = 'rgba(0,116,217,.2)';
  document.getElementById('autoDetectBadge').style.color = 'var(--accent3)';
  buildHarmTable();
}

function buildNormTableI() {
  const table = getCurrentLimitsTable();
  const tbody = document.getElementById('normTableIBody');
  const sel = document.getElementById('iscIlSelect');
  const activeIdx = sel ? (parseInt(sel.value) || 0) : 0;
  tbody.innerHTML = '';
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const tr = document.createElement('tr');
    if (i === activeIdx) tr.classList.add('highlight');
    tr.innerHTML = `<td>${row.label}</td><td>${row.h[0]}</td><td>${row.h[1]}</td><td>${row.h[2]}</td><td>${row.h[3]}</td><td>${row.h[4]}</td><td>${row.tdd}</td>`;
    tbody.appendChild(tr);
  }
}

function buildHarmSelector() {
  const div = document.getElementById('harm_selector');
  div.innerHTML = '';
  for (let n = 1; n <= N_HARM; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm harmonic-toggle ${selectedHarms.has(n) ? 'btn-primary active' : ''}`;
    btn.textContent = `H${n}`;
    btn.title = `Superponer armónico H${n}`;
    btn.setAttribute('aria-label', `Superponer armónico H${n}`);
    btn.setAttribute('aria-pressed', String(selectedHarms.has(n)));
    btn.addEventListener('click', () => {
      if (selectedHarms.has(n)) selectedHarms.delete(n); else selectedHarms.add(n);
      btn.className = `btn btn-sm harmonic-toggle ${selectedHarms.has(n) ? 'btn-primary active' : ''}`;
      btn.setAttribute('aria-pressed', String(selectedHarms.has(n)));
      updateHarmChart();
    });
    div.appendChild(btn);
  }
}

// ═══════════════════════════════════════════════════════════════
// CALCULATION
// ═══════════════════════════════════════════════════════════════
function recalc() {
  const loadEl = document.getElementById('loading');
  const msgEl = document.getElementById('load-msg');
  const f1 = +document.getElementById('p_f1').value || 60;
  const cycles = +document.getElementById('harmCycles').value || 2;
  const ptsPerCycle = +document.getElementById('p_res').value || 3600;
  const totalPts = ptsPerCycle * cycles;
  const step_deg = 360 / ptsPerCycle;
  const DEG2RAD = Math.PI / 180;

  // Always use PEAK for waveform synthesis
  const vPeaks = new Array(N_HARM+1).fill(0);
  const iPeaks = new Array(N_HARM+1).fill(0);
  for (let n = 1; n <= N_HARM; n++) {
    vPeaks[n] = peakV(n);
    iPeaks[n] = peakI(n);
  }

  waveAnglesV = new Array(totalPts);
  waveFundV = new Array(totalPts);
  waveFourierV = new Array(totalPts);
  waveAnglesI = new Array(totalPts);
  waveFundI = new Array(totalPts);
  waveFourierI = new Array(totalPts);

  const showLoader = totalPts > 10000;
  if (showLoader) { loadEl.classList.remove('hidden'); msgEl.textContent = 'CALCULANDO...'; }

  const CHUNK = 15000;
  let cursor = 0;

  function calcChunk() {
    const end = Math.min(cursor + CHUNK, totalPts);
    for (let i = cursor; i < end; i++) {
      const deg = i * step_deg;
      const rad = deg * DEG2RAD;
      waveAnglesV[i] = deg; waveAnglesI[i] = deg;
      waveFundV[i] = vPeaks[1] * Math.sin(rad);
      waveFundI[i] = iPeaks[1] * Math.sin(rad);
      let sumV = 0, sumI = 0;
      for (let n = 1; n <= N_HARM; n++) {
        const s = Math.sin(n * rad);
        if (vPeaks[n]) sumV += vPeaks[n] * s;
        if (iPeaks[n]) sumI += iPeaks[n] * s;
      }
      waveFourierV[i] = sumV;
      waveFourierI[i] = sumI;
    }
    cursor = end;
    if (cursor < totalPts) { requestAnimationFrame(calcChunk); }
    else {
      if (showLoader) loadEl.classList.add('hidden');
      updateAllPanels();
    }
  }
  requestAnimationFrame(calcChunk);
}

// ═══════════════════════════════════════════════════════════════
// UPDATE ALL
// ═══════════════════════════════════════════════════════════════
function updateAllPanels() {
  updateHarmChart();
  updateFourierChart();
  updateQuality();
}

function metricHTML(label, value, unit, formula, cls='') {
  return `<div class="metric ${cls}">
    <div class="metric-label">${label}</div>
    <div class="metric-value">${value}<span class="metric-unit">${unit}</span></div>
    <div class="metric-formula">${formula}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════════════
const COLORS_HARM = [
  '#00703C','#FFD000','#0074D9','#FF4136','#2ECC40','#FF69B4',
  '#7FDBFF','#B10DC9','#FFDC00','#39CCCC','#01FF70','#F012BE',
  '#FF851B','#85144b','#3D9970','#001f3f','#AAAAAA','#ffffcc',
  '#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
  '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928',
  '#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#a65628',
  '#f781bf','#999999','#66c2a5','#fc8d62'
];

function sampleWave(arr, step) { const o=[]; for(let i=0;i<arr.length;i+=step) o.push(arr[i]); return o; }
function sampleAngles(a, step) { const o=[]; for(let i=0;i<a.length;i+=step) o.push(a[i].toFixed(1)); return o; }

function chartOpts(yLabel, xLabel) {
  return {
    responsive:true, animation:false,
    plugins: {
      legend:{labels:{color:'#e8f5ee',font:{family:'Barlow Condensed',size:12}}},
      tooltip:{mode:'index',intersect:false},
    },
    scales: {
      x:{title:{display:true,text:xLabel,color:'#7aab8a',font:{size:11}},ticks:{color:'#7aab8a',font:{size:9},maxTicksLimit:20},grid:{color:'rgba(26,51,38,.4)'}},
      y:{title:{display:true,text:yLabel,color:'#7aab8a',font:{size:11}},ticks:{color:'#7aab8a'},grid:{color:'rgba(26,51,38,.4)'}}
    }
  };
}
function chartDefaults(color) { return {borderColor:color,borderWidth:1.5,pointRadius:0,tension:0,fill:false}; }

function updateHarmChart() {
  const isV = getToggleValue('harmSignalToggle') === 'voltage';
  const arr = isV ? harmV : harmI;
  const getPk = isV ? peakV : peakI;
  const unit = isV ? 'V' : 'A';
  const cycles = +document.getElementById('harmCycles').value || 2;
  const f1 = +document.getElementById('p_f1').value || 60;
  const ptsPerCycle = +document.getElementById('p_res').value || 3600;
  const totalPts = ptsPerCycle * cycles;
  const step_deg = 360 / ptsPerCycle;
  const sampleStep = Math.max(1, Math.floor(totalPts / 2000));

  const labels = [];
  for (let i = 0; i < totalPts; i += sampleStep) labels.push((i * step_deg).toFixed(1));

  const datasets = [];
  let ci = 0;
  selectedHarms.forEach(n => {
    if (n < 1 || n > N_HARM || arr[n] === 0) return;
    const vpk = getPk(n);
    const data = [];
    for (let i = 0; i < totalPts; i += sampleStep) {
      data.push(vpk * Math.sin(n * (i * step_deg) * Math.PI / 180));
    }
    datasets.push({ ...chartDefaults(COLORS_HARM[ci % COLORS_HARM.length]), label:`H${n} (${n*f1}Hz)`, data });
    ci++;
  });

  if (chartHarms) chartHarms.destroy();
  chartHarms = new Chart(document.getElementById('chartHarms'), {
    type:'line', data:{labels, datasets}, options:chartOpts(`Amplitud (${unit})`, 'Ángulo (°)')
  });
}

function updateFourierChart() {
  const isV = getToggleValue('fourierSignalToggle') === 'voltage';
  const showMode = getToggleValue('fourierShowToggle');
  const arr = isV ? harmV : harmI;
  const getRms = isV ? rmsV : rmsI;
  const getPk = isV ? peakV : peakI;
  const unit = isV ? 'V' : 'A';
  const cycles = +document.getElementById('fourierCycles').value || 2;
  const f1 = +document.getElementById('p_f1').value || 60;
  const ptsPerCycle = +document.getElementById('p_res').value || 3600;
  const totalPts = ptsPerCycle * cycles;
  const step_deg = 360 / ptsPerCycle;
  const DEG2RAD = Math.PI / 180;
  const sampleStep = Math.max(1, Math.floor(totalPts / 2000));

  if (arr[1] === 0) return;

  const vPeaks = new Array(N_HARM+1).fill(0);
  for (let n = 1; n <= N_HARM; n++) vPeaks[n] = getPk(n);

  const labels = [];
  const fundData = [];
  const fourierData = [];
  for (let i = 0; i < totalPts; i += sampleStep) {
    const deg = i * step_deg;
    const rad = deg * DEG2RAD;
    labels.push(deg.toFixed(1));
    fundData.push(vPeaks[1] * Math.sin(rad));
    let sum = 0;
    for (let n = 1; n <= N_HARM; n++) {
      if (vPeaks[n]) sum += vPeaks[n] * Math.sin(n * rad);
    }
    fourierData.push(sum);
  }

  const datasets = [];
  if (showMode === 'both' || showMode === 'fund')
    datasets.push({...chartDefaults('#0074D9'), label:'Fundamental', data:fundData});
  if (showMode === 'both' || showMode === 'fourier')
    datasets.push({...chartDefaults('#FF4136'), label:'Suma Fourier', data:fourierData});

  if (chartFourier) chartFourier.destroy();
  chartFourier = new Chart(document.getElementById('chartFourier'), {
    type:'line', data:{labels, datasets}, options:chartOpts(`Amplitud (${unit})`, 'Ángulo (°)')
  });

  const U1 = getRms(1) || 1;
  const rmsArr = isV ? allRmsV() : allRmsI();
  const rmsTotal = Math.sqrt(rmsArr.slice(1).reduce((s,v)=>s+v*v,0));
  const res = Math.sqrt(rmsArr.slice(2).reduce((s,v)=>s+v*v,0));
  const thd = res / U1 * 100;
  const pkMax = fourierData.length ? Math.max(...fourierData.map(Math.abs)) : 0;
  const lbl = isV?'V':'I', u2 = isV?'V':'A';
  const limitThd = isV ? getTHDvLimit().thd : getTDDLimit().tdd;

  document.getElementById('fourier_metrics').innerHTML =
    metricHTML(`${lbl}₁ RMS`, U1.toFixed(3), u2, 'Fundamental', 'blue') +
    metricHTML(`${lbl}_RMS Total`, rmsTotal.toFixed(3), u2, `√(Σ${lbl}_H²)`, 'green') +
    metricHTML(`THD_${lbl}`, thd.toFixed(2), '%', `(${lbl}_RES/${lbl}₁)×100`, thd>limitThd?'red':'green') +
    metricHTML(`${lbl}pico máx.`, pkMax.toFixed(3), u2, `max|${lbl.toLowerCase()}(t)|`);
}

function renderMetricCards(U1, Vres, THD_V, vLimit, I1, IL, Ires, TDD, iLimit) {
  const Vrms  = Math.sqrt(U1*U1 + Vres*Vres);
  const Irms  = Math.sqrt(I1*I1 + Ires*Ires);
  const THD_I = I1 > 0 ? (Ires / I1 * 100) : 0;

  const fmt = (v, d=3) => isFinite(v) ? v.toFixed(d) : '—';

  // Tensión
  document.getElementById('mc_V1rms').textContent = fmt(U1);
  document.getElementById('mc_V1pk').textContent  = fmt(U1 * Math.SQRT2);
  document.getElementById('mc_Vrms').textContent  = fmt(Vrms);
  document.getElementById('mc_Vres').textContent  = fmt(Vres);
  document.getElementById('mc_THDv').textContent  = fmt(THD_V, 2);
  document.getElementById('mc_LimV').textContent  = fmt(vLimit.thd, 2);

  // Color THDv card
  const thdvCard = document.getElementById('mc_thdv_card');
  thdvCard.style.borderColor = '';
  if (THD_V > vLimit.thd)          { thdvCard.className='mcard red';  }
  else if (THD_V > vLimit.thd*.8)  { thdvCard.className='mcard'; thdvCard.style.setProperty('--accent','#FFD000'); }
  else                              { thdvCard.className='mcard green'; }

  // Corriente
  document.getElementById('mc_I1rms').textContent = fmt(I1);
  document.getElementById('mc_I1pk').textContent  = fmt(I1 * Math.SQRT2);
  document.getElementById('mc_Irms').textContent  = fmt(Irms);
  document.getElementById('mc_Ires').textContent  = fmt(Ires);
  document.getElementById('mc_TDD').textContent   = fmt(TDD, 2);
  document.getElementById('mc_LimI').textContent  = fmt(iLimit.tdd, 2);

  // Color TDD card
  const tddCard = document.getElementById('mc_tdd_card');
  if (TDD > iLimit.tdd)         { tddCard.className='mcard red'; }
  else if (TDD > iLimit.tdd*.8) { tddCard.className='mcard'; }
  else                          { tddCard.className='mcard green'; }
}

// ═══════════════════════════════════════════════════════════════
// QUALITY
// ═══════════════════════════════════════════════════════════════
function updateQuality() {
  const rv = allRmsV();
  const ri = allRmsI();
  const isPeak = amplitudeMode === 'peak';

  const U1 = rv[1] || 1;
  const I1 = ri[1] || 1;
  const IL = +document.getElementById('ilValue').value || I1;

  const Vres = Math.sqrt(rv.slice(2).reduce((s,v)=>s+v*v,0));
  const THD_V = Vres / U1 * 100;

  const Ires_sq = ri.slice(2).reduce((s,v)=>s+v*v,0);
  const Ires = Math.sqrt(Ires_sq);
  const TDD = IL > 0 ? (Ires / IL * 100) : 0;
  const THD_I = I1 > 0 ? (Ires / I1 * 100) : 0;

  const vLimit = getTHDvLimit();
  const iLimit = getTDDLimit();

  drawGauge('cvGaugeV', THD_V, vLimit.thd, 'THDv');
  drawGauge('cvGaugeI', TDD, iLimit.tdd, 'TDD');

  renderMetricCards(U1, Vres, THD_V, vLimit, I1, IL, Math.sqrt(Ires_sq), TDD, iLimit);

  // Voltage explanation
  const vColor = THD_V > vLimit.thd ? '#FF4136' : THD_V > vLimit.thd*0.8 ? '#FFD000' : '#00703C';
  const vStatus = THD_V > vLimit.thd ? '⚠ FUERA DE NORMA' : '✔ DENTRO DE NORMA';
  document.getElementById('thd_v_explanation').innerHTML = `
    <div style="color:${vColor};font-size:1rem;font-weight:700;margin-bottom:.5rem;">${vStatus}</div>
    <div style="font-family:var(--mono);font-size:.85rem;color:var(--text2);line-height:1.9;">
      <div>Nivel: <b style="color:var(--accent)">${vLimit.label}</b></div>
      <div>THDv = V_RES / V₁ × 100</div>
      <div>= ${Vres.toFixed(3)} / ${U1.toFixed(3)} × 100 = <span style="color:var(--accent);font-size:1.2rem;font-weight:700;">${THD_V.toFixed(2)}%</span></div>
      <div style="margin-top:.4rem;">Límite THDv: <b style="color:${vColor}">${vLimit.thd}%</b> · Dv indiv.: <b>${vLimit.individual}%</b></div>
      <div style="font-size:.7rem;color:rgba(122,171,138,.5);margin-top:.3rem;">NTC 5001 §7.9 · Percentil 95% · Período 1 semana</div>
    </div>`;

  // Current explanation — with paso a paso matching whiteboard
  const ratio = +document.getElementById('iscIl').value || 20;
  const iColor = TDD > iLimit.tdd ? '#FF4136' : TDD > iLimit.tdd*0.8 ? '#FFD000' : '#00703C';
  const iStatus = TDD > iLimit.tdd ? '⚠ FUERA DE NORMA' : '✔ DENTRO DE NORMA';

  // Build THDi step-by-step
  let thdStep = '';
  if (ri[1] > 0 && ri.slice(2).some(v => v > 0)) {
    const modeTag = isPeak ? '<span style="font-size:.65rem;color:#FF851B;">(PICO→RMS)</span>' : '';
    // Irmsh = √(Σ I_h_rms² para h≥2)
    let terms = [], vals = [], sqVals = [];
    for (let n = 2; n <= N_HARM; n++) {
      const raw = (inputMode === 'current' ? harmI[n] : 0) || 0;
      if (raw === 0) continue;
      const rms = ri[n];
      if (isPeak) {
        terms.push(`(${raw}/√2)²`);
      } else {
        terms.push(`${raw}²`);
      }
      sqVals.push((rms*rms).toFixed(3));
    }
    thdStep = `
      <div style="margin-top:.6rem;padding:.6rem;background:rgba(255,208,0,.05);border:1px solid rgba(255,208,0,.1);border-radius:3px;">
        <div style="color:var(--accent);font-weight:700;font-size:.8rem;margin-bottom:.3rem;">PASO A PASO — THDi ${modeTag}</div>
        <div style="font-size:.78rem;">I<sub>RMS,H</sub> = √( ${terms.join(' + ')} )</div>
        <div style="font-size:.78rem;color:var(--text2);">= √( ${sqVals.join(' + ')} )</div>
        <div style="font-size:.78rem;">= √( ${Ires_sq.toFixed(3)} ) = <b style="color:var(--accent)">${Ires.toFixed(3)} A</b></div>
        <div style="font-size:.78rem;margin-top:.3rem;">THDi = I<sub>RMS,H</sub> / I₁<sub>RMS</sub> = ${Ires.toFixed(3)} / ${I1.toFixed(3)} = <b style="color:var(--accent);font-size:1rem;">${THD_I.toFixed(4)}</b> = <b style="color:var(--accent);font-size:1.1rem;">${THD_I.toFixed(2)}%</b></div>
        ${isPeak ? `<div style="font-size:.7rem;color:var(--text2);margin-top:.2rem;">I₁<sub>RMS</sub> = ${(harmI[1]||0).toFixed(1)} / √2 = ${I1.toFixed(3)} A</div>` : ''}
      </div>`;
  }

  document.getElementById('thd_i_explanation').innerHTML = `
    <div style="color:${iColor};font-size:1rem;font-weight:700;margin-bottom:.5rem;">${iStatus}</div>
    <div style="font-family:var(--mono);font-size:.85rem;color:var(--text2);line-height:1.9;">
      <div>Isc/IL = <b style="color:var(--accent)">${ratio}</b></div>
      <div>TDD = √(ΣI_H²) / I_L × 100</div>
      <div>= ${Ires.toFixed(3)} / ${IL.toFixed(3)} × 100 = <span style="color:var(--accent);font-size:1.2rem;font-weight:700;">${TDD.toFixed(2)}%</span></div>
      <div style="margin-top:.2rem;">THDi (ref. I₁): <b style="color:var(--accent)">${THD_I.toFixed(2)}%</b></div>
      <div style="margin-top:.2rem;">Límite TDD: <b style="color:${iColor}">${iLimit.tdd}%</b></div>
      <div style="font-size:.7rem;color:rgba(122,171,138,.5);margin-top:.3rem;">NTC 5001 §7.10 · TDD usa IL como denominador</div>
    </div>${thdStep}`;

  highlightNormTableV();
  buildNormTableI();
  updateSpectrum();
  renderBarsV();
  renderBarsI();
  updateNeutral();
}

function updateNeutral() {
  const f1 = +document.getElementById('p_f1').value || 60;
  const isPeak = amplitudeMode === 'peak';

  const I1rms = rmsI(1);

  // Triplen harmonics — only ODD multiples of 3 (zero sequence)
  const zeroSeqTriplens = [];
  for (let k = 1; k * 3 <= N_HARM; k++) {
    const h = k * 3;
    if (h % 2 !== 0) zeroSeqTriplens.push(h); // 3,9,15,21,27,33,39
  }

  // I_L (RMS total de línea) — like on the whiteboard
  let sumSqAll = 0;
  for (let n = 1; n <= N_HARM; n++) {
    const irms = rmsI(n);
    sumSqAll += irms * irms;
  }
  const IphaseRMS = Math.sqrt(sumSqAll);

  // I_N = 3 * sqrt( sum(I_h_rms^2) ) for zero-sequence triplens
  let sumSqTriplen = 0;
  let maxH = 0, maxVal = 0;
  const contributions = [];
  for (const h of zeroSeqTriplens) {
    const irms = rmsI(h);
    const ihNeutro = 3 * irms;
    sumSqTriplen += irms * irms;
    if (irms > maxVal) { maxVal = irms; maxH = h; }
    contributions.push({ h, freq: h * f1, ih: irms, ihRaw: harmI[h]||0, ihNeutro, ihSq: irms * irms });
  }
  const In = 3 * Math.sqrt(sumSqTriplen);

  const fmt = (v, d = 3) => isFinite(v) && v > 0 ? v.toFixed(d) : '—';

  // ── Update metric cards ──
  document.getElementById('mc_In').textContent = fmt(In);
  const ratioI1 = I1rms > 0 ? (In / I1rms * 100) : 0;
  const ratioPhase = IphaseRMS > 0 ? (In / IphaseRMS * 100) : 0;
  document.getElementById('mc_InRatio').textContent = ratioI1 > 0 ? ratioI1.toFixed(1) : '—';
  document.getElementById('mc_InPhase').textContent = ratioPhase > 0 ? ratioPhase.toFixed(1) : '—';
  document.getElementById('mc_InDom').textContent = maxH > 0 ? 'H' + maxH : '—';
  document.getElementById('mc_InDomSub').textContent = maxH > 0
    ? `H${maxH} = ${maxVal.toFixed(3)} A → ${(3*maxVal).toFixed(3)} A en neutro`
    : 'Mayor contribución al neutro';

  // Color cards
  const inCard = document.getElementById('mc_In_card');
  inCard.className = 'mcard' + (In > IphaseRMS ? ' red' : In > IphaseRMS * 0.5 ? ' orange' : ' green');

  const ratioCard = document.getElementById('mc_InRatio_card');
  ratioCard.className = 'mcard' + (ratioI1 > 173 ? ' red' : ratioI1 > 100 ? ' orange' : ' green');

  const phaseCard = document.getElementById('mc_InPhase_card');
  phaseCard.className = 'mcard' + (ratioPhase > 100 ? ' red' : ratioPhase > 50 ? ' orange' : ' green');

  // ── Step-by-step ──
  const stepDiv = document.getElementById('neutralStepByStep');
  const stepContent = document.getElementById('neutralStepContent');
  const hasData = contributions.some(c => c.ih > 0);

  if (hasData) {
    showBlock(stepDiv);
    const modeLabel = isPeak ? 'PICO' : 'RMS';

    // ── PASO 1: IL ──
    let allTermsIL = [];
    let allValuesIL = [];
    for (let n = 1; n <= N_HARM; n++) {
      const raw = harmI[n] || 0;
      if (raw === 0) continue;
      if (isPeak) {
        allTermsIL.push(`(${raw}/√2)²`);
        allValuesIL.push(`${(raw*raw/2).toFixed(3)}`);
      } else {
        allTermsIL.push(`${raw}²`);
        allValuesIL.push(`${(raw*raw).toFixed(3)}`);
      }
    }

    let step1 = `<div style="color:var(--accent3);font-weight:700;margin-bottom:.3rem;">PASO 1 — Corriente de línea I<sub>L</sub></div>`;
    step1 += `<div>I<sub>L</sub> = √( ${allTermsIL.join(' + ')} )</div>`;
    step1 += `<div style="color:var(--text2);">= √( ${allValuesIL.join(' + ')} )</div>`;
    step1 += `<div>= √( ${sumSqAll.toFixed(3)} )</div>`;
    step1 += `<div>= <span style="color:var(--accent);font-size:1.1rem;font-weight:700;">${IphaseRMS.toFixed(3)} A</span> <span style="color:var(--text2);font-size:.7rem;">(RMS por fase)</span></div>`;

    // ── PASO 2: Identificar triplen ──
    const activeTriplens = contributions.filter(c => c.ih > 0);
    let step2 = `<div style="color:#FF851B;font-weight:700;margin-top:.8rem;margin-bottom:.3rem;">PASO 2 — Identificar armónicos triplen (sec. cero)</div>`;
    step2 += `<div>Triplen impares presentes: `;
    step2 += activeTriplens.map(c => `<b style="color:#FF851B">H${c.h}</b> (${c.ihRaw} A ${modeLabel})`).join(', ');
    step2 += activeTriplens.length === 0 ? '<span style="color:var(--accent2);">Ninguno</span>' : '';
    step2 += `</div>`;
    step2 += `<div style="font-size:.7rem;color:var(--text2);">Secuencia: h×120° → para h=3k (impar): 3k×120° = k×360° = 0° → en fase en las 3 líneas → se suman en el neutro</div>`;

    // ── PASO 3: Cálculo I_N ──
    let tripTerms = [];
    let tripValues = [];
    let tripSqValues = [];
    for (const c of activeTriplens) {
      if (isPeak) {
        tripTerms.push(`(${c.ihRaw}/√2)²`);
        tripValues.push(`(${c.ih.toFixed(3)})²`);
      } else {
        tripTerms.push(`(${c.ihRaw})²`);
        tripValues.push(`(${c.ih.toFixed(3)})²`);
      }
      tripSqValues.push(c.ihSq.toFixed(3));
    }

    let step3 = `<div style="color:#FF851B;font-weight:700;margin-top:.8rem;margin-bottom:.3rem;">PASO 3 — Corriente en el neutro I<sub>N</sub></div>`;
    step3 += `<div>I<sub>N</sub> = 3 × √( ${tripTerms.join(' + ')} )</div>`;
    if (isPeak) {
      step3 += `<div style="color:var(--text2);">= 3 × √( ${tripValues.join(' + ')} )</div>`;
    }
    step3 += `<div style="color:var(--text2);">= 3 × √( ${tripSqValues.join(' + ')} )</div>`;
    step3 += `<div>= 3 × √( ${sumSqTriplen.toFixed(3)} )</div>`;
    step3 += `<div>= 3 × ${Math.sqrt(sumSqTriplen).toFixed(3)}</div>`;
    step3 += `<div>= <span style="color:#FF851B;font-size:1.3rem;font-weight:700;">${In.toFixed(3)} A</span></div>`;

    // ── PASO 4: Conclusión ──
    let step4 = `<div style="color:var(--sena);font-weight:700;margin-top:.8rem;margin-bottom:.3rem;">PASO 4 — Comparación</div>`;
    step4 += `<div>I<sub>N</sub> / I<sub>L</sub> = ${In.toFixed(3)} / ${IphaseRMS.toFixed(3)} = <b style="color:${ratioPhase>100?'#FF4136':ratioPhase>50?'#FF851B':'var(--sena)'}">${ratioPhase.toFixed(1)}%</b></div>`;
    if (ratioPhase > 100) {
      step4 += `<div style="color:#FF4136;font-weight:700;">→ I<sub>N</sub> SUPERA I<sub>L</sub> — El neutro lleva MÁS corriente que cada fase</div>`;
      step4 += `<div style="color:#FF4136;">→ Dimensionar neutro ≥ sección de fase · No reducir conductor neutro</div>`;
    } else if (ratioPhase > 50) {
      step4 += `<div style="color:#FF851B;">→ Contenido triplen significativo — No reducir neutro</div>`;
    } else {
      step4 += `<div style="color:var(--sena);">→ Contenido triplen bajo — Se puede considerar reducción</div>`;
    }

    stepContent.innerHTML = step1 + step2 + step3 + step4;
  } else {
    hideEl(stepDiv);
  }

  // ── Build table ──
  const tbody = document.getElementById('neutralTableBody');
  tbody.innerHTML = '';
  const totalInSq = sumSqTriplen > 0 ? sumSqTriplen : 1;
  for (const c of contributions) {
    const pctOfIn = sumSqTriplen > 0 ? (c.ihSq / totalInSq * 100) : 0;
    const tr = document.createElement('tr');
    const barWidth = Math.min(pctOfIn, 100);
    const barColor = c.ih === maxVal && c.ih > 0 ? '#FF851B' : 'var(--sena)';
    const rawLabel = isPeak ? ` <span style="font-size:.6rem;color:var(--text2);">(${c.ihRaw} / √2)</span>` : '';
    tr.innerHTML = `
      <td style="font-family:var(--head);font-weight:700;color:#FF851B;font-size:1.05rem;">H${c.h}</td>
      <td>${c.freq.toFixed(0)} Hz</td>
      <td>${c.ih > 0 ? c.ih.toFixed(3) + rawLabel : '<span style="color:var(--border);">0</span>'}</td>
      <td style="color:var(--accent);font-weight:700;">${c.ih > 0 ? c.ihNeutro.toFixed(3) : '<span style="color:var(--border);">0</span>'}</td>
      <td>${pctOfIn > 0 ? pctOfIn.toFixed(1) + '%' : '—'}</td>
      <td style="padding:.3rem .5rem;">
        <div style="height:14px;background:var(--bg2);border:1px solid var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:2px;transition:width .3s;"></div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('neutralTotal').textContent = In > 0 ? In.toFixed(3) + ' A' : '—';

  // ── Build visual bars ──
  const barsDiv = document.getElementById('neutral_bars');
  let barsHtml = '';
  for (const c of contributions) {
    const pctBar = In > 0 ? (c.ihNeutro / In * 100) : 0;
    const barColor = c.ih === maxVal && c.ih > 0 ? '#FF851B' : 'var(--sena)';
    barsHtml += `<div class="bar-row">
      <div class="bar-label">H${c.h} <span style="color:var(--text2);font-size:.6rem">${c.freq.toFixed(0)}Hz</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(pctBar,100)}%;background:${barColor}"></div></div>
      <div class="bar-pct">${c.ih > 0 ? c.ihNeutro.toFixed(3) + ' A' : '0'}</div>
    </div>`;
  }
  barsDiv.innerHTML = barsHtml;

  // ── Alert ──
  const alertDiv = document.getElementById('neutralAlert');
  if (In <= 0 || I1rms <= 0) {
    showBlock(alertDiv);
    alertDiv.style.background = 'rgba(0,116,217,.08)';
    alertDiv.style.border = '1px solid rgba(0,116,217,.2)';
    alertDiv.style.color = 'var(--accent3)';
    alertDiv.innerHTML = 'ℹ️ <b>Sin datos de corriente armónica.</b> Ingrese armónicos de corriente en la Tab 1 (cambie a modo "Corriente") para ver el análisis del neutro.';
  } else if (ratioPhase > 100) {
    showBlock(alertDiv);
    alertDiv.style.background = 'rgba(255,65,54,.1)';
    alertDiv.style.border = '1px solid rgba(255,65,54,.25)';
    alertDiv.style.color = '#ff6b6b';
    alertDiv.innerHTML = `⚠️ <b>ALERTA CRÍTICA:</b> I<sub>N</sub> = ${In.toFixed(2)} A <b>SUPERA</b> la corriente de fase (${IphaseRMS.toFixed(2)} A).<br>
      Ratio I<sub>N</sub>/I<sub>FASE</sub> = <b>${ratioPhase.toFixed(1)}%</b>.<br>
      El neutro debe dimensionarse con sección <b>mayor o igual</b> a la de las fases.<br>
      → IEC 60364-5-52 exige que el neutro NO se reduzca cuando I<sub>N</sub> > I<sub>FASE</sub>.<br>
      → NTC 2050 §310.15(B)(5)(c): considerar factor de corrección por armónicos.`;
  } else if (ratioPhase > 50) {
    showBlock(alertDiv);
    alertDiv.style.background = 'rgba(255,133,27,.1)';
    alertDiv.style.border = '1px solid rgba(255,133,27,.25)';
    alertDiv.style.color = '#FF851B';
    alertDiv.innerHTML = `⚠ <b>PRECAUCIÓN:</b> I<sub>N</sub> = ${In.toFixed(2)} A es <b>${ratioPhase.toFixed(1)}%</b> de I<sub>FASE</sub>.<br>
      El contenido armónico triplen es significativo. Considere no reducir la sección del neutro.<br>
      → IEC 60364-5-52 Anexo C: si H3 > 33%, el neutro debe tener la misma sección que las fases.`;
  } else if (In > 0) {
    showBlock(alertDiv);
    alertDiv.style.background = 'rgba(0,112,60,.08)';
    alertDiv.style.border = '1px solid rgba(0,112,60,.2)';
    alertDiv.style.color = 'var(--sena)';
    alertDiv.innerHTML = `✔ <b>Neutro dentro de límites seguros.</b> I<sub>N</sub> = ${In.toFixed(2)} A (${ratioPhase.toFixed(1)}% de I<sub>FASE</sub>).<br>
      El contenido triplen es bajo. Se puede considerar reducción del neutro según NTC 2050 §310.15(B)(7).`;
  } else {
    hideEl(alertDiv);
  }
}

function highlightNormTableV() {
  const level = document.getElementById('voltageLevel').value;
  // Reset all rows
  ['bt','mt1','mt2','at'].forEach(l => {
    const row = document.getElementById('tvRow_' + l);
    if (!row) return;
    row.classList.remove('highlight');
    row.style.opacity = (l === 'bt') ? '0.6' : '1';
  });
  // Highlight active row
  const activeRow = document.getElementById('tvRow_' + level);
  if (activeRow) {
    activeRow.classList.add('highlight');
    activeRow.style.opacity = '1';
  }
}

function drawGauge(canvasId, value, limit, label) {
  const cv = document.getElementById(canvasId);
  const ctx = cv.getContext('2d');
  const cx=80, cy=90, r=65;
  ctx.clearRect(0,0,160,160);

  const maxScale = Math.max(limit * 3, 30);
  const clamped = Math.min(value, maxScale);

  ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,2*Math.PI);
  ctx.strokeStyle='#1a3326'; ctx.lineWidth=14; ctx.lineCap='round'; ctx.stroke();

  const grd = ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  grd.addColorStop(0,'#00703C'); grd.addColorStop(0.4,'#FFD000'); grd.addColorStop(1,'#FF4136');
  ctx.beginPath();
  ctx.arc(cx,cy,r, Math.PI, Math.PI+(clamped/maxScale)*Math.PI);
  ctx.strokeStyle=grd; ctx.lineWidth=14; ctx.lineCap='round';
  ctx.shadowColor=value>limit?'#FF4136':value>limit*0.8?'#FFD000':'#00703C';
  ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;

  // Limit marker line
  const limAngle = Math.PI + (Math.min(limit,maxScale)/maxScale)*Math.PI;
  ctx.beginPath();
  ctx.moveTo(cx+(r-10)*Math.cos(limAngle), cy+(r-10)*Math.sin(limAngle));
  ctx.lineTo(cx+(r+10)*Math.cos(limAngle), cy+(r+10)*Math.sin(limAngle));
  ctx.strokeStyle='#FF4136'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#FF4136'; ctx.font='bold 8px Share Tech Mono'; ctx.textAlign='center';
  ctx.fillText(limit+'%', cx+(r+18)*Math.cos(limAngle), cy+(r+18)*Math.sin(limAngle)+3);

  ctx.fillStyle='#e8f5ee'; ctx.textAlign='center';
  ctx.font='bold 24px Barlow Condensed, sans-serif';
  ctx.fillText(value.toFixed(1)+'%', cx, cy+8);
  ctx.fillStyle='#7aab8a'; ctx.font='10px Share Tech Mono';
  ctx.fillText(label, cx, cy+24);

  ctx.fillStyle='rgba(122,171,138,.55)'; ctx.font='8px Share Tech Mono';
  ctx.fillText('0%', cx-r-2, cy+14);
  ctx.fillText(Math.round(maxScale)+'%', cx+r+2, cy+14);
}

function renderBarsV() {
  const rv = allRmsV();
  const U1 = rv[1] || 1;
  const f1 = +document.getElementById('p_f1').value || 60;
  const limit = getTHDvLimit();
  const container = document.getElementById('dh_v_bars');
  let html = '';
  for (let n = 1; n <= N_HARM; n++) {
    const pct = (rv[n] / U1 * 100);
    const pctClamped = Math.min(pct, 100);
    let bgColor;
    if (n === 1) bgColor = '#00703C';
    else bgColor = pct > limit.individual ? '#FF4136' : pct > limit.individual*0.7 ? '#FFD000' : '#0074D9';
    const label = n===1 ? 'FUND' : pct.toFixed(2)+'%';
    html += `<div class="bar-row">
      <div class="bar-label">H${n} <span style="color:var(--text2);font-size:.6rem">${(n*f1)}Hz</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pctClamped}%;background:${bgColor}"></div></div>
      <div class="bar-pct">${label}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function renderBarsI() {
  const ri = allRmsI();
  const IL = +document.getElementById('ilValue').value || ri[1] || 1;
  const f1 = +document.getElementById('p_f1').value || 60;
  const container = document.getElementById('dh_i_bars');
  let html = '';
  for (let n = 1; n <= N_HARM; n++) {
    const pct = (ri[n] / IL * 100);
    const pctClamped = Math.min(pct, 100);
    const indLimit = getIndividualCurrentLimit(n);
    let bgColor;
    if (n === 1) bgColor = '#00703C';
    else bgColor = pct > indLimit ? '#FF4136' : pct > indLimit*0.7 ? '#FFD000' : '#FFD000';
    const label = n===1 ? 'FUND' : pct.toFixed(2)+'%';
    html += `<div class="bar-row">
      <div class="bar-label">H${n} <span style="color:var(--text2);font-size:.6rem">${(n*f1)}Hz</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pctClamped}%;background:${bgColor}"></div></div>
      <div class="bar-pct">${label}${n>1?' <span style="font-size:.55rem;color:'+(pct>indLimit?'#FF4136':'var(--text2)')+'">lím:'+indLimit+'%</span>':''}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function updateSpectrum() {
  const rv = allRmsV();
  const ri = allRmsI();
  const U1 = rv[1] || 1;
  const IL = +document.getElementById('ilValue').value || ri[1] || 1;
  const f1 = +document.getElementById('p_f1').value || 60;
  const vLimit = getTHDvLimit();

  const labels = Array.from({length:N_HARM}, (_,i) => `H${i+1}\n${(i+1)*f1}Hz`);
  const dHv = Array.from({length:N_HARM}, (_,i) => +(rv[i+1]/U1*100).toFixed(3));
  const dHi = Array.from({length:N_HARM}, (_,i) => +(ri[i+1]/IL*100).toFixed(3));
  const vRms = rv.slice(1).map(v => +v.toFixed(3));
  const iRms = ri.slice(1).map(v => +v.toFixed(3));

  const specOpts = (ylabel) => ({
    responsive:true, animation:false,
    plugins:{legend:{display:false}, tooltip:{mode:'index',intersect:false}},
    scales:{
      x:{ticks:{color:'#7aab8a',font:{size:9},maxRotation:90},grid:{color:'rgba(26,51,38,.5)'}},
      y:{title:{display:true,text:ylabel,color:'#7aab8a',font:{size:11}},ticks:{color:'#7aab8a'},grid:{color:'rgba(26,51,38,.5)'},beginAtZero:true}
    },
  });

  // Colors: H1 green, rest by limit
  const colorsV = dHv.map((v,i) => i===0 ? '#00703C' : v > vLimit.individual ? '#FF4136' : v > vLimit.individual*0.7 ? '#FFD000' : '#00703C');
  const colorsI = dHi.map((v,i) => {
    if (i===0) return '#00703C';
    const lim = getIndividualCurrentLimit(i+1);
    return v > lim ? '#FF4136' : v > lim*0.7 ? '#FFD000' : '#00703C';
  });

  if (chartSpecV) chartSpecV.destroy();
  chartSpecV = new Chart(document.getElementById('chartSpecV'), {
    type:'bar', data:{labels, datasets:[{label:'Dv (%)',data:dHv,backgroundColor:colorsV}]}, options:specOpts('Dv (%)')
  });
  if (chartSpecI) chartSpecI.destroy();
  chartSpecI = new Chart(document.getElementById('chartSpecI'), {
    type:'bar', data:{labels, datasets:[{label:'Dh (%)',data:dHi,backgroundColor:colorsI}]}, options:specOpts('Dh (%)')
  });
  if (chartVrms) chartVrms.destroy();
  chartVrms = new Chart(document.getElementById('chartVrms'), {
    type:'bar', data:{labels, datasets:[{label:'V RMS',data:vRms,backgroundColor:vRms.map((_,i)=>i===0?'#00703C':'#0074D9')}]}, options:specOpts('V RMS (V)')
  });
  if (chartIrms) chartIrms.destroy();
  chartIrms = new Chart(document.getElementById('chartIrms'), {
    type:'bar', data:{labels, datasets:[{label:'I RMS',data:iRms,backgroundColor:iRms.map((_,i)=>i===0?'#00703C':'#FFD000')}]}, options:specOpts('I RMS (A)')
  });
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════
function showTab(idx) {
  document.querySelectorAll('.tab-pane').forEach((p,i) => p.classList.toggle('active', i===idx));
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i===idx));
  setTimeout(() => {
    [chartHarms,chartFourier,chartSpecV,chartSpecI,chartVrms,chartIrms].forEach(c => {if(c)c.resize();});
    if (idx===1) updateHarmChart();
    if (idx===2) updateFourierChart();
    if (idx===3) updateQuality();
  }, 80);
}
