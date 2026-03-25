// ══ CLOCK WIDGET ═════════════════════════════════════════════════════════════
(function() {
  if (document.getElementById('widget-clockwidget')) return;

  const html = `
<div class="widget" id="widget-clockwidget" style="display:none;">
  <div class="widget-header">
    <span>🕐</span>
    <span class="widget-title">Clock</span>
    <button class="widget-transparent-btn" data-target="widget-clockwidget" title="Toggle transparent">•</button>
    <button class="cw-settings-btn" title="Settings">⚙</button>
    <button class="widget-close" data-close="clockwidget">✕</button>
  </div>

  <div class="cw-body">
    <div class="cw-analog" id="cw-analog">
      <div class="cw-blur-bg"></div>
      <svg class="cw-svg" id="cw-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="96" class="cw-ring"/>
        <g id="cw-hour-markers"></g>
        <g id="cw-min-markers"></g>
        <g id="cw-numbers"></g>
        <line id="cw-hour-hand"   x1="100" y1="100" x2="100" y2="44"  class="cw-hand cw-hour-hand"/>
        <line id="cw-minute-hand" x1="100" y1="100" x2="100" y2="28"  class="cw-hand cw-min-hand"/>
        <line id="cw-second-hand" x1="100" y1="110" x2="100" y2="20"  class="cw-hand cw-sec-hand"/>
        <circle cx="100" cy="100" r="5" class="cw-center"/>
        <circle cx="100" cy="100" r="2.5" class="cw-center-inner"/>
      </svg>
    </div>

    <div class="cw-digital" id="cw-digital" style="display:none;">
      <div class="cw-digi-time" id="cw-digi-time">00:00</div>
      <div class="cw-digi-ampm" id="cw-digi-ampm"></div>
    </div>

    <div class="cw-date" id="cw-date"></div>
  </div>

  <div class="cw-settings-panel" id="cw-settings-panel" style="display:none;">
    <div class="cw-setting-row">
      <span class="cw-setting-label">Mode</span>
      <div class="cw-btn-group">
        <button class="cw-mode-btn active" data-mode="analog">Analog</button>
        <button class="cw-mode-btn" data-mode="digital">Digital</button>
      </div>
    </div>
    <div class="cw-setting-row cw-setting-col">
      <span class="cw-setting-label">Size</span>
      <div class="cw-slider-row">
        <input type="range" class="range-slider" id="cw-size-slider" min="120" max="500" step="10" value="190">
        <span class="cw-size-label" id="cw-size-label">190px</span>
      </div>
    </div>
    <div class="cw-setting-row">
      <span class="cw-setting-label">Show date</span>
      <label class="toggle"><input type="checkbox" id="cw-toggle-date" checked><span class="toggle-slider"></span></label>
    </div>
    <div class="cw-setting-row">
      <span class="cw-setting-label">Seconds hand</span>
      <label class="toggle"><input type="checkbox" id="cw-toggle-seconds" checked><span class="toggle-slider"></span></label>
    </div>
    <div class="cw-setting-row">
      <span class="cw-setting-label">Hour numbers</span>
      <label class="toggle"><input type="checkbox" id="cw-toggle-numbers"><span class="toggle-slider"></span></label>
    </div>
  </div>
</div>`;

  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  const el = wrap.firstElementChild;
  (document.getElementById('page-main') || document.body).appendChild(el);

  const STORE_KEY = 'nt_clockwidget';
  function loadState() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; } }
  function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
  let state = Object.assign({ mode: 'analog', sizePx: 190, showDate: true, showSeconds: true, showNumbers: false }, loadState());

  const analog       = document.getElementById('cw-analog');
  const digital      = document.getElementById('cw-digital');
  const digiTime     = document.getElementById('cw-digi-time');
  const digiAmpm     = document.getElementById('cw-digi-ampm');
  const dateEl       = document.getElementById('cw-date');
  const hourHand     = document.getElementById('cw-hour-hand');
  const minHand      = document.getElementById('cw-minute-hand');
  const secHand      = document.getElementById('cw-second-hand');
  const settPanel    = document.getElementById('cw-settings-panel');
  const settBtn      = el.querySelector('.cw-settings-btn');
  const numbersGroup = document.getElementById('cw-numbers');
  const markerGroup  = document.getElementById('cw-hour-markers');
  const minGroup     = document.getElementById('cw-min-markers');
  const sizeSlider   = document.getElementById('cw-size-slider');
  const sizeLabel    = document.getElementById('cw-size-label');

  function buildMarkers() {
    markerGroup.innerHTML = '';
    minGroup.innerHTML = '';
    numbersGroup.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const angle = i * 6 * Math.PI / 180;
      const isHour = i % 5 === 0;
      const r1 = isHour ? 80 : 88;
      const x1 = 100 + r1 * Math.sin(angle), y1 = 100 - r1 * Math.cos(angle);
      const x2 = 100 + 94 * Math.sin(angle), y2 = 100 - 94 * Math.cos(angle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('class', isHour ? 'cw-tick-hour' : 'cw-tick-min');
      (isHour ? markerGroup : minGroup).appendChild(line);
    }
    if (state.showNumbers) {
      for (let i = 1; i <= 12; i++) {
        const angle = i * 30 * Math.PI / 180;
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', 100 + 70 * Math.sin(angle));
        t.setAttribute('y', 100 - 70 * Math.cos(angle));
        t.setAttribute('class', 'cw-num');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'central');
        t.textContent = i;
        numbersGroup.appendChild(t);
      }
    }
  }

  function applySize() {
    const px = state.sizePx;
    if (analog) { analog.style.width = px + 'px'; analog.style.height = px + 'px'; }
    if (digiTime) digiTime.style.fontSize = Math.round(px * 0.22) + 'px';
    if (sizeSlider) sizeSlider.value = px;
    if (sizeLabel)  sizeLabel.textContent = px + 'px';
    el.style.minWidth = Math.min(px + 24, 520) + 'px';
  }

  function applyState() {
    analog.style.display  = state.mode === 'analog'  ? '' : 'none';
    digital.style.display = state.mode === 'digital' ? '' : 'none';
    el.querySelectorAll('.cw-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
    dateEl.style.display = state.showDate ? '' : 'none';
    if (secHand) secHand.style.display = state.showSeconds ? '' : 'none';
    buildMarkers();
    applySize();
    const dChk = document.getElementById('cw-toggle-date');
    const sChk = document.getElementById('cw-toggle-seconds');
    const nChk = document.getElementById('cw-toggle-numbers');
    if (dChk) dChk.checked = state.showDate;
    if (sChk) sChk.checked = state.showSeconds;
    if (nChk) nChk.checked = state.showNumbers;
    saveState(state);
  }

  function tick() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
    if (state.mode === 'analog') {
      const rot = (handEl, deg) => handEl.setAttribute('transform', `rotate(${deg} 100 100)`);
      rot(hourHand, ((h % 12) + m / 60) * 30);
      rot(minHand,  (m + s / 60) * 6);
      if (state.showSeconds) rot(secHand, (s + ms / 1000) * 6);
    } else {
      const use12 = typeof ntSettings !== 'undefined' && ntSettings.clockFormat === '12';
      let hh = h, ampm = '';
      if (use12) { ampm = h < 12 ? 'AM' : 'PM'; hh = h % 12 || 12; }
      const pad = n => String(n).padStart(2, '0');
      digiTime.textContent = state.showSeconds ? `${pad(hh)}:${pad(m)}:${pad(s)}` : `${pad(hh)}:${pad(m)}`;
      digiAmpm.textContent = ampm;
    }
    if (state.showDate) {
      dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  settBtn.addEventListener('click', e => {
    e.stopPropagation();
    settPanel.style.display = settPanel.style.display === 'none' ? '' : 'none';
  });
  el.querySelectorAll('.cw-mode-btn').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode; applyState();
  }));
  sizeSlider.addEventListener('input', () => {
    state.sizePx = parseInt(sizeSlider.value);
    applySize(); saveState(state);
  });
  document.getElementById('cw-toggle-date').addEventListener('change', e => { state.showDate = e.target.checked; applyState(); });
  document.getElementById('cw-toggle-seconds').addEventListener('change', e => { state.showSeconds = e.target.checked; applyState(); });
  document.getElementById('cw-toggle-numbers').addEventListener('change', e => { state.showNumbers = e.target.checked; applyState(); });

  applyState();
  tick();
  setInterval(tick, 250);

  window.initWidget_clockwidget = function() {};
})();