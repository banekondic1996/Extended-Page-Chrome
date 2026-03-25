// ══ WIDGET: TIMER / STOPWATCH ════════════════════════════════════════════════
window.initWidget_timer = function() {
  const el = document.getElementById('widget-timer');
  if (!el) return;

  const CIRCUMFERENCE = 2 * Math.PI * 36;

  function playTimerBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.3, 0.6].forEach(t => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.6, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.3);
      });
      setTimeout(() => ctx.close(), 2000);
    } catch {}
  }

  function fmt(secs) {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  let timerInterval = null, timerTotal = 0, timerRemaining = 0, timerRunning = false;

  function updateTimerDisplay() {
    const dispEl = document.getElementById('timer-display');
    const ring   = document.getElementById('timer-ring');
    if (dispEl) dispEl.textContent = fmt(timerRemaining);
    if (ring && timerTotal > 0) ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - timerRemaining / timerTotal);
    else if (ring) ring.style.strokeDashoffset = 0;
  }

  function startTimer() {
    if (timerRunning) {
      clearInterval(timerInterval); timerRunning = false;
      document.getElementById('timer-start-btn').textContent = 'Resume';
      document.getElementById('timer-status').textContent = 'Paused'; return;
    }
    if (timerRemaining <= 0) {
      const raw = document.getElementById('timer-input').value.trim();
      let secs = 0;
      if (raw.includes(':')) { const p = raw.split(':'); secs = p.length === 3 ? parseInt(p[0]||0)*3600+parseInt(p[1]||0)*60+parseInt(p[2]||0) : parseInt(p[0]||0)*60+parseInt(p[1]||0); }
      else secs = Math.round(parseFloat(raw) * 60) || 0;
      if (secs <= 0) return;
      timerTotal = secs; timerRemaining = secs;
      const ring = document.getElementById('timer-ring');
      if (ring) ring.style.strokeDashoffset = 0;
    }
    timerRunning = true;
    document.getElementById('timer-start-btn').textContent = 'Pause';
    document.getElementById('timer-status').textContent = 'Running';
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval); timerRunning = false;
        document.getElementById('timer-start-btn').textContent = 'Start';
        document.getElementById('timer-status').textContent = '✓ Done!';
        playTimerBeep();
        const ring = document.getElementById('timer-ring');
        if (ring) { ring.style.stroke = '#2dd4a0'; setTimeout(() => { ring.style.stroke = 'var(--accent)'; }, 2000); }
      }
    }, 1000);
  }

  function resetTimer() {
    clearInterval(timerInterval); timerRunning = false; timerRemaining = 0; timerTotal = 0;
    document.getElementById('timer-display').textContent = '00:00';
    document.getElementById('timer-start-btn').textContent = 'Start';
    document.getElementById('timer-status').textContent = 'Ready';
    const ring = document.getElementById('timer-ring');
    if (ring) { ring.style.strokeDashoffset = 0; ring.style.stroke = 'var(--accent)'; }
  }

  document.getElementById('timer-start-btn').addEventListener('click', startTimer);
  document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);
  document.querySelectorAll('.timer-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.mins);
      timerTotal = mins * 60; timerRemaining = timerTotal;
      document.getElementById('timer-input').value = mins >= 60 ? `${Math.floor(mins/60)}:00:00` : `${mins}:00`;
      updateTimerDisplay();
      document.getElementById('timer-status').textContent = 'Ready';
      document.getElementById('timer-start-btn').textContent = 'Start';
      clearInterval(timerInterval); timerRunning = false;
    });
  });

  document.getElementById('tab-timer').addEventListener('click', () => {
    document.getElementById('tab-timer').classList.add('active');
    document.getElementById('tab-stopwatch').classList.remove('active');
    document.getElementById('timer-mode-panel').style.display = '';
    document.getElementById('stopwatch-mode-panel').style.display = 'none';
  });
  document.getElementById('tab-stopwatch').addEventListener('click', () => {
    document.getElementById('tab-stopwatch').classList.add('active');
    document.getElementById('tab-timer').classList.remove('active');
    document.getElementById('stopwatch-mode-panel').style.display = '';
    document.getElementById('timer-mode-panel').style.display = 'none';
  });

  // Stopwatch
  let swInterval = null, swRunning = false, swMs = 0, swLapCount = 0, swLastLap = 0;
  function fmtSW(ms) {
    const total = Math.floor(ms / 100), tenth = total % 10, secs = Math.floor(total / 10) % 60;
    const mins = Math.floor(total / 600) % 60, hrs = Math.floor(total / 36000);
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${tenth}`;
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${tenth}`;
  }
  document.getElementById('sw-start-btn').addEventListener('click', () => {
    if (swRunning) {
      clearInterval(swInterval); swRunning = false;
      document.getElementById('sw-start-btn').textContent = 'Resume';
      document.getElementById('sw-status').textContent = 'Paused';
    } else {
      const t0 = Date.now() - swMs;
      swInterval = setInterval(() => { swMs = Date.now() - t0; document.getElementById('stopwatch-display').textContent = fmtSW(swMs); }, 100);
      swRunning = true;
      document.getElementById('sw-start-btn').textContent = 'Pause';
      document.getElementById('sw-status').textContent = 'Running';
    }
  });
  document.getElementById('sw-lap-btn').addEventListener('click', () => {
    if (!swRunning && swMs === 0) return;
    swLapCount++;
    const lapTime = swMs - swLastLap; swLastLap = swMs;
    const lapsEl = document.getElementById('sw-laps');
    const row = document.createElement('div'); row.className = 'sw-lap';
    row.innerHTML = `<span>Lap ${swLapCount}</span><span>${fmtSW(lapTime)}</span><span>${fmtSW(swMs)}</span>`;
    lapsEl.insertBefore(row, lapsEl.firstChild);
  });
  document.getElementById('sw-reset-btn').addEventListener('click', () => {
    clearInterval(swInterval); swRunning = false; swMs = 0; swLapCount = 0; swLastLap = 0;
    document.getElementById('stopwatch-display').textContent = '00:00.0';
    document.getElementById('sw-start-btn').textContent = 'Start';
    document.getElementById('sw-status').textContent = 'Ready';
    document.getElementById('sw-laps').innerHTML = '';
  });
};

// ── HTML injection ────────────────────────────────────────────────────────────
(function injectTimerHTML() {
  if (document.getElementById('widget-timer')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-timer">
  <div class="widget-header"><span>⏱</span><span class="widget-title">Timer</span><button class="widget-close" data-close="timer">✕</button></div>
  <div class="timer-mode-tabs">
    <button class="timer-mode-tab active" id="tab-timer">Timer</button>
    <button class="timer-mode-tab" id="tab-stopwatch">Stopwatch</button>
  </div>
  <div id="timer-mode-panel">
    <div class="timer-ring-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80"><circle class="timer-ring-bg" cx="40" cy="40" r="36"/><circle class="timer-ring-fg" id="timer-ring" cx="40" cy="40" r="36" stroke-dasharray="226.2" stroke-dashoffset="0"/></svg>
      <div class="timer-ring-text" id="timer-display">00:00</div>
    </div>
    <div class="timer-status-label" id="timer-status">Ready</div>
    <div class="timer-input-row"><input type="text" id="timer-input" placeholder="mm:ss or minutes"></div>
    <div class="timer-presets">
      <button class="timer-preset" data-mins="1">1m</button>
      <button class="timer-preset" data-mins="5">5m</button>
      <button class="timer-preset" data-mins="10">10m</button>
      <button class="timer-preset" data-mins="25">25m</button>
      <button class="timer-preset" data-mins="60">1h</button>
    </div>
    <div class="timer-controls">
      <button class="timer-btn primary" id="timer-start-btn">Start</button>
      <button class="timer-btn" id="timer-reset-btn">Reset</button>
    </div>
  </div>
  <div id="stopwatch-mode-panel" style="display:none;">
    <div class="sw-time" id="stopwatch-display">00:00.0</div>
    <div class="timer-status-label" id="sw-status">Ready</div>
    <div class="timer-controls">
      <button class="timer-btn primary" id="sw-start-btn">Start</button>
      <button class="timer-btn" id="sw-lap-btn">Lap</button>
      <button class="timer-btn" id="sw-reset-btn">Reset</button>
    </div>
    <div id="sw-laps"></div>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();