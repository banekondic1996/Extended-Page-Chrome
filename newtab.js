// ══ EXTENDED HISTORY BRIDGE ══════════════════════════════════════════════
const EH_EXTENSION_ID = 'cdfgfljiefjinljmnedgkfhgcgldkhkk';
let ehAvailable = false;

function ehSend(message) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) { resolve(null); return; }
    try {
      chrome.runtime.sendMessage(EH_EXTENSION_ID, message, (response) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(response || null);
      });
    } catch (e) { resolve(null); }
  });
}

async function probeExtendedHistory() {
  const r = await Promise.race([
    ehSend({ type: 'GET_SETTINGS' }),
    new Promise(resolve => setTimeout(() => resolve(null), 1000))
  ]);
  const wasAvailable = ehAvailable;
  ehAvailable = !!(r && !r.error);
  applyEhAvailability();
  if (ehAvailable && !wasAvailable) loadTopSites();
}

console.log('checkpoint 1');

function applyEhAvailability() {
  const sidebarSel = document.getElementById('sidebar-mode');
  const inlineSel  = document.getElementById('sidebar-mode-inline');
  [sidebarSel, inlineSel].forEach(sel => {
    if (!sel) return;
    ['mostvisited', 'stored'].forEach(val => {
      const opt = sel.querySelector(`option[value="${val}"]`);
      if (opt) opt.style.display = ehAvailable ? '' : 'none';
    });
  });
  if (sidebarSel) {
    const cur = ntSettings.sidebarMode || 'activetabs';
    if (!ehAvailable && (cur === 'mostvisited' || cur === 'stored')) {
      ntSettings.sidebarMode = 'activetabs'; saveSettings();
      if (sidebarSel) sidebarSel.value = 'activetabs';
      if (inlineSel)  inlineSel.value  = 'activetabs';
      applySidebarMode();
    }
  }
  // loadTopSites handles chrome.history fallback internally
}

// ════════════════════════════════════════════ LOCAL STORAGE
const LS = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : (def !== undefined ? def : null); } catch { return def !== undefined ? def : null; } },
  set: (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ════════════════════════════════════════════ SETTINGS STATE
const DEFAULT_NT = {
  theme: 'dark', wallpaper: 'none', accent: '#3b9eff',
  showTopsites: true, topsitesCount: 8, clockFont: 'mono', clockFormat: '24',
  showClock: true, showDate: true,
  sidebarMode: 'activetabs',
  bookmarkFolderId: '', bookmarkFolderName: '',
  searchEngine: 'google', searchCustom: '',
  blurAmount: 0, overlayOpacity: 72,
  showGreeting: false, greetingName: '', greetingFadeSecs: 4,
  enablePage2: true, rememberPage: false,
  showSearch: true, showClockWeather: false, hiResFeed: true,
  randomWallpaper: true, uiFontSize: 100, clockTopOffset: 0,
  wpAnimation: 'fade-expand', clockAnimation: 'none',
  clockType: 'digital', mainClockSizePx: 200,
  grain: false, grainOpacity: 10, grainSize: 200,
  showExtraClocks: false, extraClocks: [],
  wordLang1: 'English', wordLang2: 'French',
  widgetFade: false, widgetFadeP2: false, showWidgetDock: true, widgetTransparent: {}, devMode: false,
  glassColor: '#ffffff', glassOpacity: 4, widgetAnimation: 'fade-up',
  widgets: { weather: false, timer: false, notes: false, currency: false, quotes: false, learn: false, merriam: false, quicklinks: false, todo: false, calendar: false, crypto: false, clockwidget: false },
  widgetOpen: { weather: true, timer: true, notes: true, currency: true, quotes: true, learn: true, merriam: true, quicklinks: true, todo: true, calendar: true, crypto: true, clockwidget: true },
  weatherCity: '', widgetPositions: {}, topsitesTopOffset: 0, weatherUnit: 'c',
  spellcheck: false
};

let ntSettings = Object.assign({}, DEFAULT_NT, LS.get('nt_settings', {}));
ntSettings.widgets         = Object.assign({}, DEFAULT_NT.widgets, ntSettings.widgets || {});
ntSettings.widgetOpen      = Object.assign({}, DEFAULT_NT.widgetOpen, ntSettings.widgetOpen || {});
ntSettings.widgetPositions = ntSettings.widgetPositions || {};
ntSettings.extraClocks     = ntSettings.extraClocks     || [];
// showWidgetDock: preserve saved false explicitly (Object.assign would restore true from DEFAULT_NT)
const _saved = LS.get('nt_settings', {});
if (_saved && typeof _saved.showWidgetDock !== 'undefined') ntSettings.showWidgetDock = _saved.showWidgetDock;
ntSettings.topsitesCount   = Math.min(18, Math.max(6, ntSettings.topsitesCount || 8));
if (ntSettings.showClock  === undefined) ntSettings.showClock  = true;
if (ntSettings.enablePage2 === undefined) ntSettings.enablePage2 = true;
if (ntSettings.showDate   === undefined) ntSettings.showDate   = true;
if (ntSettings.showSearch === undefined) ntSettings.showSearch = true;
if (ntSettings.overlayOpacity === undefined) ntSettings.overlayOpacity = 72;
if (ntSettings.spellcheck === undefined) ntSettings.spellcheck = false;

function saveSettings() {
  LS.set('nt_settings', ntSettings);
  // Mirror randomWallpaper flag to chrome.storage.local so the background
  // service worker can check it without access to localStorage.
  csSet('nt_settings', { randomWallpaper: ntSettings.randomWallpaper });
}

console.log('checkpoint 2');
// ════════════════════════════════════════════ CLOCK
function _buildMainAnalogMarkers() {
  const hmG = document.getElementById('main-cw-hour-markers');
  const mmG = document.getElementById('main-cw-min-markers');
  const nmG = document.getElementById('main-cw-numbers');
  if (!hmG) return;
  hmG.innerHTML = ''; mmG.innerHTML = ''; if (nmG) nmG.innerHTML = '';
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
    (isHour ? hmG : mmG).appendChild(line);
  }
}

function _tickMainAnalog() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
  const rot = (id, deg) => { const el = document.getElementById(id); if (el) el.setAttribute('transform', `rotate(${deg} 100 100)`); };
  rot('main-cw-hour-hand',   ((h % 12) + m / 60) * 30);
  rot('main-cw-minute-hand', (m + s / 60) * 6);
  rot('main-cw-second-hand', (s + ms / 1000) * 6);
}

let _mainAnalogInterval = null;

function applyClockType() {
  const type = ntSettings.clockType || 'digital';
  const clockEl  = document.getElementById('clock-time');
  const analogEl = document.getElementById('clock-analog');
  const fontRow  = document.getElementById('clock-font-sel');
  const sizeRow  = document.getElementById('main-clock-size-row');
  const sel      = document.getElementById('clock-type-sel');
  if (sel) sel.value = type;
  if (clockEl)  clockEl.style.display  = type === 'analog' ? 'none' : '';
  if (analogEl) analogEl.style.display = type === 'analog' ? '' : 'none';
  if (sizeRow)  sizeRow.style.display  = type === 'analog' ? '' : 'none';
  // Apply saved size
  if (type === 'analog' && analogEl) {
    const px = ntSettings.mainClockSizePx || 200;
    analogEl.style.width = px + 'px'; analogEl.style.height = px + 'px';
    const label = document.getElementById('main-clock-size-label');
    const slider = document.getElementById('main-clock-size-slider');
    if (label) label.textContent = px + 'px';
    if (slider) slider.value = px;
    _buildMainAnalogMarkers();
    _tickMainAnalog();
    if (!_mainAnalogInterval) _mainAnalogInterval = setInterval(_tickMainAnalog, 250);
  } else {
    if (_mainAnalogInterval) { clearInterval(_mainAnalogInterval); _mainAnalogInterval = null; }
  }
}

function updateClock() {
  const now = new Date();
  const use12 = (ntSettings.clockFormat === '12');
  let t;
  if (use12) {
    const h = now.getHours();
    const hh = h % 12 || 12;
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ampm = h < 12 ? 'AM' : 'PM';
    t = `${hh}:${mm} ${ampm}`;
  } else {
    t = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }
  const d = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const clockEl = document.getElementById('clock-time');
  const dateEl  = document.getElementById('clock-date');
  if (clockEl) clockEl.textContent = t;
  if (dateEl)  dateEl.textContent  = d;
  updateExtraClocksDisplay();
  if (typeof ntSettings !== 'undefined') updateGreeting(now);
}
console.log('checkpoint 3');
function applyClockFont() {
  const el = document.getElementById('clock-time');
  if (!el) return;
  const fontMap = {
    'mono':    { family: "'DM Mono', monospace",                 weight: '300' },
    'sans':    { family: "'DM Sans', system-ui, sans-serif",     weight: '200' },
    'serif':   { family: "Georgia, 'Times New Roman', serif",    weight: '300' },
    'courier': { family: "'Courier New', Courier, monospace",    weight: '400' },
    'system':  { family: "system-ui, -apple-system, sans-serif", weight: '100' },
  };
  const chosen = fontMap[ntSettings.clockFont || 'mono'] || fontMap['mono'];
  el.style.fontFamily = chosen.family;
  el.style.fontWeight = chosen.weight;
  const sel = document.getElementById('clock-font-sel');
  if (sel && sel.value !== ntSettings.clockFont) sel.value = ntSettings.clockFont || 'mono';
}

function applyClockVisibility() {
  const clockDigital = document.getElementById('clock-time');
  const clockAnal = document.getElementById('clock-analog');
  const dateEl  = document.getElementById('clock-date');
  const block   = document.getElementById('clock-block');
  const clockType = ntSettings.clockType;
  // Digital clock text: hidden if showClock is off OR analog mode is active
  if (clockDigital && ntSettings.clockType === 'digital') clockDigital.style.display = (ntSettings.showClock === false || clockType === 'analog' ) ? 'none' : '';
  if (clockAnal && ntSettings.clockType === 'analog') clockAnal.style.display = (ntSettings.showClock === false || clockType === 'digital') ? 'none' : '';
  if (dateEl)  dateEl.style.display  = ntSettings.showDate  === false ? 'none' : '';
  if (block)   block.style.display   = (ntSettings.showClock === false && ntSettings.showDate === false) ? 'none' : '';
  const tc = document.getElementById('toggle-clock');
  const td = document.getElementById('toggle-date');
  if (tc) tc.checked = ntSettings.showClock !== false;
  if (td) td.checked = ntSettings.showDate  !== false;
}
console.log('checkpoint 4');
function applyClockTop() {
  const val = ntSettings.clockTopOffset || 0;
  document.documentElement.style.setProperty('--clock-top-offset', val + 'px');
  const slider = document.getElementById('clock-top-slider');
  const label  = document.getElementById('clock-top-label');
  if (slider) slider.value = val;
  if (label)  label.textContent = val + 'px';
}

function applyTopsitesTop() {
  const val = ntSettings.topsitesTopOffset || 0;
  document.documentElement.style.setProperty('--topsites-top-offset', val + '%');
  const slider = document.getElementById('topsites-top-slider');
  const label  = document.getElementById('topsites-top-label');
  if (slider) slider.value = val;
  if (label)  label.textContent = (val >= 0 ? '+' : '') + val + '%';
}
function triggerClockAnimation() {
  const block = document.getElementById('clock-block');
  if (!block) return;
  const anim = ntSettings.clockAnimation || 'fade-up';
  if (anim === 'none') { block.style.opacity = '1'; return; }
  block.classList.remove('clock-anim-fade-up', 'clock-anim-fade');
  void block.offsetWidth;
  const cls = anim === 'fade' ? 'clock-anim-fade' : 'clock-anim-fade-up';
  block.classList.add(cls);
  block.addEventListener('animationend', () => block.classList.remove(cls), { once: true });
}


// ════════════════════════════════════════════ EXTRA CLOCKS
function updateExtraClocksDisplay() {
  const container = document.getElementById('extra-clocks');
  if (!container) return;
  if (!ntSettings.showExtraClocks || !ntSettings.extraClocks.length) {
    container.style.display = 'none'; return;
  }
  container.style.display = 'flex';
  const items = container.querySelectorAll('.extra-clock-item');
  ntSettings.extraClocks.forEach((tz, i) => {
    const el = items[i];
    if (!el) return;
    try {
      const now = new Date();
      const use12 = ntSettings.clockFormat === '12';
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: tz.tz, hour12: use12,
        hour: '2-digit', minute: '2-digit'
      });
      const timeEl = el.querySelector('.extra-clock-time');
      if (timeEl) timeEl.textContent = timeStr;
    } catch {}
  });
}
console.log('checkpoint 5');
function buildExtraClocksDom() {
  const container = document.getElementById('extra-clocks');
  if (!container) return;
  container.innerHTML = '';
  if (!ntSettings.showExtraClocks || !ntSettings.extraClocks.length) {
    container.style.display = 'none'; return;
  }
  container.style.display = 'flex';
  ntSettings.extraClocks.forEach(tz => {
    const item = document.createElement('div');
    item.className = 'extra-clock-item';
    const timeEl = document.createElement('div');
    timeEl.className = 'extra-clock-time'; timeEl.textContent = '--:--';
    const cityEl = document.createElement('div');
    cityEl.className = 'extra-clock-city'; cityEl.textContent = tz.label || tz.tz;
    item.appendChild(timeEl); item.appendChild(cityEl);
    container.appendChild(item);
  });
  updateExtraClocksDisplay();
}
console.log('checkpoint 6');
const TZ_OPTIONS = [
  { label: 'UTC',               tz: 'UTC' },
  { label: 'London (GMT)',      tz: 'Europe/London' },
  { label: 'Paris (CET)',       tz: 'Europe/Paris' },
  { label: 'Berlin (CET)',      tz: 'Europe/Berlin' },
  { label: 'Belgrade (CET)',    tz: 'Europe/Belgrade' },
  { label: 'Moscow (MSK)',      tz: 'Europe/Moscow' },
  { label: 'Istanbul (TRT)',    tz: 'Europe/Istanbul' },
  { label: 'Dubai (GST)',       tz: 'Asia/Dubai' },
  { label: 'Karachi (PKT)',     tz: 'Asia/Karachi' },
  { label: 'Mumbai (IST)',      tz: 'Asia/Kolkata' },
  { label: 'Bangkok (ICT)',     tz: 'Asia/Bangkok' },
  { label: 'Singapore (SGT)',   tz: 'Asia/Singapore' },
  { label: 'Shanghai (CST)',    tz: 'Asia/Shanghai' },
  { label: 'Tokyo (JST)',       tz: 'Asia/Tokyo' },
  { label: 'Seoul (KST)',       tz: 'Asia/Seoul' },
  { label: 'Sydney (AEDT)',     tz: 'Australia/Sydney' },
  { label: 'Auckland (NZDT)',   tz: 'Pacific/Auckland' },
  { label: 'Honolulu (HST)',    tz: 'Pacific/Honolulu' },
  { label: 'Los Angeles (PST)', tz: 'America/Los_Angeles' },
  { label: 'Denver (MST)',      tz: 'America/Denver' },
  { label: 'Chicago (CST)',     tz: 'America/Chicago' },
  { label: 'New York (EST)',    tz: 'America/New_York' },
  { label: 'Toronto (EST)',     tz: 'America/Toronto' },
  { label: 'São Paulo (BRT)',   tz: 'America/Sao_Paulo' },
  { label: 'Buenos Aires (ART)',tz: 'America/Argentina/Buenos_Aires' },
];

function renderExtraClockSettings() {
  const list = document.getElementById('extra-clocks-list');
  if (!list) return;
  list.innerHTML = '';
  ntSettings.extraClocks.forEach((tz, i) => {
    const row = document.createElement('div');
    row.className = 'extra-clock-row';

    // City label input
    const labelIn = document.createElement('input');
    labelIn.type = 'text'; labelIn.placeholder = 'Label'; labelIn.value = tz.label || '';
    labelIn.style.cssText = 'flex:0 0 80px;';
    labelIn.addEventListener('input', e => { ntSettings.extraClocks[i].label = e.target.value; saveSettings(); buildExtraClocksDom(); });

    // Timezone select
    const tzSel = document.createElement('select');
    tzSel.style.cssText = 'flex:1;background:var(--glass);border:1px solid var(--glass-border);border-radius:6px;color:var(--text);padding:5px 6px;font-family:var(--font);font-size:0.72rem;outline:none;cursor:pointer;';
    TZ_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.tz; o.textContent = opt.label;
      if (opt.tz === tz.tz) o.selected = true;
      tzSel.appendChild(o);
    });
    tzSel.addEventListener('change', e => {
      ntSettings.extraClocks[i].tz = e.target.value;
      // Auto-set label to the city name if label is empty or was auto-generated
      const chosen = TZ_OPTIONS.find(o => o.tz === e.target.value);
      if (chosen && (!ntSettings.extraClocks[i].label || ntSettings.extraClocks[i].label === ntSettings.extraClocks[i].tz)) {
        ntSettings.extraClocks[i].label = chosen.label.split(' ')[0];
        labelIn.value = ntSettings.extraClocks[i].label;
      }
      saveSettings(); buildExtraClocksDom();
    });

    const rm = document.createElement('button');
    rm.className = 'rm-clock-btn'; rm.textContent = '×';
    rm.addEventListener('click', () => { ntSettings.extraClocks.splice(i, 1); saveSettings(); renderExtraClockSettings(); buildExtraClocksDom(); });

    row.appendChild(labelIn); row.appendChild(tzSel); row.appendChild(rm);
    list.appendChild(row);
  });
}
console.log('checkpoint 7');
document.getElementById('toggle-extra-clocks').addEventListener('change', e => {
  ntSettings.showExtraClocks = e.target.checked;
  const settings = document.getElementById('extra-clocks-settings');
  if (settings) settings.style.display = ntSettings.showExtraClocks ? '' : 'none';
  saveSettings(); buildExtraClocksDom();
});

document.getElementById('add-clock-btn').addEventListener('click', () => {
  ntSettings.extraClocks.push({ label: 'New York', tz: 'America/New_York' });
  saveSettings(); renderExtraClockSettings(); buildExtraClocksDom();
});
// Init extra clocks settings panel
(function() {
  const tog = document.getElementById('toggle-extra-clocks');
  if (tog) tog.checked = !!ntSettings.showExtraClocks;
  const settings = document.getElementById('extra-clocks-settings');
  if (settings) settings.style.display = ntSettings.showExtraClocks ? '' : 'none';
  renderExtraClockSettings();
  buildExtraClocksDom();
})();

// ════════════════════════════════════════════ CLOCK FORMAT
const clockFormatSel = document.getElementById('clock-format-sel');
if (clockFormatSel) {
  clockFormatSel.value = ntSettings.clockFormat || '24';
  clockFormatSel.addEventListener('change', e => {
    ntSettings.clockFormat = e.target.value; saveSettings(); updateClock();
  });
}
console.log('checkpoint 8');
// ════════════════════════════════════════════ GREETING
let greetingFadeTimer = null;
let greetingShownOnLoad = false;

function showGreeting(force) {
  const el = document.getElementById('greeting-line');
  if (!el || !ntSettings.showGreeting) {
    if (el) { el.style.display = 'none'; el.classList.remove('greeting-visible'); }
    return;
  }
  if (!force && greetingShownOnLoad) return;
  greetingShownOnLoad = true;
  const h = new Date().getHours();
  const timeGreet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
  const name = (ntSettings.greetingName || '').trim();
  el.textContent = name ? `${timeGreet}, ${name}` : timeGreet;
  el.style.display = 'block';
  el.classList.remove('greeting-visible');
  requestAnimationFrame(() => { requestAnimationFrame(() => { el.classList.add('greeting-visible'); }); });
  clearTimeout(greetingFadeTimer);
  const secs = ntSettings.greetingFadeSecs !== undefined ? ntSettings.greetingFadeSecs : 4;
  if (secs > 0) {
    greetingFadeTimer = setTimeout(() => {
      el.classList.remove('greeting-visible');
      setTimeout(() => { el.style.display = 'none'; }, 600);
    }, secs * 1000);
  }
}

function updateGreeting() {}

function applyGreetingSettings() {
  const tog = document.getElementById('toggle-greeting');
  if (tog) tog.checked = !!ntSettings.showGreeting;
  const row = document.getElementById('greeting-name-row');
  if (row) row.style.display = ntSettings.showGreeting ? '' : 'none';
  const fadeRow = document.getElementById('greeting-fade-row');
  if (fadeRow) fadeRow.style.display = ntSettings.showGreeting ? '' : 'none';
  const inp = document.getElementById('greeting-name-input');
  if (inp) inp.value = ntSettings.greetingName || '';
  const fadeInp = document.getElementById('greeting-fade-input');
  if (fadeInp) fadeInp.value = ntSettings.greetingFadeSecs !== undefined ? ntSettings.greetingFadeSecs : 4;
  const el = document.getElementById('greeting-line');
  if (!ntSettings.showGreeting && el) {
    el.classList.remove('greeting-visible');
    setTimeout(() => { el.style.display = 'none'; }, 600);
  } else if (ntSettings.showGreeting) {
    greetingShownOnLoad = false;
    showGreeting();
  }
}
console.log('checkpoint 9');
// ════════════════════════════════════════════ SEARCH
const searchInput = document.getElementById('search-input');
const searchGo    = document.getElementById('search-go');

function applySearchVisibility() {
  const block = document.getElementById('search-block');
  if (block) block.style.display = ntSettings.showSearch === false ? 'none' : '';
  const tog = document.getElementById('toggle-search');
  if (tog) tog.checked = ntSettings.showSearch !== false;
}

function getSearchURL(q) {
  const engine = ntSettings.searchEngine || 'google';
  const encoded = encodeURIComponent(q);
  if (engine === 'bing')   return 'https://www.bing.com/search?q=' + encoded;
  if (engine === 'custom') {
    const tpl = ntSettings.searchCustom || '';
    return tpl.includes('%s') ? tpl.replace('%s', encoded) : tpl + encoded;
  }
  return 'https://www.google.com/search?q=' + encoded;
}
function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  const isURL = /^(https?:\/\/|www\.)/.test(q) || /^[a-zA-Z0-9-]+\.[a-z]{2,}(\/.*)?$/.test(q);
  window.location.href = isURL ? (q.startsWith('http') ? q : 'https://' + q) : getSearchURL(q);
}
if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
if (searchGo)    searchGo.addEventListener('click', doSearch);

// ════════════════════════════════════════════ BLUR
function applyBlur() {
  const amt = ntSettings.blurAmount !== undefined ? ntSettings.blurAmount : 0;
  const bg = document.getElementById('wallpaper-bg');
  if (bg) bg.style.filter = amt > 0 ? `blur(${amt}px)` : '';
  const slider = document.getElementById('blur-slider');
  const label  = document.getElementById('blur-label');
  if (slider) slider.value = amt;
  if (label)  label.textContent = amt + 'px';
}
console.log('checkpoint 9');
// ════════════════════════════════════════════ OVERLAY OPACITY
function applyOverlayOpacity() {
  const savedWp = ntSettings.wallpaper;
  // Check whether a wallpaper is actually displayed right now
  // (random mode sets backgroundImage directly without saving to ntSettings.wallpaper)
  const bg = document.getElementById('wallpaper-bg');
  const actualBg = bg ? bg.style.backgroundImage : '';
  const hasWallpaper = (actualBg && actualBg !== 'none' && actualBg !== '')
                    || (savedWp && savedWp !== 'none');
  const isLight = ntSettings.theme === 'light';
  const pct = isLight
    ? (ntSettings.overlayOpacityLight !== undefined ? ntSettings.overlayOpacityLight : 20)
    : (ntSettings.overlayOpacity      !== undefined ? ntSettings.overlayOpacity      : 72);
  const alpha = (pct / 100).toFixed(2);
  document.documentElement.style.setProperty('--wallpaper-overlay',
    hasWallpaper
      ? (isLight ? `rgba(240,240,245,${alpha})` : `rgba(12,12,16,${alpha})`)
      : (isLight ? 'rgba(240,240,245,0)' : 'rgba(12,12,16,0)'));
  const slider = document.getElementById('overlay-slider');
  const label  = document.getElementById('overlay-label');
  if (slider) slider.value = pct;
  if (label)  label.textContent = pct + '%';
}

// ════════════════════════════════════════════ GRAIN
function applyGrain() {
  const enabled = !!ntSettings.grain;
  const opacity = (ntSettings.grainOpacity || 10) / 100;
  const size    = ntSettings.grainSize || 200;
  document.documentElement.style.setProperty('--grain-opacity', enabled ? opacity : 0);
  document.documentElement.style.setProperty('--grain-size', size + 'px');
  const tog = document.getElementById('toggle-grain');
  if (tog) tog.checked = enabled;
  const ctrl = document.getElementById('grain-controls');
  if (ctrl) ctrl.style.display = enabled ? '' : 'none';
  const opSlider = document.getElementById('grain-opacity-slider');
  const opLabel  = document.getElementById('grain-opacity-label');
  if (opSlider) opSlider.value = ntSettings.grainOpacity || 10;
  if (opLabel)  opLabel.textContent = (ntSettings.grainOpacity || 10) + '%';
  const szSlider = document.getElementById('grain-size-slider');
  const szLabel  = document.getElementById('grain-size-label');
  if (szSlider) szSlider.value = size;
  if (szLabel)  szLabel.textContent = size + 'px';
}

document.getElementById('toggle-grain').addEventListener('change', e => {
  ntSettings.grain = e.target.checked; applyGrain(); saveSettings();
});
document.getElementById('grain-opacity-slider').addEventListener('input', e => {
  ntSettings.grainOpacity = parseInt(e.target.value); applyGrain(); saveSettings();
});
document.getElementById('grain-size-slider').addEventListener('input', e => {
  ntSettings.grainSize = parseInt(e.target.value); applyGrain(); saveSettings();
});

// ════════════════════════════════════════════ SEARCH ENGINE
function applySearchEngine() {
  const engine = ntSettings.searchEngine || 'google';
  const sel = document.getElementById('search-engine-sel');
  if (sel) sel.value = engine;
  const customRow = document.getElementById('search-custom-row');
  if (customRow) customRow.style.display = engine === 'custom' ? '' : 'none';
  const customInput = document.getElementById('search-custom-url');
  if (customInput && ntSettings.searchCustom) customInput.value = ntSettings.searchCustom;
  if (searchInput) {
    let label = 'Google';
    if (engine === 'bing') label = 'Bing';
    else if (engine === 'custom') {
      try {
        const u = new URL(ntSettings.searchCustom || '');
        label = u.hostname.replace(/^www\./, '');
      } catch { label = 'Custom'; }
      if (!label) label = 'Custom';
    }
    searchInput.placeholder = 'Search with ' + label + ' or type a URL…';
  }
}

// ════════════════════════════════════════════ THEME
function applyTheme() {
  document.documentElement.setAttribute('data-theme', ntSettings.theme);
  const tog = document.getElementById('toggle-theme');
  if (tog) tog.checked = ntSettings.theme === 'dark';
}
document.getElementById('toggle-theme').addEventListener('change', e => {
  ntSettings.theme = e.target.checked ? 'dark' : 'light';
  applyTheme(); applyWallpaper(false); saveSettings();
});
applyTheme();
console.log('checkpoint 10');
// ════════════════════════════════════════════ ACCENT
function applyAccent() {
  document.documentElement.style.setProperty('--accent', ntSettings.accent);
  document.querySelectorAll('.accent-swatch[data-color]').forEach(s =>
    s.classList.toggle('active', s.dataset.color === ntSettings.accent));
  // Reflect custom color on the picker swatch
  const picker = document.getElementById('accent-custom-picker');
  const customSwatch = picker ? picker.closest('.accent-custom-swatch') : null;
  if (picker) picker.value = ntSettings.accent;
  if (customSwatch) {
    const isPreset = document.querySelectorAll('.accent-swatch[data-color]') &&
      Array.from(document.querySelectorAll('.accent-swatch[data-color]')).some(s => s.dataset.color === ntSettings.accent);
    customSwatch.style.background = isPreset ? '' : ntSettings.accent;
    customSwatch.classList.toggle('active', !isPreset);
  }
}
document.querySelectorAll('.accent-swatch[data-color]').forEach(s =>
  s.addEventListener('click', () => { ntSettings.accent = s.dataset.color; applyAccent(); saveSettings(); }));
// Custom color picker
(function() {
  const picker = document.getElementById('accent-custom-picker');
  if (!picker) return;
  picker.addEventListener('input', e => {
    ntSettings.accent = e.target.value; applyAccent(); saveSettings();
  });
})();
applyAccent();

// ════════════════════════════════════════════ GLASS COLOR
function applyGlassColor() {
  const hex   = ntSettings.glassColor || '#ffffff';
  const pct   = ntSettings.glassOpacity !== undefined ? ntSettings.glassOpacity : 4;
  const alpha = (pct / 100).toFixed(3);
  const r = parseInt(hex.slice(1,3), 16) || 255;
  const g = parseInt(hex.slice(3,5), 16) || 255;
  const b = parseInt(hex.slice(5,7), 16) || 255;
  // Only color the glass fill; borders stay at a fixed very-low alpha so they
  // remain subtle regardless of the chosen tint color.
  const glassVal      = `rgba(${r},${g},${b},${alpha})`;
  const borderAlpha   = Math.min(0.14, parseFloat(alpha) * 1.2).toFixed(3);
  const glassBorder   = `rgba(${r},${g},${b},${borderAlpha})`;
  const hoverAlpha    = Math.min(0.18, parseFloat(alpha) * 1.8).toFixed(3);
  const glassHover    = `rgba(${r},${g},${b},${hoverAlpha})`;
  document.documentElement.style.setProperty('--glass',        glassVal);
  document.documentElement.style.setProperty('--glass-border', glassBorder);
  document.documentElement.style.setProperty('--glass-hover',  glassHover);
  // Sync controls
  const picker = document.getElementById('glass-color-picker');
  const slider = document.getElementById('glass-opacity-slider');
  const label  = document.getElementById('glass-opacity-label');
  if (picker) picker.value = hex;
  if (slider) slider.value = pct;
  if (label)  label.textContent = pct + '%';
}
(function wireGlassControls() {
  const picker = document.getElementById('glass-color-picker');
  const slider = document.getElementById('glass-opacity-slider');
  const label  = document.getElementById('glass-opacity-label');
  if (picker) picker.addEventListener('input', e => { ntSettings.glassColor = e.target.value; applyGlassColor(); saveSettings(); });
  if (slider) slider.addEventListener('input', e => { ntSettings.glassOpacity = parseInt(e.target.value); if (label) label.textContent = e.target.value + '%'; applyGlassColor(); saveSettings(); });
  applyGlassColor();
})();
console.log('checkpoint 11');
// ════════════════════════════════════════════ WALLPAPER

// ── Storage keys for preloaded wallpaper blobs
// Uses chrome.storage.local (not localStorage) — handles large image blobs reliably.
const WP_CURRENT_KEY = 'nt_wp_current'; // { url, dataUrl } — currently displayed wallpaper
const WP_NEXT_KEY    = 'nt_wp_next';    // { url, dataUrl } — preloaded for next tab open

// Helper: read from chrome.storage.local, returns a Promise
function csGet(key) {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) { resolve(null); return; }
    chrome.storage.local.get(key, r => resolve(r[key] || null));
  });
}
// Helper: write to chrome.storage.local
function csSet(key, value) {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  chrome.storage.local.set({ [key]: value });
}

// Fetch a fresh random photo from picsum.photos and store it in chrome.storage.local
// as the preloaded wallpaper for the next tab open. No CORS issues in extensions.
async function prefetchWallpaper() {
  try {
    const seed = Math.floor(Math.random() * 100000);
    const w    = window.screen.width  || 1920;
    const h    = window.screen.height || 1080;
    const url  = `https://picsum.photos/seed/${seed}/${w}/${h}`;
    const res  = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    csSet(WP_NEXT_KEY, { url, dataUrl });
  } catch {}
}

// Trigger the enter animation on #wallpaper-bg
function triggerWpAnimation() {
  const bg = document.getElementById('wallpaper-bg');
  if (!bg) return;
  const anim = ntSettings.wpAnimation || 'fade-expand';
  if (anim === 'none') return;
  bg.classList.remove('wp-entering', 'wp-entering-fade');
  void bg.offsetWidth; // force reflow so animation restarts
  const cls = anim === 'fade' ? 'wp-entering-fade' : 'wp-entering';
  bg.classList.add(cls);
  bg.addEventListener('animationend', () => bg.classList.remove(cls), { once: true });
}

// Set a wallpaper URL (data-URL or remote) on #wallpaper-bg with animation
function setWallpaperBg(url, animate) {
  const bg = document.getElementById('wallpaper-bg');
  if (!bg) return;
  if (!url || url === 'none') {
    bg.style.backgroundImage = 'none';
    return;
  }
  bg.style.backgroundImage = "url('" + url + "')";
  if (animate) triggerWpAnimation();
  applyOverlayOpacity();
}

function applyWallpaper(animate) {
  const wp = ntSettings.wallpaper;
  const bg = document.getElementById('wallpaper-bg');
  document.querySelectorAll('.wallpaper-thumb').forEach(t =>
    t.classList.toggle('active', t.dataset.wp === wp));
  if (!wp || wp === 'none') {
    bg.style.backgroundImage = 'none';
    applyOverlayOpacity();
    return;
  }
  // Try cached blob first (async), fall back to direct URL.
  // Always wait for the image to finish loading before triggering the animation
  // so the expand effect plays on a visible image, not a blank element.
  csGet(WP_CURRENT_KEY).then(cached => {
    const src = (cached && cached.url === wp && cached.dataUrl)
      ? cached.dataUrl
      : wp;

    if (animate) {
      const img = new Image();
      img.onload = () => {
        bg.style.backgroundImage = "url('" + src + "')";
        triggerWpAnimation();
        applyOverlayOpacity();
      };
      img.onerror = () => {
        // Image failed — still show it, just skip the animation
        bg.style.backgroundImage = "url('" + src + "')";
        applyOverlayOpacity();
      };
      img.src = src;
    } else {
      bg.style.backgroundImage = "url('" + src + "')";
      applyOverlayOpacity();
    }
  });
}
console.log('checkpoint 12');
document.querySelectorAll('.wallpaper-thumb').forEach(t =>
  t.addEventListener('click', () => {
    const wp = t.dataset.wp;
    ntSettings.wallpaper = wp;
    // Turn off random wallpaper when a specific one is picked
    if (wp && wp !== 'none') {
      ntSettings.randomWallpaper = false;
      const togRand = document.getElementById('toggle-random-wp');
      if (togRand) togRand.checked = false;
    }
    // Update active state immediately
    document.querySelectorAll('.wallpaper-thumb').forEach(th => th.classList.remove('active'));
    t.classList.add('active');
    // Paint immediately with animation — don't wait for cache
    const bg = document.getElementById('wallpaper-bg');
    if (wp === 'none' || !wp) {
      if (bg) bg.style.backgroundImage = 'none';
      applyOverlayOpacity();
    } else {
      if (bg) bg.style.backgroundImage = "url('" + wp + "')";
      triggerWpAnimation();
      applyOverlayOpacity();
      // Cache in background for next load
      fetch(wp).then(r => r.blob()).then(blob => {
        const reader = new FileReader();
        reader.onload = () => csSet(WP_CURRENT_KEY, { url: wp, dataUrl: reader.result });
        reader.readAsDataURL(blob);
      }).catch(() => {});
    }
    saveSettings();
  }));
document.getElementById('wp-upload').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { ntSettings.wallpaper = ev.target.result; applyWallpaper(true); saveSettings(); };
  reader.readAsDataURL(file);
});
applyWallpaper(!ntSettings.randomWallpaper);
applyBlur();
applySearchEngine();



// Sliders
document.getElementById('blur-slider').addEventListener('input', e => { ntSettings.blurAmount = parseInt(e.target.value); applyBlur(); saveSettings(); });
document.getElementById('overlay-slider').addEventListener('input', e => {
  if (ntSettings.theme === 'light') ntSettings.overlayOpacityLight = parseInt(e.target.value);
  else ntSettings.overlayOpacity = parseInt(e.target.value);
  applyOverlayOpacity(); saveSettings();
});
document.getElementById('search-engine-sel').addEventListener('change', e => { ntSettings.searchEngine = e.target.value; applySearchEngine(); saveSettings(); });
document.getElementById('search-custom-url').addEventListener('input', e => { ntSettings.searchCustom = e.target.value.trim(); applySearchEngine(); saveSettings(); });

// Clock top slider
document.getElementById('clock-top-slider').addEventListener('input', e => {
  ntSettings.clockTopOffset = parseInt(e.target.value); applyClockTop(); saveSettings();
});

// Top sites position slider
(function() {
  const slider = document.getElementById('topsites-top-slider');
  if (slider) slider.addEventListener('input', e => {
    ntSettings.topsitesTopOffset = parseInt(e.target.value); applyTopsitesTop(); saveSettings();
  });
  applyTopsitesTop();
})();


// ════════════════════════════════════════════ HIGH-RES FEED
function applyHiResFeed() {
  const enabled = !!ntSettings.hiResFeed;
  document.querySelectorAll('.wallpaper-hires').forEach(el => { el.style.display = enabled ? '' : 'none'; });
  const tog = document.getElementById('toggle-hires-feed');
  if (tog) tog.checked = enabled;
}
// Hi-res always on — toggle removed from UI
ntSettings.hiResFeed = true;
applyHiResFeed();

// ════════════════════════════════════════════ RANDOM WALLPAPER
async function applyRandomWallpaper() {
  if (!ntSettings.randomWallpaper) return;

  const bg = document.getElementById('wallpaper-bg');

  // Check if first-paint already set the image from the preloaded blob
  if (bg && bg.dataset.wpFirstPaint === 'random') {
    delete bg.dataset.wpFirstPaint;
    // Save what was painted as current, clear the next slot
    const next = await csGet(WP_NEXT_KEY);
    if (next) {
      csSet(WP_CURRENT_KEY, next);
      csSet(WP_NEXT_KEY, null);
    }
    triggerWpAnimation();
    applyOverlayOpacity();
    // Prefetch the next one in the background
    prefetchWallpaper();
    return;
  }
console.log('checkpoint 13');
  // No first-paint — read from chrome.storage.local
  const next = await csGet(WP_NEXT_KEY);

  if (next && next.dataUrl) {
    // Preloaded blob ready — paint it instantly
    if (bg) bg.style.backgroundImage = "url('" + next.dataUrl + "')";
    triggerWpAnimation();
    applyOverlayOpacity();
    csSet(WP_CURRENT_KEY, next);
    csSet(WP_NEXT_KEY, null);
  } else {
    // Nothing preloaded yet (first ever open) — fetch directly from picsum
    const w    = window.screen.width  || 1920;
    const h    = window.screen.height || 1080;
    const seed = Math.floor(Math.random() * 100000);
    const url  = `https://picsum.photos/seed/${seed}/${w}/${h}`;
    if (bg) {
      const img = new Image();
      img.onload = () => {
        bg.style.backgroundImage = "url('" + img.src + "')";
        triggerWpAnimation();
        applyOverlayOpacity();
      };
      img.src = url;
    }
  }

  // Always prefetch the next wallpaper in the background
  prefetchWallpaper();
}

const toggleRandomWp = document.getElementById('toggle-random-wp');
if (toggleRandomWp) {
  toggleRandomWp.checked = !!ntSettings.randomWallpaper;
  toggleRandomWp.addEventListener('change', e => {
    ntSettings.randomWallpaper = e.target.checked; 
    if (ntSettings.randomWallpaper) {
      // Clear any picked wallpaper so they don't conflict
      ntSettings.wallpaper = 'none';
      document.querySelectorAll('.wallpaper-thumb').forEach(t => t.classList.remove('active'));
      const noneThumb = document.querySelector('.wallpaper-thumb[data-wp="none"]');
      if (noneThumb) noneThumb.classList.add('active');
      applyRandomWallpaper();
    } else {
      applyWallpaper(true);
    }
    saveSettings();
  });
}

// ════════════════════════════════════════════ ANIMATION SETTINGS
(function() {
  const wpAnimSel = document.getElementById('wp-anim-sel');
  if (wpAnimSel) {
    wpAnimSel.value = ntSettings.wpAnimation || 'fade-expand';
    wpAnimSel.addEventListener('change', e => { ntSettings.wpAnimation = e.target.value; saveSettings(); });
  }
  const clockAnimSel = document.getElementById('clock-anim-sel');
  if (clockAnimSel) {
    clockAnimSel.value = ntSettings.clockAnimation || 'fade-up';
    clockAnimSel.addEventListener('change', e => { ntSettings.clockAnimation = e.target.value; saveSettings(); });
  }
  const widgetAnimSel = document.getElementById('widget-anim-sel');
  if (widgetAnimSel) {
    widgetAnimSel.value = ntSettings.widgetAnimation || 'fade-up';
    widgetAnimSel.addEventListener('change', e => { ntSettings.widgetAnimation = e.target.value; saveSettings(); });
  }
})();

// ════════════════════════════════════════════ MAIN CLOCK TYPE
(function() {
  const typeSel = document.getElementById('clock-type-sel');
  if (typeSel) {
    typeSel.value = ntSettings.clockType || 'digital';
    typeSel.addEventListener('change', e => {
      ntSettings.clockType = e.target.value; saveSettings(); applyClockType();
    });
  }
  const sizeSlider = document.getElementById('main-clock-size-slider');
  const sizeLabel  = document.getElementById('main-clock-size-label');
  if (sizeSlider) {
    sizeSlider.value = ntSettings.mainClockSizePx || 200;
    sizeSlider.addEventListener('input', e => {
      ntSettings.mainClockSizePx = parseInt(e.target.value);
      if (sizeLabel) sizeLabel.textContent = e.target.value + 'px';
      const analogEl = document.getElementById('clock-analog');
      if (analogEl) { analogEl.style.width = e.target.value + 'px'; analogEl.style.height = e.target.value + 'px'; }
      saveSettings();
    });
  }
  applyClockType();
})();

console.log('checkpoint 14');

// ════════════════════════════════════════════ UI FONT SIZE
function applyFontSize() {
  const pct = ntSettings.uiFontSize || 100;
  document.documentElement.style.fontSize = (pct / 100) + 'rem';
  const slider = document.getElementById('fontsize-slider');
  const label  = document.getElementById('fontsize-label');
  if (slider) slider.value = pct;
  if (label)  label.textContent = pct + '%';
}
document.getElementById('fontsize-slider').addEventListener('input', e => { ntSettings.uiFontSize = parseInt(e.target.value); applyFontSize(); saveSettings(); });
applyFontSize();

// ════════════════════════════════════════════ SHOW/HIDE SEARCH
document.getElementById('toggle-search').addEventListener('change', e => { ntSettings.showSearch = e.target.checked; applySearchVisibility(); saveSettings(); });
applySearchVisibility();

// ════════════════════════════════════════════ GREETING
document.getElementById('toggle-greeting').addEventListener('change', e => {
  ntSettings.showGreeting = e.target.checked;
  const row = document.getElementById('greeting-name-row');
  if (row) row.style.display = ntSettings.showGreeting ? '' : 'none';
  const fadeRow = document.getElementById('greeting-fade-row');
  if (fadeRow) fadeRow.style.display = ntSettings.showGreeting ? '' : 'none';
  if (!ntSettings.showGreeting) {
    const el = document.getElementById('greeting-line');
    if (el) { el.classList.remove('greeting-visible'); setTimeout(() => { el.style.display = 'none'; }, 600); }
  } else { greetingShownOnLoad = false; showGreeting(); }
  saveSettings();
});
document.getElementById('greeting-name-input').addEventListener('input', e => { ntSettings.greetingName = e.target.value; showGreeting(); saveSettings(); });

// ════════════════════════════════════════════ FAVICON HELPER
const FAVICON_CACHE_KEY = 'nt_favicon_cache';
function getFaviconCache() { return LS.get(FAVICON_CACHE_KEY, {}); }
function cacheFavicon(domain, dataUrl) {
  try {
    const cache = getFaviconCache();
    cache[domain] = { d: dataUrl, ts: Date.now() };
    // Keep cache size reasonable: drop entries older than 7 days
    const week = 7 * 24 * 60 * 60 * 1000;
    Object.keys(cache).forEach(k => { if (Date.now() - (cache[k].ts || 0) > week) delete cache[k]; });
    LS.set(FAVICON_CACHE_KEY, cache);
  } catch {}
}
function getCachedFavicon(domain) {
  const cache = getFaviconCache();
  const entry = cache[domain];
  return (entry && entry.d) ? entry.d : null;
}
function getFaviconUrl(domain) { return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64'; }
function getFaviconUrlSm(domain) { return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=32'; }

// ════════════════════════════════════════════ TOP SITES
function getIgnoreList() { return LS.get('nt_topsites_ignore', []); }
function saveIgnoreList(list) { LS.set('nt_topsites_ignore', list); }

function renderIgnoreList() {
  const body = document.getElementById('ignorelist-body');
  if (!body) return;
  const list = getIgnoreList();
  body.innerHTML = '';
  if (!list.length) {
    body.innerHTML = '<div style="font-size:0.78rem;color:var(--text2);padding:8px 0;text-align:center;">No ignored sites</div>';
    return;
  }
  list.forEach(function(domain) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--glass-border);';
    const img = document.createElement('img');
    img.src = getFaviconUrlSm(domain);
    img.style.cssText = 'width:16px;height:16px;border-radius:3px;flex-shrink:0;';
    img.addEventListener('error', function() { img.style.display = 'none'; });
    const lbl = document.createElement('span');
    lbl.textContent = domain;
    lbl.style.cssText = 'flex:1;font-size:0.78rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const btn = document.createElement('button');
    btn.textContent = '×'; btn.title = 'Remove from ignore list';
    btn.style.cssText = 'background:none;border:none;color:var(--accent);font-size:1rem;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;';
    btn.addEventListener('click', function() { saveIgnoreList(getIgnoreList().filter(function(d) { return d !== domain; })); renderIgnoreList(); loadTopSites(); });
    row.appendChild(img); row.appendChild(lbl); row.appendChild(btn);
    body.appendChild(row);
  });
}
window.renderIgnoreList = renderIgnoreList;

(function wireIgnoreListPanel() {
  const openBtn = document.getElementById('open-ignore-list-btn');
  const w = document.getElementById('widget-ignorelist');
  if (openBtn && w) {
    openBtn.addEventListener('click', function() {
      if (typeof closeSettings === 'function') closeSettings();
      w.style.display = 'block';
      renderIgnoreList();
      bringWidgetToFront(w);
      w.style.top = Math.max(60, (window.innerHeight - w.offsetHeight) / 2) + 'px';
      w.style.transform = '';
    });
  }
  const clearBtn = document.getElementById('ignorelist-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() { saveIgnoreList([]); renderIgnoreList(); loadTopSites(); });
  }
})();

function addToIgnoreList(domain) {
  const list = getIgnoreList();
  if (!list.includes(domain)) { list.push(domain); saveIgnoreList(list); }
}

function _domainLabel(domain) {
  var d = domain.replace(/^www\./, '');
  var dot = d.lastIndexOf('.');
  if (dot > 0) d = d.slice(0, dot);
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function renderTopSites(sites) {
  const grid = document.getElementById('topsites-grid');
  grid.innerHTML = '';
  const ignored  = getIgnoreList();
  const filtered = sites.filter(s => !ignored.includes(s.domain || ''));
  const slice    = filtered.slice(0, ntSettings.topsitesCount || 8);
  if (!slice.length) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--text2);font-size:0.8rem;padding:12px;text-align:center';
    msg.textContent = 'Visit some sites to see them here';
    grid.appendChild(msg); return;
  }
  slice.forEach(site => {
    const domain = site.domain || '';
    const label  = _domainLabel(domain);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-flex;';
    const el = document.createElement('a');
    el.className = 'site-icon'; el.href = site.url; el.title = label;
    const img = document.createElement('img');
    const cachedFav = getCachedFavicon(domain);
    img.src = cachedFav || getFaviconUrl(domain);
    img.alt = '';
    if (!cachedFav) {
      img.addEventListener('load', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 64; canvas.height = img.naturalHeight || 64;
          canvas.getContext('2d').drawImage(img, 0, 0);
          cacheFavicon(domain, canvas.toDataURL());
        } catch {}
      });
    }
    const ph = document.createElement('div');
    ph.className = 'site-favicon-placeholder'; ph.style.display = 'none';
    ph.textContent = (label || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const name = document.createElement('div');
    name.className = 'site-name'; name.textContent = label;
    el.appendChild(img); el.appendChild(ph); el.appendChild(name);
    const xBtn = document.createElement('button');
    xBtn.title = 'Ignore this site';
    xBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#e53e3e;border:2px solid rgba(0,0,0,0.3);color:#fff;font-size:9px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.15s;padding-top:3px;z-index:5;';
    xBtn.textContent = '✕';
    xBtn.addEventListener('mouseenter', () => { xBtn.style.opacity = '1'; });
    xBtn.addEventListener('mouseleave', () => { xBtn.style.opacity = '0'; });
    xBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      addToIgnoreList(domain);
      wrap.style.transition = 'opacity 0.2s, transform 0.2s';
      wrap.style.opacity = '0'; wrap.style.transform = 'scale(0.8)';
      setTimeout(() => { wrap.remove(); loadTopSites(); }, 200);
    });
    wrap.appendChild(el); wrap.appendChild(xBtn);
    grid.appendChild(wrap);
  });
}

const TOPSITES_CACHE_KEY    = 'nt_topsites_cache';
const TOPSITES_EH_CACHE_KEY = 'nt_topsites_eh_cache';

function loadTopSites() {
  const block = document.getElementById('topsites-block');
  if (!ntSettings.showTopsites) { block.style.display = 'none'; return; }
  block.style.display = '';

  // Show best cached data instantly — no flash
  const ehCache  = LS.get(TOPSITES_EH_CACHE_KEY, null);
  const genCache = LS.get(TOPSITES_CACHE_KEY, null);
  const bestCache = (ehCache && ehCache.sites && ehCache.sites.length) ? ehCache
                  : (genCache && genCache.sites && genCache.sites.length) ? genCache : null;
  if (bestCache) renderTopSites(bestCache.sites);

  function applyFresh(fresh, fromEH) {
    if (!fresh || !fresh.length) return;
    renderTopSites(fresh);
    const entry = { sites: fresh, ts: Date.now() };
    if (fromEH) LS.set(TOPSITES_EH_CACHE_KEY, entry);
    LS.set(TOPSITES_CACHE_KEY, Object.assign({}, entry, { source: fromEH ? 'eh' : 'history' }));
  }

  function ehItemsToDomains(items) {
    const counts = {}, info = {};
    items.forEach(function(item) {
      try {
        const u = new URL(item.identifier);
        const d = u.hostname.replace(/^www\./, '');
        if (!d || d.startsWith('chrome') || d.startsWith('about') || d === 'newtab') return;
        counts[d] = (counts[d] || 0) + (item.count || 1);
        if (!info[d]) info[d] = { domain: d, url: u.origin };
      } catch {}
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([d]) => info[d]);
  }

  if (ehAvailable) {
    ehSend({ type: 'GET_MOST_VISITED', viewType: 'domain', period: '10' }).then(r => {
      if (r && r.items && r.items.length) {
        const fresh = ehItemsToDomains(r.items);
        if (fresh.length) { applyFresh(fresh, true); return; }
      }
      _loadTopSitesFromHistory().then(fresh => {
        if (fresh) applyFresh(fresh, false);
        else if (!bestCache) loadFallbackTopSites();
      });
    });
  } else {
    _loadTopSitesFromHistory().then(fresh => {
      if (fresh) applyFresh(fresh, false);
      else if (!bestCache) loadFallbackTopSites();
    });
  }
}

function _loadTopSitesFromHistory() {
  if (typeof chrome === 'undefined' || !chrome.history) return Promise.resolve(null);
  const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Promise(resolve => {
    chrome.history.search({ text: '', startTime, maxResults: 1000 }, items => {
      if (!items || !items.length) { resolve(null); return; }
      const counts = {}, info = {};
      items.forEach(item => {
        try {
          const u = new URL(item.url);
          const d = u.hostname.replace(/^www\./, '');
          if (!d || d.startsWith('chrome') || d.startsWith('about') || d === 'newtab') return;
          counts[d] = (counts[d] || 0) + (item.visitCount || 1);
          if (!info[d]) info[d] = { domain: d, url: u.origin, title: item.title || d };
        } catch {}
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([d]) => info[d]);
      resolve(sorted.length ? sorted : null);
    });
  });
}
function loadTopSitesFallbackNative() { loadTopSites(); }
function loadFallbackTopSites() {
  renderTopSites([
    { domain: 'github.com',        url: 'https://github.com',        title: 'GitHub' },
    { domain: 'youtube.com',       url: 'https://youtube.com',       title: 'YouTube' },
    { domain: 'google.com',        url: 'https://google.com',        title: 'Google' },
    { domain: 'reddit.com',        url: 'https://reddit.com',        title: 'Reddit' },
    { domain: 'twitter.com',       url: 'https://twitter.com',       title: 'X / Twitter' },
    { domain: 'wikipedia.org',     url: 'https://wikipedia.org',     title: 'Wikipedia' },
    { domain: 'stackoverflow.com', url: 'https://stackoverflow.com', title: 'Stack Overflow' },
    { domain: 'amazon.com',        url: 'https://amazon.com',        title: 'Amazon' },
  ]);
}
document.getElementById('toggle-topsites').addEventListener('change', e => { ntSettings.showTopsites = e.target.checked; saveSettings(); loadTopSites(); });
document.getElementById('topsites-count').addEventListener('change', e => { ntSettings.topsitesCount = parseInt(e.target.value); saveSettings(); loadTopSites(); });
document.getElementById('toggle-topsites').checked = ntSettings.showTopsites;
document.getElementById('topsites-count').value    = String(ntSettings.topsitesCount);
loadTopSites();
console.log('checkpoint 15');
// ════════════════════════════════════════════ SIDEBAR — ACTIVE TABS
function renderActiveTabs(tabs, currentTabId) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  if (!tabs.length) { renderSidebarEmpty('No open tabs'); return; }
  tabs.forEach(tab => {
    if (!tab.url || tab.url.startsWith('chrome://newtab')) return;
    let domain = '';
    try { domain = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
    const el = document.createElement('div');
    el.className = 'tab-item' + (tab.id === currentTabId ? ' active-tab' : '');
    el.title = tab.title || tab.url;
    el.dataset.tabId = tab.id;
    const img = document.createElement('img'); img.className = 'tab-fav';
    img.src = tab.favIconUrl || getFaviconUrlSm(domain);
    const ph = document.createElement('div'); ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (tab.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span'); lbl.className = 'tab-label'; lbl.textContent = tab.title || domain;
    const hint = document.createElement('span'); hint.className = 'tab-restore'; hint.textContent = tab.id === currentTabId ? 'here' : 'switch';
    // Close tab button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn'; closeBtn.textContent = '✕'; closeBtn.title = 'Close tab';
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.remove(tab.id);
        el.style.transition = 'opacity 0.18s, max-height 0.2s';
        el.style.opacity = '0'; el.style.maxHeight = '0'; el.style.overflow = 'hidden';
        setTimeout(() => el.remove(), 220);
      }
    });
    el.appendChild(img); el.appendChild(ph); el.appendChild(lbl); el.appendChild(hint); el.appendChild(closeBtn);
    el.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });
    list.appendChild(el);
  });
}

function loadActiveTabsSidebar() {
  document.getElementById('sidebar-section-label').textContent = 'Active Tabs';
  if (typeof chrome === 'undefined' || !chrome.tabs) { renderSidebarEmpty('Tabs API unavailable'); return; }
  chrome.tabs.query({}, tabs => {
    chrome.tabs.getCurrent(current => { renderActiveTabs(tabs, current ? current.id : -1); });
  });
}

function setupTabListeners() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;
  const refresh = () => { if (ntSettings.sidebarMode === 'activetabs') loadActiveTabsSidebar(); };
  chrome.tabs.onCreated.addListener(refresh);
  chrome.tabs.onRemoved.addListener(refresh);
  chrome.tabs.onUpdated.addListener((id, info) => { if (info.title || info.favIconUrl || info.status === 'complete') refresh(); });
  chrome.tabs.onMoved.addListener(refresh);
  chrome.tabs.onActivated.addListener(refresh);
}
setupTabListeners();

// ════════════════════════════════════════════ SIDEBAR — OTHER MODES
function renderSidebarEmpty(msg) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'sidebar-empty'; empty.textContent = msg;
  list.appendChild(empty);
}
function renderMostVisited(items) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  if (!items.length) { renderSidebarEmpty('No history yet'); return; }
  items.forEach(item => {
    const url = item.identifier;
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    const el = document.createElement('a');
    el.className = 'tab-item'; el.href = url; el.title = (item.title || domain) + ' — ' + item.count + ' visits'; el.style.textDecoration = 'none';
    const img = document.createElement('img'); img.className = 'tab-fav';
    img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=32';
    const ph = document.createElement('div'); ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (item.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span'); lbl.className = 'tab-label'; lbl.textContent = item.title || domain;
    const cnt = document.createElement('span'); cnt.className = 'tab-restore';
    cnt.style.cssText = 'font-size:0.6rem;color:var(--text2);opacity:1;'; cnt.textContent = item.count + 'x';
    el.appendChild(img); el.appendChild(ph); el.appendChild(lbl); el.appendChild(cnt);
    list.appendChild(el);
  });
}
function loadMostVisitedSidebar() {
  document.getElementById('sidebar-section-label').textContent = 'Most Visited — 10 days';
  ehSend({ type: 'GET_MOST_VISITED', viewType: 'url', period: '10' }).then(r => {
    if (!r || !r.items) { renderSidebarEmpty('Link Extended History for history data'); return; }
    renderMostVisited(r.items.slice(0, 30));
  });
}
function removeStoredTab(tabId, itemEl) {
  itemEl.style.transition = 'opacity 0.18s, transform 0.18s, max-height 0.22s, padding 0.22s';
  itemEl.style.overflow = 'hidden'; itemEl.style.maxHeight = itemEl.offsetHeight + 'px';
  requestAnimationFrame(() => { itemEl.style.opacity = '0'; itemEl.style.transform = 'translateX(-10px)'; itemEl.style.maxHeight = '0'; itemEl.style.paddingTop = '0'; itemEl.style.paddingBottom = '0'; });
  setTimeout(() => { itemEl.remove(); const list = document.getElementById('sidebar-tabs-list'); if (list && !list.querySelector('.tab-item')) renderSidebarEmpty('No stored tabs yet'); }, 240);
  ehSend({ type: 'REMOVE_TAB_STORAGE_ENTRY', id: tabId });
}
function renderStoredTabs(tabs) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  if (!tabs.length) { renderSidebarEmpty('No stored tabs yet'); return; }
  tabs.forEach(tab => {
    let domain = '';
    try { domain = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
    // Use a real <a> so right-click gives the native link context menu (Open in new tab etc.)
    const item = document.createElement('a');
    item.className = 'tab-item'; item.title = tab.title || tab.url;
    item.href = tab.url;
    item.style.textDecoration = 'none';
    // Left-click: navigate and remove from storage
    item.addEventListener('click', e => {
      e.preventDefault();
      window.location.href = tab.url;
      removeStoredTab(tab.id, item);
    });
    const img = document.createElement('img'); img.className = 'tab-fav'; img.src = getFaviconUrlSm(domain);
    const ph = document.createElement('div'); ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (tab.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span'); lbl.className = 'tab-label'; lbl.textContent = tab.title || domain;
    const rst = document.createElement('span'); rst.className = 'tab-restore'; rst.textContent = 'Open';
    item.appendChild(img); item.appendChild(ph); item.appendChild(lbl); item.appendChild(rst);
    list.appendChild(item);
  });
}
function loadStoredTabsSidebar() {
  document.getElementById('sidebar-section-label').textContent = 'Stored Tabs';
  ehSend({ type: 'GET_TAB_STORAGE' }).then(r => { renderStoredTabs((r && r.entries) || []); });
}
function renderBookmarkItems(nodes) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  const bookmarks = (nodes || []).filter(n => !!n.url);
  if (!bookmarks.length) { renderSidebarEmpty('Empty folder'); return; }
  bookmarks.forEach(node => {
    let domain = '';
    try { domain = new URL(node.url).hostname.replace(/^www\./, ''); } catch {}
    const el = document.createElement('a'); el.className = 'tab-item'; el.href = node.url; el.title = node.title || node.url; el.style.textDecoration = 'none';
    const img = document.createElement('img'); img.className = 'tab-fav';
    img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=32';
    const ph = document.createElement('div'); ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (node.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span'); lbl.className = 'tab-label'; lbl.textContent = node.title || domain;
    el.appendChild(img); el.appendChild(ph); el.appendChild(lbl);
    list.appendChild(el);
  });
}
console.log('checkpoint 16');
function loadBookmarksSidebar() {
  const folderId = ntSettings.bookmarkFolderId;
  document.getElementById('sidebar-section-label').textContent = ntSettings.bookmarkFolderName || 'Bookmarks';
  if (!folderId || typeof chrome === 'undefined' || !chrome.bookmarks) { renderSidebarEmpty('No folder selected'); return; }
  chrome.bookmarks.getChildren(folderId, nodes => {
    if (chrome.runtime.lastError || !nodes) { renderSidebarEmpty('Folder not found'); return; }
    renderBookmarkItems(nodes);
  });
}
function populateBookmarkFolderPicker() {
  if (typeof chrome === 'undefined' || !chrome.bookmarks) return;
  const sel = document.getElementById('bookmark-folder-sel');
  if (!sel || sel._populated) return;
  sel._populated = true;
  const folders = [];
  function walk(nodes, depth) {
    for (const n of nodes) {
      if (!n.url) { folders.push({ id: n.id, title: ('  '.repeat(depth) + (n.title || 'Untitled')) }); if (n.children) walk(n.children, depth + 1); }
    }
  }
  chrome.bookmarks.getTree(tree => {
    walk(tree[0].children || [], 0);
    sel.innerHTML = '';
    folders.forEach(f => { const opt = document.createElement('option'); opt.value = f.id; opt.textContent = f.title.trim(); if (f.id === ntSettings.bookmarkFolderId) opt.selected = true; sel.appendChild(opt); });
    if (!ntSettings.bookmarkFolderId && folders.length) { ntSettings.bookmarkFolderId = folders[0].id; ntSettings.bookmarkFolderName = folders[0].title.trim(); saveSettings(); }
  });
  sel.addEventListener('change', e => {
    ntSettings.bookmarkFolderId = e.target.value;
    ntSettings.bookmarkFolderName = e.target.options[e.target.selectedIndex].text;
    saveSettings();
    if (ntSettings.sidebarMode === 'bookmarks') loadBookmarksSidebar();
  });
}
function applySidebarMode() {
  const sidebar = document.getElementById('sidebar');
  const mode = ntSettings.sidebarMode || 'activetabs';
  const sel = document.getElementById('sidebar-mode');
  const inlineSel = document.getElementById('sidebar-mode-inline');
  if (sel) sel.value = mode;
  if (inlineSel) inlineSel.value = mode;
  const folderRow = document.getElementById('bookmark-folder-row');
  if (folderRow) folderRow.style.display = mode === 'bookmarks' ? '' : 'none';
  if (mode === 'none') { sidebar.style.display = 'none'; return; }
  sidebar.style.display = '';
  if (mode === 'activetabs') loadActiveTabsSidebar();
  else if (mode === 'stored') loadStoredTabsSidebar();
  else if (mode === 'bookmarks') { populateBookmarkFolderPicker(); loadBookmarksSidebar(); }
  else loadMostVisitedSidebar();
}
const sidebarModeEl = document.getElementById('sidebar-mode');
if (sidebarModeEl) sidebarModeEl.addEventListener('change', e => { ntSettings.sidebarMode = e.target.value; saveSettings(); applySidebarMode(); });
const sidebarModeInlineEl = document.getElementById('sidebar-mode-inline');
if (sidebarModeInlineEl) sidebarModeInlineEl.addEventListener('change', e => {
  ntSettings.sidebarMode = e.target.value;
  const settingsSel = document.getElementById('sidebar-mode');
  if (settingsSel) settingsSel.value = e.target.value;
  saveSettings(); applySidebarMode();
});
probeExtendedHistory();
applySidebarMode();

// Wire fade input
const greetingFadeEl = document.getElementById('greeting-fade-input');
if (greetingFadeEl) greetingFadeEl.addEventListener('change', e => {
  ntSettings.greetingFadeSecs = Math.max(0, parseInt(e.target.value) || 0);
  saveSettings(); if (ntSettings.showGreeting) { greetingShownOnLoad = false; showGreeting(); }
});
applyGreetingSettings();

document.getElementById('openHistoryBtn').addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url: 'chrome://history' });
});

// ════════════════════════════════════════════ SETTINGS PANEL
function openSettings() {
  document.getElementById('settings-panel').classList.add('open');
    const hintBtn = document.getElementById('hint-settings');
  if (hintBtn) { hintBtn.style.opacity = '0'; hintBtn.style.pointerEvents = 'none'; }
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
   const hintBtn = document.getElementById('hint-settings');
  if (hintBtn) { hintBtn.style.opacity = ''; hintBtn.style.pointerEvents = ''; }
  document.getElementById('settings-overlay').classList.remove('open');
}
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('openSettingsFromSidebar').addEventListener('click', openSettings);
document.getElementById('settingsClose').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);

// ════════════════════════════════════════════ EXPORT / IMPORT
document.getElementById('settings-export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(ntSettings, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'extended-page-settings.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('settings-import-btn').addEventListener('click', () => {
  document.getElementById('settings-import-file').click();
});
document.getElementById('settings-import-file').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      ntSettings = Object.assign({}, DEFAULT_NT, imported);
      ntSettings.widgets         = Object.assign({}, DEFAULT_NT.widgets, ntSettings.widgets || {});
      ntSettings.widgetPositions = ntSettings.widgetPositions || {};
      ntSettings.extraClocks     = ntSettings.extraClocks     || [];
      saveSettings();
      location.reload();
    } catch { alert('Invalid settings file.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ════════════════════════════════════════════ RAW SETTINGS EDITOR
(function initRawSettingsEditor() {
  const toggleBtn = document.getElementById('raw-settings-toggle');
  const body      = document.getElementById('raw-settings-body');
  const list      = document.getElementById('raw-settings-list');
  if (!toggleBtn || !body || !list) return;

  // ── Widget clear buttons ─────────────────────────────────────────────────
  (function buildWidgetClearList() {
    const container = document.getElementById('dev-widget-clear-list');
    if (!container) return;
    const WIDGET_LABELS = {
      notes:     { icon:'📝', label:'Notes' },
      todo:      { icon:'✅', label:'To-Do' },
      weather:   { icon:'🌤', label:'Weather' },
      timer:     { icon:'⏱', label:'Timer' },
      currency:  { icon:'💱', label:'Currency' },
      quotes:    { icon:'💬', label:'Quotes' },
      learn:     { icon:'🔤', label:'Learn Language' },
      merriam:   { icon:'📖', label:'Word of the Day' },
      quicklinks:{ icon:'🔗', label:'Quick Links' },
      calendar:  { icon:'📅', label:'Calendar' },
      crypto:    { icon:'₿',  label:'Crypto' },
    };
    function getWidgetKeys(id) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k === 'nt_' + id || k.startsWith('nt_' + id + '_') ||
            k === 'nt_notes_' + id || k === 'nt_todo_' + id ||
            k.startsWith('nt_notes_' + id) || k.startsWith('nt_todo_' + id) ||
            k.startsWith(id + '_'))) keys.push(k);
      }
      // Also match widget-specific keys like nt_weather, nt_currency, etc.
      const specific = localStorage.getItem('nt_' + id);
      if (specific !== null && !keys.includes('nt_' + id)) keys.push('nt_' + id);
      return keys;
    }
    container.innerHTML = '';
    // Base widgets
    Object.keys(WIDGET_LABELS).forEach(function(id) {
      var meta = WIDGET_LABELS[id];
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--glass);border:1px solid var(--glass-border);border-radius:7px;margin-bottom:4px;';
      var lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:0.75rem;color:var(--text);';
      lbl.textContent = meta.icon + ' ' + meta.label;
      var btn = document.createElement('button');
      btn.textContent = 'Clear';
      btn.style.cssText = 'background:none;border:1px solid var(--glass-border);border-radius:5px;color:var(--text2);font-family:var(--font);font-size:0.68rem;padding:3px 10px;cursor:pointer;transition:color 0.12s,border-color 0.12s;';
      btn.addEventListener('mouseover', function() { btn.style.color='#e53e3e'; btn.style.borderColor='#e53e3e'; });
      btn.addEventListener('mouseout',  function() { btn.style.color=''; btn.style.borderColor=''; });
      btn.addEventListener('click', function() {
        // Remove all LS keys for this widget
        var keys = getWidgetKeys(id);
        // Also clear extra instances
        (ntSettings.extraNotes || []).forEach(function(e) {
          if (id === 'notes') { localStorage.removeItem('nt_notes_' + e.id); }
        });
        (ntSettings.extraTodos || []).forEach(function(e) {
          if (id === 'todo') { localStorage.removeItem('nt_todo_' + e.id); }
        });
        // Clear any direct nt_<id> key
        var directKey = localStorage.getItem('nt_' + id);
        if (directKey !== null) localStorage.removeItem('nt_' + id);
        // Clear from ntSettings
        if (id === 'notes' || id === 'todo') {
          // Remove extra instances from settings
          if (id === 'notes') {
            (ntSettings.extraNotes || []).forEach(function(e) { delete ntSettings.widgets[e.id]; delete ntSettings.widgetOpen[e.id]; delete ntSettings.widgetPositions[e.id]; if (ntSettings.widgetPage) delete ntSettings.widgetPage[e.id]; });
            ntSettings.extraNotes = [];
          }
          if (id === 'todo') {
            (ntSettings.extraTodos || []).forEach(function(e) { delete ntSettings.widgets[e.id]; delete ntSettings.widgetOpen[e.id]; delete ntSettings.widgetPositions[e.id]; if (ntSettings.widgetPage) delete ntSettings.widgetPage[e.id]; });
            ntSettings.extraTodos = [];
          }
        }
        ntSettings.widgets[id] = false;
        ntSettings.widgetOpen[id] = false;
        delete ntSettings.widgetPositions[id];
        if (ntSettings.widgetPage) delete ntSettings.widgetPage[id];
        saveSettings();
        // Remove widget from DOM
        var wEl = document.getElementById('widget-' + id);
        if (wEl) wEl.remove();
        // Uncheck in settings
        var chk = document.getElementById('chk-' + id);
        if (chk) chk.checked = false;
        renderWidgetDock();
        btn.textContent = 'Cleared ✓';
        btn.style.color = 'var(--accent)';
        setTimeout(function() { btn.textContent = 'Clear'; btn.style.color = ''; }, 2000);
      });
      row.appendChild(lbl); row.appendChild(btn);
      container.appendChild(row);
    });
  })();

  function renderRawList() {
    list.innerHTML = '';
    // Collect all localStorage keys, sorted
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.sort();
    if (!keys.length) {
      list.innerHTML = '<div style="font-size:0.72rem;color:var(--text2);padding:8px 0;">No saved settings found.</div>';
      return;
    }
    keys.forEach(function(key) {
      var rawVal = localStorage.getItem(key);
      var row = document.createElement('div');
      row.style.cssText = 'margin-bottom:8px;background:var(--glass);border:1px solid var(--glass-border);border-radius:8px;padding:8px 10px;';

      // Key label + delete button
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:8px;';
      var keyLabel = document.createElement('span');
      keyLabel.style.cssText = 'font-size:0.68rem;font-weight:600;color:var(--accent);font-family:var(--font-mono);word-break:break-all;flex:1;';
      keyLabel.textContent = key;
      var delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = 'Delete this key';
      delBtn.style.cssText = 'background:none;border:none;color:var(--text2);cursor:pointer;font-size:0.8rem;padding:2px 5px;border-radius:4px;flex-shrink:0;transition:color 0.12s;';
      delBtn.addEventListener('mouseover', function() { delBtn.style.color = '#e53e3e'; });
      delBtn.addEventListener('mouseout',  function() { delBtn.style.color = ''; });
      delBtn.addEventListener('click', function() {
        if (!confirm('Delete "' + key + '"?')) return;
        localStorage.removeItem(key);
        renderRawList();
        // If it was nt_settings, reload
        if (key === 'nt_settings') location.reload();
      });
      header.appendChild(keyLabel);
      header.appendChild(delBtn);

      // Value textarea
      var ta = document.createElement('textarea');
      ta.value = rawVal;
      ta.spellcheck = false;
      ta.style.cssText = 'width:100%;box-sizing:border-box;min-height:56px;max-height:180px;background:transparent;border:1px solid var(--glass-border);border-radius:5px;color:var(--text);font-family:var(--font-mono);font-size:0.65rem;padding:5px 7px;outline:none;resize:vertical;overflow:auto;line-height:1.4;';
      ta.addEventListener('focus', function() { ta.style.borderColor = 'var(--accent)'; });
      ta.addEventListener('blur',  function() { ta.style.borderColor = ''; });

      // Save button
      var saveRow = document.createElement('div');
      saveRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:5px;gap:6px;align-items:center;';
      var statusSpan = document.createElement('span');
      statusSpan.style.cssText = 'font-size:0.65rem;color:var(--accent);opacity:0;transition:opacity 0.3s;';
      statusSpan.textContent = 'Saved ✓';
      var saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText = 'background:var(--accent);border:none;color:#fff;font-family:var(--font);font-size:0.68rem;padding:3px 10px;border-radius:5px;cursor:pointer;';
      saveBtn.addEventListener('click', function() {
        try {
          // Validate JSON if it looks like JSON
          var v = ta.value;
          if (v.trim().startsWith('{') || v.trim().startsWith('[')) JSON.parse(v);
          localStorage.setItem(key, v);
          statusSpan.style.opacity = '1';
          setTimeout(function() { statusSpan.style.opacity = '0'; }, 1600);
          // Reload settings into memory if nt_settings changed
          if (key === 'nt_settings') {
            try {
              var parsed = JSON.parse(v);
              Object.assign(ntSettings, parsed);
            } catch {}
          }
        } catch(e) {
          alert('Invalid JSON:\n' + e.message);
        }
      });
      saveRow.appendChild(statusSpan);
      saveRow.appendChild(saveBtn);
      row.appendChild(header);
      row.appendChild(ta);
      row.appendChild(saveRow);
      list.appendChild(row);
    });
  }

  var open = false;
  toggleBtn.addEventListener('click', function() {
    open = !open;
    body.style.display = open ? '' : 'none';
    toggleBtn.textContent = open ? 'Hide ▴' : 'Show ▾';
    if (open) renderRawList();
  });
})();
console.log('checkpoint 17');
// ════════════════════════════════════════════ DEV MODE
function applyDevMode() {
  const on = !!ntSettings.devMode;
  const group = document.getElementById('raw-settings-group');
  if (group) group.style.display = on ? '' : 'none';
  const tog = document.getElementById('toggle-dev-mode');
  if (tog) tog.checked = on;
}
(function() {
  const tog = document.getElementById('toggle-dev-mode');
  if (tog) tog.addEventListener('change', function(e) {
    ntSettings.devMode = e.target.checked;
    saveSettings();
    applyDevMode();
  });
  applyDevMode();
})();

// ════════════════════════════════════════════ WIDGET FADE + DOCK TOGGLE
function applyWidgetFade() {
  document.body.classList.toggle('widget-fade-on', !!ntSettings.widgetFade);
  document.body.classList.toggle('widget-fade-p2-on', !!ntSettings.widgetFadeP2);
  const tog = document.getElementById('toggle-widget-fade');
  if (tog) tog.checked = !!ntSettings.widgetFade;
  const togP2 = document.getElementById('toggle-widget-fade-p2');
  if (togP2) togP2.checked = !!ntSettings.widgetFadeP2;
}


document.getElementById('toggle-widget-fade').addEventListener('change', e => {
  ntSettings.widgetFade = e.target.checked; applyWidgetFade(); saveSettings();
});
(function() {
  const togP2 = document.getElementById('toggle-widget-fade-p2');
  if (togP2) togP2.addEventListener('change', e => {
    ntSettings.widgetFadeP2 = e.target.checked; applyWidgetFade(); saveSettings();
  });
})();
document.getElementById('toggle-widget-dock').addEventListener('change', e => {
  ntSettings.showWidgetDock = e.target.checked; applyWidgetDockVisibility(); renderWidgetDock(); saveSettings();
});
applyWidgetFade();
applyWidgetDockVisibility();
document.getElementById('toggle-clock').addEventListener('change', e => { ntSettings.showClock = e.target.checked; applyClockVisibility(); saveSettings(); });
document.getElementById('toggle-date').addEventListener('change', e => { ntSettings.showDate = e.target.checked; applyClockVisibility(); saveSettings(); });
applyClockVisibility(); 

// ════════════════════════════════════════════ SANITIZER
function sanitizeText(str) {
  if (!str) return '';
  str = str.replace(/<script[\s\S]*?<\/script>/gi, '');
  str = str.replace(/<style[\s\S]*?<\/style>/gi, '');
  str = str.replace(/<[^>]+>/g, '');
  const el = document.createElement('textarea');
  el.innerHTML = str;
  str = el.value;
  return str.replace(/\s+/g, ' ').trim();
}

async function fetchMerriamWordOfDay() {
  const todayKey = new Date().toISOString().slice(0, 10);

  try {
    const rssUrl = 'https://www.merriam-webster.com/wotd/feed/rss2';
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const json = await res.json();
    if (json.status !== 'ok' || !json.items?.length) throw new Error('Bad response');

    const item = json.items[0];
    const word = sanitizeText(item.title || '').trim();

    // Parse HTML description
    const parser = new DOMParser();
    const descDoc = parser.parseFromString(item.description || '', 'text/html');
    const allP = Array.from(descDoc.querySelectorAll('p'));

    let def = '';
    let pos = '';
    let ex = '';

    // The definition is in the second <p> (index 1)
    if (allP[1]) {
      def = sanitizeText(allP[1].textContent).trim().slice(0, 400);

      // Try to get part of speech from <em> inside that paragraph
      const em = allP[1].querySelector('em');
      if (em) pos = sanitizeText(em.textContent).trim();
    }

    // The example is in the third <p> (index 2)
    if (allP[2]) {
      ex = sanitizeText(allP[2].textContent).trim().replace(/^\/\/\s*/, '').slice(0, 300);
    }

    const data = { date: todayKey, word, pos, def, ex };
    renderMerriamWord(data);

  } catch (e) {
    console.error('[WOTD] error:', e);
    const wEl = document.getElementById('merriam-word');
    const dEl = document.getElementById('merriam-def');
    if (wEl) wEl.textContent = 'Word of the Day';
    if (dEl) dEl.textContent = 'Could not load. Visit merriam-webster.com';
  }
}

function renderMerriamWord(data) {
  const wordEl = document.getElementById('merriam-word');
  const posEl = document.getElementById('merriam-pos');
  const defEl = document.getElementById('merriam-def');
  const exEl = document.getElementById('merriam-example');
  if (wordEl) wordEl.textContent = data.word || '';
  if (posEl) posEl.textContent = data.pos || '';
  if (defEl) defEl.textContent = data.def || '';
  if (exEl) exEl.textContent = data.ex || '';
}



const WIDGET_DOCK_META = {
  weather:      { icon: '🌤', label: 'Weather' },
  timer:        { icon: '⏱', label: 'Timer' },
  notes:        { icon: '📝', label: 'Notes' },
  currency:     { icon: '💱', label: 'Currency' },
  quotes:       { icon: '💬', label: 'Quotes' },
  learn:        { icon: '🔤', label: 'Learn Language' },
  merriam:      { icon: '📖', label: 'Word of the Day' },
  quicklinks:   { icon: '🔗', label: 'Quick Links' },
  todo:         { icon: '✅', label: 'To-Do' },
  calendar:     { icon: '📅', label: 'Calendar' },
  crypto:       { icon: '₿',  label: 'Crypto' },
};

// ════════════════════════════════════════════ WIDGET DOCK
function applyWidgetDockVisibility() {
  const dock = document.getElementById('widget-dock');
  if (!dock) return;
  const show = ntSettings.showWidgetDock !== false;
  dock.style.display = show ? '' : 'none';
  const tog = document.getElementById('toggle-widget-dock');
  if (tog) tog.checked = show;
}

function renderWidgetDock() {
  const dock = document.getElementById('widget-dock');
  if (!dock) return;

  if (ntSettings.showWidgetDock === false) {
    dock.style.display = 'none';
    return;
  }
  dock.style.display = '';

  // If dock already built, just refresh toggle states in-place (preserves open state)
  const existingPanel = document.getElementById('dock-panel');
  if (existingPanel) {
    const ALL_DOCK = ['weather','timer','notes','currency','quotes','learn','merriam','quicklinks','todo','calendar','crypto'];
    ALL_DOCK.forEach(id => {
      const toggle = existingPanel.querySelector('[data-dock-id="' + id + '"] .dock-widget-toggle');
      if (toggle) toggle.className = 'dock-widget-toggle' + (ntSettings.widgets[id] ? ' on' : '');
    });
    return;
  }

  // First render — build the dock structure
  dock.innerHTML = '';

  const panel = document.createElement('div');
  panel.id = 'dock-panel';

  const ALL_DOCK = ['weather','timer','notes','currency','quotes','learn','merriam','quicklinks','todo','calendar','crypto'];
  ALL_DOCK.forEach(id => {
    const meta = WIDGET_DOCK_META[id];
    if (!meta) return;
    const row = document.createElement('div');
    row.className = 'dock-widget-row';
    row.dataset.dockId = id;

    const icon = document.createElement('span');
    icon.className = 'dock-widget-icon';
    icon.textContent = meta.icon;

    const label = document.createElement('span');
    label.className = 'dock-widget-label';
    label.textContent = meta.label;

    const toggle = document.createElement('div');
    toggle.className = 'dock-widget-toggle' + (ntSettings.widgets[id] ? ' on' : '');

    row.addEventListener('click', async () => {
      const nowOn = !ntSettings.widgets[id];
      if (nowOn) {
        const w = document.getElementById('widget-' + id);
        if (w) {
          makeDraggable(w);
          const savedPage = (ntSettings.widgetPage || {})[id];
          if (savedPage === 1) assignWidgetPage(id, w);
          else { const p1 = document.getElementById('page-main'); if (p1 && w.parentElement !== p1) p1.appendChild(w); }
        }
      }
      const chk = document.getElementById('chk-' + id);
      if (chk) chk.checked = nowOn;
      toggleWidget(id, nowOn);
      if (id === 'learn') {
        const lrow = document.getElementById('word-lang-row');
        if (lrow) lrow.style.display = nowOn ? '' : 'none';
      }
      // Update toggle in-place — DO NOT call renderWidgetDock() which would close the panel
      toggle.className = 'dock-widget-toggle' + (ntSettings.widgets[id] ? ' on' : '');
    });

    row.appendChild(icon); row.appendChild(label); row.appendChild(toggle);
    panel.appendChild(row);
  });

  const trigger = document.createElement('div');
  trigger.id = 'dock-trigger';
  trigger.title = 'Widgets';
  trigger.innerHTML = '⊞';

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = panel.classList.toggle('dock-panel-open');
    trigger.classList.toggle('dock-open', isOpen);
  });

  document.addEventListener('click', function(e) {
    if (!dock.contains(e.target)) {
      panel.classList.remove('dock-panel-open');
      trigger.classList.remove('dock-open');
    }
  });

  dock.appendChild(panel);
  dock.appendChild(trigger);
}

/** Return the widget element + all extra instances for a given base id */
function _getWidgetInstances(id) {
  const els = [];
  const w = document.getElementById('widget-' + id);
  if (w) els.push(w);
  if (id === 'notes') (ntSettings.extraNotes || []).forEach(e => { const el = document.getElementById('widget-' + e.id); if (el) els.push(el); });
  if (id === 'todo')  (ntSettings.extraTodos  || []).forEach(e => { const el = document.getElementById('widget-' + e.id); if (el) els.push(el); });
  if (id === 'quicklinks') (ntSettings.extraQuicklinks || []).forEach(e => { const el = document.getElementById('widget-' + e.id); if (el) els.push(el); });
  return els;
}
console.log('checkpoint 18');
// ════════════════════════════════════════════ WIDGETS
const ALL_WIDGETS = ['weather','timer','notes','currency','quotes','learn','merriam','quicklinks','todo','calendar','crypto','clockwidget'];

// Enable/disable widget (checkbox toggle)
function toggleWidget(id, show) {
  ntSettings.widgets[id] = show;
  if (!show) {
    const w = document.getElementById('widget-' + id);
    if (w) w.style.display = 'none';
    ntSettings.widgetOpen[id] = false;
    // Also hide all extra instances (notes/todo)
    if (id === 'notes') {
      (ntSettings.extraNotes || []).forEach(function(e) {
        var el = document.getElementById('widget-' + e.id);
        if (el) el.style.display = 'none';
        ntSettings.widgetOpen[e.id] = false;
      });
    }
    if (id === 'todo') {
      (ntSettings.extraTodos || []).forEach(function(e) {
        var el = document.getElementById('widget-' + e.id);
        if (el) el.style.display = 'none';
        ntSettings.widgetOpen[e.id] = false;
      });
    }
    if (id === 'quicklinks') {
      (ntSettings.extraQuicklinks || []).forEach(function(e) {
        var el = document.getElementById('widget-' + e.id);
        if (el) el.style.display = 'none';
        ntSettings.widgetOpen[e.id] = false;
      });
    }
  } else {
    // enabling: restore to open state
    ntSettings.widgetOpen[id] = true;
    const w = document.getElementById('widget-' + id);
    if (w) {
      const savedPage = (ntSettings.widgetPage || {})[id];
      if (savedPage !== 1) {
        const page1 = document.getElementById('page-main');
        if (page1 && w.parentElement !== page1) page1.appendChild(w);
        if (savedPage === undefined) delete (ntSettings.widgetPage || {})[id];
      }
      w.style.display = 'block';
      restoreWidgetPos(id);
    }
    // Show extra instances — or if none exist at all, spawn a fresh one
    if (id === 'notes') {
      var hasAny = (ntSettings.extraNotes || []).length > 0 || !!document.getElementById('widget-notes');
      if (!hasAny) {
        addNotesInstance('Notes');
      } else {
        (ntSettings.extraNotes || []).forEach(function(e) {
          var el = document.getElementById('widget-' + e.id);
          if (el) { el.style.display = 'block'; ntSettings.widgetOpen[e.id] = true; restoreWidgetPos(e.id); }
        });
      }
    }
    if (id === 'todo') {
      var hasTodo = (ntSettings.extraTodos || []).length > 0 || !!document.getElementById('widget-todo');
      if (!hasTodo) {
        addTodoInstance('To-Do');
      } else {
        (ntSettings.extraTodos || []).forEach(function(e) {
          var el = document.getElementById('widget-' + e.id);
          if (el) { el.style.display = 'block'; ntSettings.widgetOpen[e.id] = true; restoreWidgetPos(e.id); }
        });
      }
    }
    if (id === 'quicklinks') {
      var hasQL = (ntSettings.extraQuicklinks || []).length > 0 || !!document.getElementById('widget-quicklinks');
      if (!hasQL) {
        addQuicklinksInstance();
      } else {
        (ntSettings.extraQuicklinks || []).forEach(function(e) {
          var el = document.getElementById('widget-' + e.id);
          if (el) { el.style.display = 'block'; ntSettings.widgetOpen[e.id] = true; restoreWidgetPos(e.id); }
        });
      }
    }
  }
  saveSettings();
  renderWidgetDock();
}

function bringWidgetToFront(widget) {
  document.querySelectorAll('.widget').forEach(w => w.classList.remove('widget-focused'));
  widget.classList.add('widget-focused');
}


// ── Notes widget: bottom drag-to-resize handle ───────────────────────────────
(function initNotesResize() {
  var _rActive = false, _rWidget = null, _rStartY = 0, _rStartH = 0;
  var NOTES_H_KEY = 'nt_notes_heights';



document.addEventListener('mouseup', function(e) {
  var widget = e.target.closest('.widget-resizable');
  
  if (widget) {
    setTimeout(function() {
      var map = LS.get(NOTES_H_KEY, {});
      map[widget.id] = {
        height: widget.offsetHeight,
        width: widget.offsetWidth
      };
      LS.set(NOTES_H_KEY, map);
    }, 60);
  }
});

window.restoreNotesHeights = function() {
  var map = LS.get(NOTES_H_KEY, {});
  
  Object.keys(map).forEach(function(id) {
    var w = document.getElementById(id);
    if (!w || !w.classList.contains('widget-resizablet')) return;

    var saved = map[id];

    if (typeof saved === 'number') {
      w.style.height = saved + 'px';
    } else {
      if (saved.height) w.style.height = saved.height + 'px';
      if (saved.width) w.style.width = saved.width + 'px';
    }
  });
};


})();
var NOTES_H_KEY = 'nt_notes_heights';
function _restoreWidgetSize(el) {
   var map = LS.get(NOTES_H_KEY, {});
  
  Object.keys(map).forEach(function(id) {
    var w = document.getElementById(id);
    if (!w || !w.classList.contains('widget')) return;

    var saved = map[id];

    if (typeof saved === 'number') {
      w.style.height = saved + 'px';
    } else {
      if (saved.height) w.style.height = saved.height + 'px';
      if (saved.width) w.style.width = saved.width + 'px';
    }
  });
}
function makeDraggable(widget) {
  const header = widget.querySelector('.widget-header');
  if (!header) return;
  let dragging = false, ox = 0, oy = 0;
  widget.addEventListener('mousedown', () => bringWidgetToFront(widget));
  header.addEventListener('mousedown', e => {
    dragging = true;
    const r = widget.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    widget.style.transition = 'none';
    widget.style.bottom = 'auto'; widget.style.right = 'auto';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    // Use page-relative coordinates: widget is position:absolute inside its page
    const page = widget.closest('.page') || document.getElementById('page-main');
    const pr   = page ? page.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const x = Math.max(0, Math.min(pr.width  - widget.offsetWidth,  e.clientX - pr.left - ox));
    const y = Math.max(0, Math.min(pr.height - widget.offsetHeight, e.clientY - pr.top  - oy));
    widget.style.left = x + 'px'; widget.style.top = y + 'px';
    const id = widget.id.replace('widget-', '');
    ntSettings.widgetPositions[id] = { xFrac: x / pr.width, yFrac: y / pr.height };
    saveSettings();
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function restoreWidgetPos(id) {
  const pos = ntSettings.widgetPositions[id];
  const w   = document.getElementById('widget-' + id);
  if (!pos || !w) return;
  const page = w.closest('.page') || document.getElementById('page-main');
  const pw   = page ? page.offsetWidth  : window.innerWidth;
  const ph   = page ? page.offsetHeight : window.innerHeight;
  const x = pos.xFrac != null ? Math.round(pos.xFrac * pw) : (pos.left || 0);
  const y = pos.yFrac != null ? Math.round(pos.yFrac * ph) : (pos.top  || 0);
  const cx = Math.max(0, Math.min(pw - w.offsetWidth,  x));
  const cy = Math.max(0, Math.min(ph - w.offsetHeight, y));
  w.style.left = cx + 'px'; w.style.top = cy + 'px';
  w.style.bottom = 'auto'; w.style.right = 'auto';
}


// ════════════════════════════════════════════ CLOCK FONT
const clockFontSel = document.getElementById('clock-font-sel');
if (clockFontSel) {
  clockFontSel.value = ntSettings.clockFont || 'mono';
  clockFontSel.addEventListener('change', e => { ntSettings.clockFont = e.target.value; applyClockFont(); saveSettings(); });
}
applyClockFont();

console.log('checkpoint 19');
// ════════════════════════════════════════════ KEYBOARD
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (searchInput && ntSettings.showSearch !== false) searchInput.focus();
  }
  if (e.key === 'Escape') { closeSettings(); if (searchInput) searchInput.blur(); }
});

// ════════════════════════════════════════════ RESPONSIVE WIDGET HIDE
function rectsOverlap(a, b, margin) {
  margin = margin || 0;
  return !(a.right + margin < b.left || b.right + margin < a.left ||
           a.bottom + margin < b.top  || b.bottom + margin < a.top);
}

function repositionWidgetsOnResize() {
  // Base widgets
  ALL_WIDGETS.forEach(id => {
    const w = document.getElementById('widget-' + id);
    if (!w) return;
    if (!ntSettings.widgets[id] || ntSettings.widgetOpen[id] === false) return;
    restoreWidgetPos(id);
  });
  // Extra notes/todo instances
  (ntSettings.extraNotes || []).forEach(function(e) {
    if (ntSettings.widgets[e.id] && ntSettings.widgetOpen[e.id] !== false) restoreWidgetPos(e.id);
  });
  (ntSettings.extraTodos || []).forEach(function(e) {
    if (ntSettings.widgets[e.id] && ntSettings.widgetOpen[e.id] !== false) restoreWidgetPos(e.id);
  });
  (ntSettings.extraQuicklinks || []).forEach(function(e) {
    if (ntSettings.widgets[e.id] && ntSettings.widgetOpen[e.id] !== false) restoreWidgetPos(e.id);
  });
}

// Track which widgets were hidden by collision (not by user intent)
const collisionHidden = new Set();

function checkWidgetVisibility() {
  const protectedIds = ['clock-block', 'search-block', 'search-wrap', 'topsites-block'];
  const protectedRects = protectedIds
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .map(el => el.getBoundingClientRect());

  // Build full list: base widgets + all extra instances
  const allInstances = [];
  ALL_WIDGETS.forEach(id => {
    allInstances.push({ id, el: document.getElementById('widget-' + id), isExtra: false });
  });
  (ntSettings.extraNotes || []).forEach(function(e) {
    allInstances.push({ id: e.id, el: document.getElementById('widget-' + e.id), isExtra: true });
  });
  (ntSettings.extraTodos || []).forEach(function(e) {
    allInstances.push({ id: e.id, el: document.getElementById('widget-' + e.id), isExtra: true });
  });
  (ntSettings.extraQuicklinks || []).forEach(function(e) {
    allInstances.push({ id: e.id, el: document.getElementById('widget-' + e.id), isExtra: true });
  });

  allInstances.forEach(function(inst) {
    const id = inst.id;
    const w  = inst.el;
    if (!w) return;
    const isEnabled = !!ntSettings.widgets[id];
    const isOpen    = ntSettings.widgetOpen[id] !== false;

    if (!isEnabled || !isOpen) {
      collisionHidden.delete(id);
      w.style.display = 'none';
      return;
    }

    // Widgets on page 2 never collide with page-1 elements
    if ((ntSettings.widgetPage || {})[id] === 1) {
      w.style.display = 'block'; w.style.visibility = '';
      collisionHidden.delete(id);
      return;
    }

    restoreWidgetPos(id);

    w.style.visibility = 'hidden';
    w.style.display = 'block';
    const wRect = w.getBoundingClientRect();

    const collides = protectedRects.some(pr => rectsOverlap(wRect, pr, 16));

    if (collides) {
      w.style.display = 'none';
      w.style.visibility = '';
      collisionHidden.add(id);
    } else {
      w.style.display = 'block';
      w.style.visibility = '';
      collisionHidden.delete(id);
    }
  });

  const dock = document.getElementById('widget-dock');
  if (dock) {
    const show = ntSettings.showWidgetDock !== false;
    if (!show) { dock.style.display = 'none'; return; }
    dock.style.display = '';
    const dr = dock.getBoundingClientRect();
    const dockCollides = protectedRects.some(pr => rectsOverlap(dr, pr, 16));
    dock.style.display = dockCollides ? 'none' : '';
  }
}
window.addEventListener('resize', () => {
  repositionWidgetsOnResize();
  checkWidgetVisibility();
});

// ════════════════════════════════════════════ STARTUP
// Save screen resolution + settings mirror to chrome.storage.local so the
// background service worker can pre-fetch wallpapers at the correct size
// and know whether random wallpaper is enabled.
csSet('nt_screen', { w: window.screen.width || 1920, h: window.screen.height || 1080 });
csSet('nt_settings', { randomWallpaper: ntSettings.randomWallpaper });

updateClock();
(function scheduleClockUpdate() {
  const now = new Date();
  const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(() => { updateClock(); setInterval(updateClock, 60000); }, ms);
})();

applyGrain();
applyClockTop();
triggerClockAnimation();
if (ntSettings.randomWallpaper) applyRandomWallpaper();
console.log('checkpoint 20');
// ════════════════════════════════════════════ WEATHER — Open-Meteo
// widgets/weather.js uses its OWN local fetchWeather that calls wttr.in directly.
// We can't override that local variable. Instead, intercept window.fetch globally:
// any request to wttr.in gets silently redirected to Open-Meteo and the response
// is shaped to match the j1 JSON format that widgets/weather.js expects.
(async function interceptWttrFetch() {
  const _origFetch = window.fetch.bind(window);

  function _wmoToWttrCode(wmo) {
    const w = parseInt(wmo);
    if (w === 0) return 113; if (w <= 2) return 116; if (w === 3) return 119;
    if (w <= 48) return 143; if (w <= 55) return 266; if (w <= 57) return 281;
    if (w <= 63) return 296; if (w === 65) return 308; if (w <= 67) return 311;
    if (w <= 73) return 323; if (w === 75) return 338; if (w === 77) return 350;
    if (w <= 82) return 353; if (w <= 86) return 368;
    if (w === 95) return 200; return 386;
  }
  const WMO_DESC = {
    0:'Clear',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',
    45:'Fog',48:'Icy Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',
    56:'Freezing Drizzle',57:'Heavy Freezing Drizzle',
    61:'Light Rain',63:'Moderate Rain',65:'Heavy Rain',
    66:'Light Freezing Rain',67:'Heavy Freezing Rain',
    71:'Light Snow',73:'Moderate Snow',75:'Heavy Snow',77:'Snow Grains',
    80:'Light Showers',81:'Moderate Showers',82:'Heavy Showers',
    85:'Snow Showers',86:'Heavy Snow Showers',
    95:'Thunderstorm',96:'Thunderstorm+Hail',99:'Heavy Thunderstorm'
  };

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('wttr.in')) {
      try {
        const match = url.match(/wttr\.in\/([^?]+)/);
        const rawCity = match ? decodeURIComponent(match[1]) : '';
        if (!rawCity) throw new Error('no city');
        // Take just the first part (before any comma) for geocoding
        const city = rawCity.split(',')[0].trim();

        // Geocode
        const geoRes  = await _origFetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=en&format=json');
        const geoData = await geoRes.json();
        if (!geoData.results || !geoData.results.length) throw new Error('city not found: ' + city);
        const r = geoData.results[0];

        // Fetch weather
        const wxRes  = await _origFetch('https://api.open-meteo.com/v1/forecast?latitude=' + r.latitude + '&longitude=' + r.longitude + '&current_weather=true&temperature_unit=celsius&timezone=auto');
        const wxData = await wxRes.json();
        const cw = wxData.current_weather;
        if (!cw) throw new Error('no weather');

        const tempC   = Math.round(cw.temperature);
        const tempF   = Math.round(tempC * 9/5 + 32);
        const wttrCode = _wmoToWttrCode(cw.weathercode);
        const desc    = WMO_DESC[parseInt(cw.weathercode)] || 'Clear';

        // Shape response to match wttr.in j1 format widgets/weather.js expects
        const j1 = {
          current_condition: [{
            weatherCode: String(wttrCode),
            temp_C: String(tempC),
            temp_F: String(tempF),
            weatherDesc: [{ value: desc }],
            humidity: '60',
            windspeedKmph: String(Math.round(cw.windspeed || 0))
          }],
          nearest_area: [{
            areaName:  [{ value: r.name }],
            region:    [{ value: r.admin1 || r.name }],
            country:   [{ value: r.country || '' }]
          }],
          weather: []
        };

        // Also update our own weather globals so clock-weather works
        const svgCode = wttrCode;
        window.lastWeatherData = { code: svgCode, tempC, tempF, desc };
        if (typeof window.updateClockWeatherInline === 'function') {
          setTimeout(window.updateClockWeatherInline, 200);
        }

        return new Response(JSON.stringify(j1), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) {
        // Return minimal valid j1 so widget doesn't crash
        const fallback = { current_condition:[{ weatherCode:'116', temp_C:'--', temp_F:'--', weatherDesc:[{value:'Unavailable'}], humidity:'0', windspeedKmph:'0' }], nearest_area:[{ areaName:[{value:''}], region:[{value:''}], country:[{value:''}] }], weather:[] };
        return new Response(JSON.stringify(fallback), { status: 200, headers: {'Content-Type':'application/json'} });
      }
    }
    return _origFetch(input, init);
  };
})();

// ════════════════════════════════════════════ WIDGET SCRIPTS BOOTSTRAP
// Each widget is a self-contained .js file that:
//   (a) immediately injects its own HTML via an IIFE at the bottom of the file
//   (b) exposes window.initWidget_<id>() for the logic wiring
// This bootstrap loads scripts for enabled widgets, then calls their init fns.


function postWidgetSetup() {
  // Draggable
  ALL_WIDGETS.forEach(id => { const el = document.getElementById('widget-' + id); if (el) makeDraggable(el); });
  const ignEl = document.getElementById('widget-ignorelist');
  if (ignEl) makeDraggable(ignEl);

  // Close buttons
  document.querySelectorAll('.widget-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      if (id === 'ignorelist') { const w = document.getElementById('widget-ignorelist'); if (w) w.style.display = 'none'; return; }
      const w = document.getElementById('widget-' + id);
      if (w) w.style.display = 'none';
      ntSettings.widgetOpen[id] = false; saveSettings(); renderWidgetDock();
    });
  });

  // Transparent toggle — use event delegation so dynamically injected buttons also work
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.widget-transparent-btn');
    if (!btn) return;
    e.stopPropagation();
    const targetId = btn.dataset.target;
    const w = targetId ? document.getElementById(targetId) : btn.closest('.widget');
    if (!w) return;
    const id = w.id.replace('widget-', '');
    const on = w.classList.toggle('widget-transparent');
    if (!ntSettings.widgetTransparent) ntSettings.widgetTransparent = {};
    ntSettings.widgetTransparent[id] = on;
    saveSettings();
  });

  // Restore saved transparent state — extended to notes, todo, weather, crypto, calendar, quicklinks
  ['quotes','learn','merriam','notes','todo','weather','crypto','calendar','clockwidget','quicklinks'].forEach(id => {
    const w = document.getElementById('widget-' + id);
    if (w) w.classList.toggle('widget-transparent', !!(ntSettings.widgetTransparent||{})[id]);
  });

  // Add transparent-btn to widgets that support it but don't have it in their own HTML
  ['notes','todo','weather','crypto','calendar'].forEach(id => {
    const w = document.getElementById('widget-' + id);
    if (!w) return;
    const hdr = w.querySelector('.widget-header');
    if (!hdr || hdr.querySelector('.widget-transparent-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'widget-transparent-btn';
    btn.dataset.target = 'widget-' + id;
    btn.title = 'Toggle transparent';
    btn.textContent = '•';
    hdr.insertBefore(btn, hdr.querySelector('.widget-close'));
  });

  // Settings checkboxes — wire with on-demand loading
  ALL_WIDGETS.forEach(id => {
    const chk = document.getElementById('chk-' + id);
    if (!chk) return;
    chk.checked = !!ntSettings.widgets[id];
    chk.addEventListener('change', async e => {
      if (e.target.checked) {
        const w = document.getElementById('widget-' + id);
        if (w) {
          makeDraggable(w);
          // New widgets always start on page-main unless previously assigned to p2
          const savedPage = (ntSettings.widgetPage || {})[id];
          if (savedPage === 1) {
            assignWidgetPage(id, w);
          } else {
            const page1 = document.getElementById('page-main');
            if (page1 && w.parentElement !== page1) page1.appendChild(w);
          }
        }
      }
      toggleWidget(id, e.target.checked);
      if (id === 'learn') {
        const row = document.getElementById('word-lang-row');
        if (row) row.style.display = e.target.checked ? '' : 'none';
      }
    });

      // Initial visibility + position
      const w = document.getElementById('widget-' + id);
      if (w) {
      const show = !!ntSettings.widgets[id] && ntSettings.widgetOpen[id] !== false;
      if (show) {
      w.style.display = 'block';
      if (id !== 'todo') w.style.opacity = '0';
      restoreWidgetPos(id);
      assignWidgetPage(id, w);
      const anim = ntSettings.widgetAnimation || 'fade-up';
      const isPage2 = (ntSettings.widgetPage || {})[id] === 1;
      const skipAnim = ntSettings.widgetFade && !isPage2;
      const animClass = anim === 'fade' ? 'widget-entering-fade' : anim === 'scale' ? 'widget-entering-scale' : 'widget-entering-fade-up';

        function revealWidget() {
          if (id === 'todo') { w.style.removeProperty('opacity'); return; }
          if (anim !== 'none' && !skipAnim) {
            const delay = Math.min(ALL_WIDGETS.indexOf(id) * 15, 100);
            setTimeout(function() {
              w.classList.add(animClass);
              w.style.removeProperty('opacity');
              w.addEventListener('animationend', function() {
                w.classList.remove(animClass);
              }, { once: true });
            }, delay);
          } else {
            w.style.removeProperty('opacity');
          }
        }

        // If restoring to page 2 and this widget is on page 1, wait for the
        // page scroll to complete before revealing — prevents the flash
        const willRestoreToPage2 = ntSettings.rememberPage && ntSettings.lastPage === 1 && ntSettings.enablePage2 !== false;
        if (willRestoreToPage2 && !isPage2) {
          // Hold opacity:0 until scroll is done, then reveal without animation
          requestAnimationFrame(() => {
            w.style.removeProperty('opacity'); // just show it, no animation needed (it's offscreen)
          });
        } else {
          revealWidget();
        }
      } else {
        w.style.display = 'none';
        w.style.removeProperty('opacity');
      }
    }
  });
console.log('checkpoint 21');
  // toggle-page2
  var togP2 = document.getElementById("toggle-page2");
  if (togP2) {
    togP2.checked = ntSettings.enablePage2 !== false;
    togP2.addEventListener("change", function(e) {
      ntSettings.enablePage2 = e.target.checked; saveSettings();
      if (typeof window.applyPage2Enabled === "function") window.applyPage2Enabled();
    });
  }
  // toggle-remember-page
  var togRP = document.getElementById("toggle-remember-page");
  if (togRP) {
    togRP.checked = !!ntSettings.rememberPage;
    togRP.addEventListener("change", function(e) {
      ntSettings.rememberPage = e.target.checked;
      if (!ntSettings.rememberPage) { ntSettings.lastPage = 0; }
      saveSettings();
    });
  }

  // word-lang-row visibility (settings panel row)
  const wordLangRow = document.getElementById('word-lang-row');
  if (wordLangRow) wordLangRow.style.display = ntSettings.widgets.learn ? '' : 'none';

  // settings-weather-city input (in settings panel, not inside weather widget)
  const settingsWeatherCity = document.getElementById('settings-weather-city');
  if (settingsWeatherCity) {
    settingsWeatherCity.value = ntSettings.weatherCity || '';
    let wcTimer;
    settingsWeatherCity.addEventListener('input', e => {
      clearTimeout(wcTimer);
      wcTimer = setTimeout(() => {
        const city = e.target.value.trim();
        if (!city) return;
        ntSettings.weatherCity = city; saveSettings();
        if (typeof window.fetchWeather === 'function') window.fetchWeather(city);
        const wci = document.getElementById('weather-city');
        if (wci) wci.value = city;
      }, 600);
    });
  }

  // toggle-clock-weather (settings panel toggle)
  const togCW = document.getElementById('toggle-clock-weather');
  if (togCW) {
    togCW.checked = !!ntSettings.showClockWeather;
    togCW.addEventListener('change', e => {
      ntSettings.showClockWeather = e.target.checked; saveSettings();
      if (typeof window.updateClockWeatherInline === 'function') window.updateClockWeatherInline();
      if (ntSettings.showClockWeather && !window.lastWeatherData) {
        const city = ntSettings.weatherCity;
        if (city && typeof window.fetchWeatherForClock === 'function') window.fetchWeatherForClock(city);
      }
    });
  }

  checkWidgetVisibility();
  renderWidgetDock();
  if (typeof window.restoreNotesHeights === 'function') window.restoreNotesHeights();

  // Patch base #widget-notes header: add + button to spawn a new notes instance
  (function patchNotesHeader() {
    var notesW = document.getElementById('widget-notes');
    if (!notesW) return;
    var hdr = notesW.querySelector('.widget-header');
    if (!hdr || hdr.querySelector('.notes-header-add')) return;
    var btn = document.createElement('button');
    btn.className = 'notes-header-add'; btn.title = 'Add new note'; btn.textContent = '+';
    btn.addEventListener('click', function(e) { e.stopPropagation(); addNotesInstance('Notes'); });
    var closeBtn = hdr.querySelector('.widget-close');
    if (closeBtn) hdr.insertBefore(btn, closeBtn); else hdr.appendChild(btn);
  })();

  // Wire saving for the base #widget-notes textarea (id="notes-area")
  // Uses the same key system as extra instances: nt_notes_notes
  (function initBaseNotesWidget() {
    var ta = document.getElementById('notes-area');
    if (!ta || ta._saveWired) return;
    ta._saveWired = true;
    var NOTES_BASE_KEY = 'nt_notes_notes';
    // Load saved content
    var saved = LS.get(NOTES_BASE_KEY, '');
    ta.value = saved;
    var countEl = document.getElementById('notes-char-count');
    if (countEl) countEl.textContent = saved.length + ' chars';
    // Wire autosave
    var savedInd = document.getElementById('notes-saved');
    var saveTimer;
    ta.addEventListener('input', function() {
      if (countEl) countEl.textContent = ta.value.length + ' chars';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function() {
        LS.set(NOTES_BASE_KEY, ta.value);
        if (savedInd) { savedInd.style.opacity = '1'; setTimeout(function() { savedInd.style.opacity = '0'; }, 1400); }
      }, 600);
    });
  })();

  // Patch base #widget-todo footer: add "Add new" + "Clear done" buttons row, and make widget-title double-click rename
  (function patchTodoFooter() {
    var todoW = document.getElementById('widget-todo');
    if (!todoW) return;
    // Double-click title rename for base widget
    var titleEl = todoW.querySelector('.widget-title');
    if (titleEl && !titleEl._renamePatched) {
      titleEl._renamePatched = true;
      titleEl.title = 'Double-click to rename';
      titleEl.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        var current = titleEl.textContent.trim();
        var input = document.createElement('input');
        input.type = 'text'; input.value = current;
        input.style.cssText = 'background:transparent;border:none;border-bottom:1px solid var(--accent);color:var(--text);font-family:var(--font);font-size:0.72rem;font-weight:600;letter-spacing:0.06em;outline:none;width:100%;text-transform:uppercase;';
        titleEl.replaceWith(input); input.focus(); input.select();
        function commit() {
          var newTitle = input.value.trim() || current;
          titleEl.textContent = newTitle;
          input.replaceWith(titleEl);
        }
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); } if (ev.key === 'Escape') { input.value = current; input.blur(); } });
      });
    }
    // Add "Add new" button — find or create the footer btns row
    var footer = todoW.querySelector('.todo-footer');
    if (!footer) {
      footer = document.createElement('div');
      footer.className = 'todo-footer';
      todoW.appendChild(footer);
    }
    // Only add if "Add new" button not already present
    if (!todoW.querySelector('.todo-new-widget-btn')) {
      var btnsRow = todoW.querySelector('.todo-footer-btns');
      if (!btnsRow) {
        btnsRow = document.createElement('div');
        btnsRow.className = 'todo-footer-btns';
        footer.appendChild(btnsRow);
      }
      var newBtn = document.createElement('button');
      newBtn.className = 'todo-new-widget-btn'; newBtn.textContent = '+ Add new';
      newBtn.addEventListener('click', function(e) { e.stopPropagation(); addTodoInstance('To-Do'); });
      // Insert at start so it stays on left
      btnsRow.insertBefore(newBtn, btnsRow.firstChild);
      // Also ensure clear done exists on right if not already there
      if (!btnsRow.querySelector('.todo-clear-btn')) {
        var clearBtn = document.createElement('button');
        clearBtn.className = 'todo-clear-btn'; clearBtn.textContent = 'Clear done';
        var existingClear = todoW.querySelector('[id^="todo-clear-done"]');
        if (existingClear) clearBtn.addEventListener('click', function() { existingClear.click(); });
        btnsRow.appendChild(clearBtn);
      }
    }
  })();
}
postWidgetSetup();
console.log('checkpoint 22');

// ════════════════════════════════════════════ WEATHER WIDGET INIT
// Provides window.fetchWeather used by both the weather widget and the
// settings-weather-city input.  Talks to the wttr.in intercept already wired
// above (interceptWttrFetch), so no external dependency needed.
(function initWeatherWidget() {
  var WMO_ICON = {
    113:'☀️', 116:'⛅', 119:'☁️', 122:'☁️', 143:'🌫️', 176:'🌦️',
    179:'🌨️', 182:'🌧️', 185:'🌧️', 200:'⛈️', 227:'❄️', 230:'❄️',
    248:'🌫️', 260:'🌫️', 263:'🌦️', 266:'🌦️', 281:'🌧️', 284:'🌧️',
    293:'🌧️', 296:'🌧️', 299:'🌧️', 302:'🌧️', 305:'🌧️', 308:'🌧️',
    311:'🌧️', 314:'🌧️', 317:'🌧️', 320:'🌨️', 323:'🌨️', 326:'🌨️',
    329:'❄️', 332:'❄️', 335:'❄️', 338:'❄️', 350:'🌨️', 353:'🌦️',
    356:'🌧️', 359:'🌧️', 362:'🌨️', 365:'🌨️', 368:'🌨️', 371:'❄️',
    374:'🌨️', 377:'🌨️', 386:'⛈️', 389:'⛈️', 392:'⛈️', 395:'❄️',
  };

  function _icon(code) { return WMO_ICON[parseInt(code)] || '🌡️'; }
  function _useF() { return ntSettings.weatherUnit === 'f'; }

  function _applyUnitButtons() {
    var btnC = document.getElementById('weather-unit-c');
    var btnF = document.getElementById('weather-unit-f');
    if (btnC) btnC.classList.toggle('active', !_useF());
    if (btnF) btnF.classList.toggle('active',  _useF());
  }

  function renderWeather(data) {
    var cc = data.current_condition && data.current_condition[0];
    var area = data.nearest_area && data.nearest_area[0];
    if (!cc) return;
    var icon   = _icon(cc.weatherCode);
    var temp   = _useF() ? cc.temp_F + '°F' : cc.temp_C + '°C';
    var desc   = (cc.weatherDesc && cc.weatherDesc[0] && cc.weatherDesc[0].value) || '';
    var loc    = area ? ((area.areaName && area.areaName[0] && area.areaName[0].value) || '') : '';
    var iconEl = document.getElementById('weather-icon');
    var locEl  = document.getElementById('weather-location');
    var tmpEl  = document.getElementById('weather-temp');
    var dscEl  = document.getElementById('weather-desc');
    if (iconEl) iconEl.textContent = icon;
    if (locEl)  locEl.textContent  = loc || 'Weather';
    if (tmpEl)  tmpEl.textContent  = temp;
    if (dscEl)  dscEl.textContent  = desc;
  }

  window.fetchWeather = function(city) {
    if (!city) return;
    var url = 'https://wttr.in/' + encodeURIComponent(city) + '?format=j1';
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) { renderWeather(data); })
      .catch(function(e) {
        console.warn('[Weather] fetch failed:', e);
        var dscEl = document.getElementById('weather-desc');
        if (dscEl) dscEl.textContent = 'Could not load weather';
      });
  };

  // Wire the in-widget city input
  var cityInput = document.getElementById('weather-city');
  if (cityInput) {
    if (ntSettings.weatherCity) cityInput.value = ntSettings.weatherCity;
    var wcTimer;
    cityInput.addEventListener('input', function(e) {
      clearTimeout(wcTimer);
      wcTimer = setTimeout(function() {
        var city = e.target.value.trim();
        if (!city) return;
        ntSettings.weatherCity = city; saveSettings();
        window.fetchWeather(city);
        var settingsInput = document.getElementById('settings-weather-city');
        if (settingsInput) settingsInput.value = city;
      }, 700);
    });
    cityInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        clearTimeout(wcTimer);
        var city = cityInput.value.trim();
        if (!city) return;
        ntSettings.weatherCity = city; saveSettings();
        window.fetchWeather(city);
      }
    });
  }

  // localStorage cache key
  var WEATHER_LS_KEY = 'nt_weather_cache';
 var _origFetchWeather = window.fetchWeather;
  window.fetchWeather = function(city) {
    if (!city) return;
    _origFetchWeather(city);
  };
  // Wrap renderWeather to save to cache after each network fetch
  var _origRenderWeather = renderWeather;
  renderWeather = function(data) {
    _origRenderWeather(data);
    try {
      var cc = data.current_condition && data.current_condition[0];
      var area = data.nearest_area && data.nearest_area[0];
      if (cc) {
        var locStr = area ? ((area.areaName && area.areaName[0] && area.areaName[0].value) || '') : '';
         LS.set(WEATHER_LS_KEY, {
          city: ntSettings.weatherCity,
          locStr: locStr,
          code: cc.weatherCode,
          tempC: cc.temp_C, tempF: cc.temp_F,
          desc: (cc.weatherDesc && cc.weatherDesc[0] && cc.weatherDesc[0].value) || '',
          ts: Date.now()
        });
        window.lastWeatherData = { code: cc.weatherCode, tempC: cc.temp_C, tempF: cc.temp_F, desc: (cc.weatherDesc && cc.weatherDesc[0] && cc.weatherDesc[0].value) || '' };
      }
    } catch(e) {}
  };

  // Auto-fetch: show from cache instantly, refresh from network, repeat every 5 min
  if (ntSettings.weatherCity) {
    var wc = LS.get(WEATHER_LS_KEY, null);
    var wAge = wc ? (Date.now() - (wc.ts || 0)) : Infinity;
    if (wc && wc.city === ntSettings.weatherCity && wAge < 5 * 60 * 1000) {
      // Fresh enough — render from cache immediately, no network call yet
      var iconEl2 = document.getElementById('weather-icon');
      var locEl2  = document.getElementById('weather-location');
      var tmpEl2  = document.getElementById('weather-temp');
      var dscEl2  = document.getElementById('weather-desc');
      if (iconEl2) iconEl2.textContent = _icon(wc.code);
      if (locEl2)  locEl2.textContent  = wc.locStr || wc.city;
      if (tmpEl2)  tmpEl2.textContent  = (_useF() ? wc.tempF + '°F' : wc.tempC + '°C');
      if (dscEl2)  dscEl2.textContent  = wc.desc;
      window.lastWeatherData = { code: wc.code, tempC: wc.tempC, tempF: wc.tempF, desc: wc.desc };
    } else {
      // Stale or no cache — fetch immediately
      setTimeout(function() { window.fetchWeather(ntSettings.weatherCity); }, 200);
    }
    // Refresh every 5 minutes
    setInterval(function() {
      if (ntSettings.weatherCity) window.fetchWeather(ntSettings.weatherCity);
    }, 5 * 60 * 1000);
    // Immediately refetch when coming back online after an offline period
    window.addEventListener('online', function() {
      if (ntSettings.weatherCity) setTimeout(function() { window.fetchWeather(ntSettings.weatherCity); }, 500);
    });
  }

  // Wire °C / °F toggle buttons
  (function() {
    var btnC = document.getElementById('weather-unit-c');
    var btnF = document.getElementById('weather-unit-f');
    function setUnit(u) {
      ntSettings.weatherUnit = u; saveSettings();
      _applyUnitButtons();
      if (ntSettings.weatherCity) window.fetchWeather(ntSettings.weatherCity);
    }
    if (btnC) btnC.addEventListener('click', function() { setUnit('c'); });
    if (btnF) btnF.addEventListener('click', function() { setUnit('f'); });
    _applyUnitButtons();
  })();

  // Clock weather inline update
  window.updateClockWeatherInline = function() {
    var cwi = document.getElementById('clock-weather-inline');
    if (!cwi) return;
    if (!ntSettings.showClockWeather) { cwi.classList.remove('visible'); return; }
    cwi.classList.add('visible');
    if (!window.lastWeatherData) {
      if (ntSettings.weatherCity) window.fetchWeather(ntSettings.weatherCity);
      return;
    }
    var d = window.lastWeatherData;
    var temp = _useF() ? d.tempF + '°F' : d.tempC + '°C';
    var tempEl = document.getElementById('cwi-temp');
    var descEl = document.getElementById('cwi-desc');
    var iconEl = document.getElementById('cwi-icon');
    if (tempEl) tempEl.textContent = temp;
    if (descEl) descEl.textContent = d.desc || '';
    if (iconEl) iconEl.textContent = _icon(d.code) || '';
  };
  setTimeout(function() { window.updateClockWeatherInline(); }, 200);
})();

// ════════════════════════════════════════════ LEARN LANGUAGE WIDGET INIT
(function initLearnWidget() {
   if (!document.getElementById('widget-learn')) return;

  const LANG_CODES = {
    'English':'en','Spanish':'es','French':'fr','German':'de','Italian':'it',
    'Portuguese':'pt','Dutch':'nl','Russian':'ru','Polish':'pl','Swedish':'sv',
    'Norwegian':'no','Danish':'da','Finnish':'fi','Turkish':'tr','Arabic':'ar',
    'Japanese':'ja','Chinese':'zh','Korean':'ko','Hindi':'hi','Greek':'el',
    'Latin':'la','Serbian':'sr',
  };

  const WORD_PERM_KEY  = 'nt_word_perm';
  const WORD_POS_KEY   = 'nt_word_pos';
  const WORD_CACHE_KEY = 'nt_word_cache';
  const LEARN_NEXT_KEY = 'nt_learn_next';

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function getNextWordIdx() {
    let perm = LS.get(WORD_PERM_KEY, null);
    let pos  = LS.get(WORD_POS_KEY, 0) || 0;
    if (!perm || perm.length !== WORD_LIST.length || pos >= perm.length) {
      perm = shuffleArray(WORD_LIST.map((_, i) => i)); pos = 0; LS.set(WORD_PERM_KEY, perm);
    }
    const idx = perm[pos]; LS.set(WORD_POS_KEY, pos + 1); return idx;
  }

  let currentWordIdx = getNextWordIdx();

  const CURRENT_PAIR_KEY = 'nt_learn_current';
  function getWordCache() { return LS.get(WORD_CACHE_KEY, {}); }
  function setWordCache(wc) { LS.set(WORD_CACHE_KEY, wc); }

  async function prefetchNextLearnWord(nextIdx) {
    const lang1 = ntSettings.wordLang1 || 'English';
    const lang2 = ntSettings.wordLang2 || 'French';
    const code1 = LANG_CODES[lang1] || 'en';
    const code2 = LANG_CODES[lang2] || 'fr';
    const word  = WORD_LIST[nextIdx % WORD_LIST.length];
    try {
      const [w1, w2] = await Promise.all([
        code1 === 'en' ? Promise.resolve(word) : translateWord(word, 'en', code1),
        code2 === 'en' ? Promise.resolve(word) : translateWord(word, 'en', code2),
      ]);
      const cap1 = sanitizeText(w1); const cap2 = sanitizeText(w2);
      LS.set(LEARN_NEXT_KEY, {
        idx: nextIdx,
        w1: cap1.charAt(0).toUpperCase() + cap1.slice(1),
        w2: cap2.charAt(0).toUpperCase() + cap2.slice(1),
        lang1, lang2
      });
    } catch {}
  }

  // Show last cached word pair immediately before translation fetch completes
  (function showCachedPair() {
    const cached = LS.get(CURRENT_PAIR_KEY, null);
    if (!cached) return;
    const lang1 = ntSettings.wordLang1 || 'English';
    const lang2 = ntSettings.wordLang2 || 'French';
    if (cached.lang1 !== lang1 || cached.lang2 !== lang2) return;
    const pairEl = document.getElementById('word-pair');
    const langEl = document.getElementById('word-lang-display');
    if (langEl) langEl.textContent = lang1 + ' – ' + lang2;
    if (pairEl && cached.w1 && cached.w2)
      pairEl.innerHTML = cached.w1 + '<span class="word-separator">–</span>' + cached.w2;
  })();

  async function translateWord(word, fromCode, toCode) {
    if (fromCode === toCode) return word;
    const key = `${word}|${fromCode}|${toCode}`;
    const cache = getWordCache();
    if (cache[key]) return cache[key];
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromCode}&tl=${toCode}&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const translated = data?.[0]?.[0]?.[0];
      if (!translated) throw new Error();
      const clean = sanitizeText(translated).trim();
      if (!clean) throw new Error();
      cache[key] = clean; setWordCache(cache); return clean;
    } catch { return word; }
  }

  function googleTTSUrl(text, langCode) {
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=gtx`;
  }

  let _lastW1 = '', _lastW2 = '', _lastCode1 = 'en', _lastCode2 = 'fr';

  async function showLearnWord(idx, animate) {
    const pairEl = document.getElementById('word-pair');
    const langEl = document.getElementById('word-lang-display');
    if (!pairEl) return;
    const word  = WORD_LIST[idx % WORD_LIST.length];
    const lang1 = ntSettings.wordLang1 || 'English';
    const lang2 = ntSettings.wordLang2 || 'French';
    const code1 = LANG_CODES[lang1] || 'en';
    const code2 = LANG_CODES[lang2] || 'fr';
    if (langEl) langEl.textContent = lang1 + ' – ' + lang2;

    const applyWords = (w1, w2) => {
      const c1 = sanitizeText(w1); const c2 = sanitizeText(w2);
      const cap1 = c1.charAt(0).toUpperCase() + c1.slice(1);
      const cap2 = c2.charAt(0).toUpperCase() + c2.slice(1);
      if (cap2 !== '…') {
        _lastW1 = cap1; _lastW2 = cap2; _lastCode1 = code1; _lastCode2 = code2;
        LS.set(CURRENT_PAIR_KEY, { w1: cap1, w2: cap2, lang1: ntSettings.wordLang1 || 'English', lang2: ntSettings.wordLang2 || 'French' });
      }
      if (animate) {
        pairEl.classList.add('fade-out');
        setTimeout(() => { pairEl.innerHTML = `${cap1}<span class="word-separator">–</span>${cap2}`; pairEl.classList.remove('fade-out'); }, 350);
      } else {
        pairEl.innerHTML = `${cap1}<span class="word-separator">–</span>${cap2}`;
      }
    };

    const prefetched = LS.get(LEARN_NEXT_KEY, null);
    if (prefetched && prefetched.idx === idx && prefetched.lang1 === lang1 && prefetched.lang2 === lang2
        && prefetched.w2 && prefetched.w2 !== '…') {
      applyWords(prefetched.w1, prefetched.w2);
      LS.set(LEARN_NEXT_KEY, null);
    } else {
      const capWord = word.charAt(0).toUpperCase() + word.slice(1);
      applyWords(capWord, '…');
      const [w1, w2] = await Promise.all([
        code1 === 'en' ? Promise.resolve(capWord) : translateWord(word, 'en', code1),
        code2 === 'en' ? Promise.resolve(capWord) : translateWord(word, 'en', code2),
      ]);
      applyWords(w1, w2);
    }
    
    setTimeout(function() { prefetchNextLearnWord((idx + 1) % WORD_LIST.length); }, 800);
  }

  document.getElementById('word-next').addEventListener('click', () => {
    currentWordIdx = (currentWordIdx + 1) % WORD_LIST.length;
    showLearnWord(currentWordIdx, true);
  });

  // Speak button
  const speakBtn = document.getElementById('word-speak');
  if (speakBtn) {
    function playAudio(url) {
      return new Promise((resolve, reject) => {
        const audio = new Audio(url); audio.onended = resolve; audio.onerror = reject;
        audio.play().catch(reject);
      });
    }
    speakBtn.addEventListener('click', async () => {
      if (!_lastW2) return;
      speakBtn.disabled = true; speakBtn.textContent = '…';
      try {
        await playAudio(googleTTSUrl(_lastW2, _lastCode2));
      } catch {
        try {
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(_lastW2); u.lang = _lastCode2;
            window.speechSynthesis.speak(u);
          }
        } catch {}
      }
      speakBtn.disabled = false; speakBtn.textContent = 'Speak';
    });
  }

  // Language pickers (in settings panel — wired here)
  const lang1Sel = document.getElementById('word-lang1');
  const lang2Sel = document.getElementById('word-lang2');
  if (lang1Sel) {
    lang1Sel.value = ntSettings.wordLang1 || 'English';
    lang1Sel.addEventListener('change', e => { ntSettings.wordLang1 = e.target.value; saveSettings(); showLearnWord(currentWordIdx, false); });
  }
  if (lang2Sel) {
    lang2Sel.value = ntSettings.wordLang2 || 'French';
    lang2Sel.addEventListener('change', e => { ntSettings.wordLang2 = e.target.value; saveSettings(); showLearnWord(currentWordIdx, false); });
  }

  showLearnWord(currentWordIdx, false);
})();

// ════════════════════════════════════════════ QUICK LINKS WIDGET INIT
(function initQuickLinks() {
  var QL_KEY = 'nt_quicklinks';
  var MODAL_OVERLAY_ID = 'ql-modal-overlay';

  function loadLinks() { return LS.get(QL_KEY, []); }
  function saveLinks(links) { LS.set(QL_KEY, links); }

  function getFavicon(url) {
    try { var d = new URL(url).hostname; return 'https://www.google.com/s2/favicons?domain=' + d + '&sz=64'; }
    catch(e) { return ''; }
  }

  function renderLinks() {
    var grid = document.getElementById('quicklinks-grid');
    if (!grid) return;
    var links = loadLinks();
    grid.innerHTML = '';

    // Track drag state
    var dragSrc = null;

    links.forEach(function(link, idx) {
      var item = document.createElement('div');
      item.className = 'ql-item';
      item.draggable = true;
      item.dataset.idx = idx;

      var anchor = document.createElement('a');
      anchor.className = 'ql-anchor';
      anchor.href = link.url;
      anchor.title = link.label || link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';

      var iconWrap = document.createElement('div');
      iconWrap.className = 'ql-icon-wrap';
      var fav = document.createElement('img');
      fav.className = 'ql-favicon';
      fav.src = link.icon || getFavicon(link.url);
      fav.alt = '';
      var ph = document.createElement('div');
      ph.className = 'ql-favicon-ph';
      ph.textContent = (link.label || link.url || '?')[0].toUpperCase();
      fav.addEventListener('error', function() { fav.style.display = 'none'; ph.style.display = 'flex'; });
      iconWrap.appendChild(fav); iconWrap.appendChild(ph);

      var label = document.createElement('span');
      label.className = 'ql-label';
      label.textContent = link.label || (function() { try { return new URL(link.url).hostname.replace(/^www\./,''); } catch(e) { return link.url; } })();

      anchor.appendChild(iconWrap); anchor.appendChild(label);

      // Remove button
      var rmBtn = document.createElement('button');
      rmBtn.className = 'ql-remove';
      rmBtn.title = 'Remove';
      rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var arr = loadLinks();
        arr.splice(idx, 1);
        saveLinks(arr);
        renderLinks();
      });

      // Edit button (pencil, appears on hover beside remove)
      var editBtn = document.createElement('button');
      editBtn.className = 'ql-edit';
      editBtn.title = 'Edit';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        openModal(idx);
      });

      item.appendChild(anchor); item.appendChild(editBtn); item.appendChild(rmBtn);

      // ── Drag-and-drop for sorting ──────────────────────────────────────
      item.addEventListener('dragstart', function(e) {
        dragSrc = item;
        item.classList.add('ql-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx);
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('ql-dragging');
        grid.querySelectorAll('.ql-item').forEach(function(it) { it.classList.remove('ql-drag-over'); });
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== dragSrc) item.classList.add('ql-drag-over');
      });
      item.addEventListener('dragleave', function() { item.classList.remove('ql-drag-over'); });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('ql-drag-over');
        if (!dragSrc || dragSrc === item) return;
        var fromIdx = parseInt(dragSrc.dataset.idx);
        var toIdx   = parseInt(item.dataset.idx);
        var arr = loadLinks();
        var moved = arr.splice(fromIdx, 1)[0];
        arr.splice(toIdx, 0, moved);
        saveLinks(arr);
        renderLinks();
      });

      grid.appendChild(item);
    });

    // "Add" button
    var addWrap = document.createElement('div');
    addWrap.className = 'ql-item';
    addWrap.style.cursor = 'default';
    var addBtn = document.createElement('div');
    addBtn.className = 'ql-add-btn';
    addBtn.title = 'Add quick link';
    addBtn.innerHTML = '<span class="ql-add-plus">+</span>';
    addBtn.addEventListener('click', function(e) { e.stopPropagation(); openModal(); });
    addWrap.appendChild(addBtn);
    grid.appendChild(addWrap);
  }

  // ── Modal ─────────────────────────────────────────────────────────────
  function openModal(editIdx) {
    var existing = document.getElementById(MODAL_OVERLAY_ID);
    if (existing) existing.remove();

    var links = loadLinks();
    var editing = editIdx != null ? links[editIdx] : null;

    var overlay = document.createElement('div');
    overlay.id = MODAL_OVERLAY_ID;
    overlay.className = 'ql-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'ql-modal';
    modal.innerHTML =
      '<div class="ql-modal-title">' + (editing ? 'Edit Link' : 'Add Quick Link') + '</div>' +
      '<input class="ql-modal-input" id="ql-input-label" type="text" placeholder="Label (optional)" value="' + (editing ? editing.label || '' : '') + '">' +
      '<input class="ql-modal-input" id="ql-input-url"   type="text" placeholder="https://example.com" value="' + (editing ? editing.url   || '' : '') + '">' +
      '<div class="ql-modal-btns">' +
        '<button class="ql-modal-btn-cancel">Cancel</button>' +
        '<button class="ql-modal-btn-save">' + (editing ? 'Save' : 'Add') + '</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var urlInput   = document.getElementById('ql-input-url');
    var labelInput = document.getElementById('ql-input-label');
    if (urlInput) setTimeout(function() { urlInput.focus(); }, 50);

    modal.querySelector('.ql-modal-btn-cancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    modal.querySelector('.ql-modal-btn-save').addEventListener('click', function() {
      var url   = urlInput ? urlInput.value.trim() : '';
      var label = labelInput ? labelInput.value.trim() : '';
      if (!url) return;
      if (!/^https?:\/\//.test(url)) url = 'https://' + url;
      var arr = loadLinks();
      if (editIdx != null) {
        arr[editIdx] = { url: url, label: label };
      } else {
        arr.push({ url: url, label: label });
      }
      saveLinks(arr);
      overlay.remove();
      renderLinks();
    });

    // Allow Enter key to save
    [urlInput, labelInput].forEach(function(inp) {
      if (!inp) return;
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') modal.querySelector('.ql-modal-btn-save').click();
        if (e.key === 'Escape') overlay.remove();
      });
    });
  }

  window.qlOpenModal = openModal;
  // Add "+ New" button to base quicklinks header so user can spawn extra instances
  (function patchQLHeader() {
    var qlW = document.getElementById('widget-quicklinks');
    if (!qlW) return;
    var hdr = qlW.querySelector('.widget-header');
    if (!hdr || hdr.querySelector('.ql-new-widget-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'ql-new-widget-btn'; btn.title = 'Add new Quick Links widget'; btn.textContent = '+';
    btn.style.cssText = 'background:none;border:none;color:var(--text2);font-size:1rem;cursor:pointer;padding:0 3px;line-height:1;';
    btn.addEventListener('click', function(e) { e.stopPropagation(); addQuicklinksInstance(); });
    var closeBtn = hdr.querySelector('.widget-close');
    if (closeBtn) hdr.insertBefore(btn, closeBtn); else hdr.appendChild(btn);
  })();
  renderLinks();

  // Re-render when widget becomes visible
  var qw = document.getElementById('widget-quicklinks');
  if (qw) {
    new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        if (m.attributeName === 'style' && qw.style.display !== 'none') renderLinks();
      });
    }).observe(qw, { attributes: true });
  }
})();

(function initMerriamWidget() {
  var MERRIAM_KEY = 'nt_merriam_cache';
  var todayKey = new Date().toISOString().slice(0, 10);
  var cached = LS.get(MERRIAM_KEY, null);

  function updateLink(word) {
    var link = document.getElementById('merriam-link');
    if (link && word) {
      link.href = 'https://www.merriam-webster.com/dictionary/' + encodeURIComponent(word);
    }
  }

  // Wrap renderMerriamWord to also cache and update link
  var _origRenderMerriam = renderMerriamWord;
  renderMerriamWord = function(data) {
    _origRenderMerriam(data);
    updateLink(data.word);
    if (data.date === todayKey) LS.set(MERRIAM_KEY, data);
  };
  window.renderMerriamWord = renderMerriamWord;

  // Load from cache first (instant), then fetch fresh if stale
  if (cached && cached.date === todayKey) {
    renderMerriamWord(cached);
  } else {
    fetchMerriamWordOfDay();
  }

  // Re-fetch when widget becomes visible (if still showing "Loading…")
  var w = document.getElementById('widget-merriam');
  if (w) {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'style' && w.style.display !== 'none') {
          var wordEl = document.getElementById('merriam-word');
          if (wordEl && (wordEl.textContent === 'Loading…' || !wordEl.textContent.trim())) {
            fetchMerriamWordOfDay();
          }
        }
      });
    }).observe(w, { attributes: true });
  }
})();
// ══ WIDGET: QUOTES ═══════════════════════════════════════════════════════════
// QUOTES array is provided by quotes.js loaded before this file.
(async function initWidget_quotes() {
  if (!document.getElementById('widget-quotes')) return;

  const lastIdx = LS.get('nt_quote_last', -1);
  let currentIdx = Math.floor(Math.random() * QUOTES.length);
  if (currentIdx === lastIdx && QUOTES.length > 1) currentIdx = (currentIdx + 1) % QUOTES.length;
  LS.set('nt_quote_last', currentIdx);

  function showQuote(idx, animate) {
    const textEl   = document.getElementById('quotes-text');
    const authEl   = document.getElementById('quotes-author');
    const cntEl    = document.getElementById('quotes-counter');
    if (!textEl) return;
    function set() {
      textEl.textContent  = QUOTES[idx].text;
      authEl.textContent  = '— ' + QUOTES[idx].author;
      if (cntEl) cntEl.textContent = (idx + 1) + ' / ' + QUOTES.length;
      textEl.classList.remove('fade-out'); authEl.classList.remove('fade-out');
    }
    if (animate) { textEl.classList.add('fade-out'); authEl.classList.add('fade-out'); setTimeout(set, 350); }
    else set();
    currentIdx = idx;
    LS.set('nt_quote_last', idx);
  }

  document.getElementById('quotes-next').addEventListener('click', () => {
    showQuote((currentIdx + 1) % QUOTES.length, true);
  });
  showQuote(currentIdx, false);
})();
// ════════════════════════════════════════════ SCROLL-SNAP TWO-PAGE SYSTEM
(function initScrollPages() {
  const pagesEl = document.getElementById('pages');
  const page1   = document.getElementById('page-main');
  const page2   = document.getElementById('page-workspace');
  if (!pagesEl || !page1 || !page2) return;

  function applyPage2Enabled() {
    const on = ntSettings.enablePage2 !== false;
    page2.style.display = on ? '' : 'none';
    pagesEl.style.overflowY = on ? 'scroll' : 'hidden';
    const hint = document.getElementById('scroll-hint');
    if (hint) hint.style.display = on ? '' : 'none';
    if (!on && pagesEl.scrollTop > 0) pagesEl.scrollTo({ top: 0, behavior: 'instant' });
    const tog = document.getElementById('toggle-page2');
    if (tog) tog.checked = on;
  }

  let currentPage = 0;
  let _pageReady = false; // don't save during initial call
  function update() {
    const onPage2 = pagesEl.scrollTop > (page1.offsetHeight || window.innerHeight) / 2;
    pagesEl.classList.toggle('page2-active', onPage2);
    currentPage = onPage2 ? 1 : 0;
    // Only save after the page has been restored (not during the initial 0-scroll read)
    if (_pageReady && ntSettings.rememberPage) {
      ntSettings.lastPage = currentPage;
      saveSettings();
    }
  }
  pagesEl.addEventListener('scroll', update, { passive: true });
  update(); // initial call — _pageReady is false so won't overwrite lastPage
  _pageReady = true; // from now on, scroll events save position
  applyPage2Enabled();

  // Restore saved page position after layout is ready
  if (ntSettings.rememberPage && ntSettings.lastPage === 1 && ntSettings.enablePage2 !== false) {
    requestAnimationFrame(() => {
      const pageH = page1.offsetHeight || window.innerHeight;
      pagesEl.scrollTo({ top: pageH, behavior: 'instant' });
      update();
      // Signal that restore is complete so widgets can reveal normally
      window._pageRestoreDone = true;
    });
  } else {
    window._pageRestoreDone = true; // no restore needed, proceed immediately
  }

  window.scrollToPage      = idx => { if (ntSettings.enablePage2 !== false || idx === 0) pagesEl.scrollTo({ top: idx * page1.offsetHeight, behavior: 'smooth' }); };
  window.getCurrentPage    = () => currentPage;
  window.applyPage2Enabled = applyPage2Enabled;
})();

// ════════════════════════════════════════════ WIDGET PAGE ASSIGNMENT
// Ctrl+click any widget header to move it between page 1 and page 2.
if (!ntSettings.widgetPage) ntSettings.widgetPage = {};

function assignWidgetPage(id, el) {
  if (!el) return;
  const idx    = (ntSettings.widgetPage[id] !== undefined) ? ntSettings.widgetPage[id] : 0;
  const target = idx === 1 ? document.getElementById('page-workspace') : document.getElementById('page-main');
  if (target && el.parentElement !== target) target.appendChild(el);
}

document.addEventListener('click', e => {
  if (!e.ctrlKey) return;
  const header = e.target.closest('.widget-header');
  if (!header) return;
  const widget = header.closest('.widget');
  if (!widget) return;
  const id = widget.id.replace('widget-', '');
  if (!id || id === 'ignorelist') return;
  const next = ((ntSettings.widgetPage[id] || 0) === 0) ? 1 : 0;
  ntSettings.widgetPage[id] = next; saveSettings();
  assignWidgetPage(id, widget);
  _showPageToast(next === 1 ? 'Moved to Workspace ↓' : 'Moved to Home ↑');
});

function _showPageToast(msg) {
  let t = document.getElementById('_pg_toast');
  if (!t) {
    t = document.createElement('div'); t.id = '_pg_toast';
    t.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:7px 18px;border-radius:20px;font-size:0.78rem;pointer-events:none;z-index:9999;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

// checkWidgetVisibility already handles page-2 widgets natively (see above)

// ════════════════════════════════════════════ ARROW CLICK → SNAP PAGE
// The #scroll-hint arrow on page 1 and #scroll-up-hint on page 2 are clickable.
document.addEventListener('click', e => {
  if (e.target.closest('#scroll-hint'))    { e.stopPropagation(); window.scrollToPage && window.scrollToPage(1); }
  if (e.target.closest('#scroll-up-hint')) { e.stopPropagation(); window.scrollToPage && window.scrollToPage(0); }
});
// Make the arrows look clickable
(function styleArrows() {
  const style = document.createElement('style');
  style.textContent = `
    #scroll-hint, #scroll-up-hint { cursor: pointer; pointer-events: auto !important; }
    #scroll-hint:hover, #scroll-up-hint:hover { opacity: 0.7 !important; }
  `;
  document.head.appendChild(style);
})();
console.log('checkpoint 23');
// ════════════════════════════════════════════ DUPLICATE NOTES / TODO
// Extra instances of notes/todo. Spawner functions call into widget JS.

if (!ntSettings.extraNotes) ntSettings.extraNotes = [];
if (!ntSettings.extraTodos) ntSettings.extraTodos = [];
if (!ntSettings.extraQuicklinks) ntSettings.extraQuicklinks = [];

function _genInstanceId(base) { return base + "_" + Date.now().toString(36); }
function _esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function _centerWidgetOnCurrentPage(el, pageIdx) {
  var pageEl = pageIdx === 1
    ? (document.getElementById('page-workspace') || document.getElementById('page-main'))
    : document.getElementById('page-main');
  if (!pageEl) pageEl = document.body;
  // Position relative to the viewport center of the current page
  var pageRect = pageEl.getBoundingClientRect();
  var ew = el.offsetWidth  || 280;
  var eh = el.offsetHeight || 200;
  var cx = Math.round(pageRect.left + (pageRect.width  - ew) / 2 - (pageEl.getBoundingClientRect ? pageEl.getBoundingClientRect().left : 0));
  var cy = Math.round(pageRect.top  + (pageRect.height - eh) / 3 - (pageEl.getBoundingClientRect ? pageEl.getBoundingClientRect().top  : 0));
  // Convert to page-relative coords (widget is position:absolute in its page)
  var pw = pageEl.offsetWidth  || window.innerWidth;
  var ph = pageEl.offsetHeight || window.innerHeight;
  cx = Math.max(20, Math.min(pw - ew - 20, Math.round((pw - ew) / 2)));
  cy = Math.max(20, Math.min(ph - eh - 20, Math.round((ph - eh) / 3)));
  el.style.left = cx + 'px'; el.style.top = cy + 'px';
  el.style.bottom = 'auto'; el.style.right = 'auto';
}

function _getCurrentPageSafe() {
  // Try the registered scroll-snap page tracker first
  if (typeof window.getCurrentPage === 'function') return window.getCurrentPage();
  // Fallback: read scroll position directly so spawning always targets the visible page
  const pagesEl = document.getElementById('pages');
  const page1   = document.getElementById('page-main');
  if (!pagesEl || !page1) return 0;
  return pagesEl.scrollTop > (page1.offsetHeight || window.innerHeight) / 2 ? 1 : 0;
}

function addNotesInstance(title) {
  var instId = _genInstanceId("notes");
  var currentPage = _getCurrentPageSafe();
  ntSettings.extraNotes.push({ id: instId, title: title || "Notes" });
  ntSettings.widgets[instId] = true; ntSettings.widgetOpen[instId] = true;
  if (!ntSettings.widgetPage) ntSettings.widgetPage = {};
  ntSettings.widgetPage[instId] = currentPage;
  saveSettings();
  _spawnNotesWidget(instId, title || "Notes");
  setTimeout(function() {
    var el = document.getElementById('widget-' + instId);
    if (!el) return;
    el.style.display = 'block';
    var pageElN = currentPage === 1
      ? (document.getElementById('page-workspace') || document.getElementById('page-main'))
      : document.getElementById('page-main');
    if (!pageElN) pageElN = document.body;
    var pwN = pageElN.offsetWidth  || window.innerWidth;
    var phN = pageElN.offsetHeight || window.innerHeight;
    var ewN = el.offsetWidth  || 280; var ehN = el.offsetHeight || 220;
    var cxN = Math.max(20, Math.min(pwN - ewN - 20, Math.round((pwN - ewN) / 2)));
    var cyN = Math.max(20, Math.min(phN - ehN - 20, Math.round((phN - ehN) / 3)));
    el.style.left = cxN + 'px'; el.style.top = cyN + 'px';
    el.style.bottom = 'auto'; el.style.right = 'auto';
    ntSettings.widgetPositions[instId] = { xFrac: cxN / pwN, yFrac: cyN / phN };
    saveSettings();
    if (typeof window.restoreNotesHeights === 'function') window.restoreNotesHeights();
    el.style.removeProperty('opacity');
  }, 40);
}
function addTodoInstance(title) {
  var instId = _genInstanceId("todo");
  var currentPage = _getCurrentPageSafe();
  ntSettings.extraTodos.push({ id: instId, title: title || "To-Do" });
  ntSettings.widgets[instId] = true; ntSettings.widgetOpen[instId] = true;
  if (!ntSettings.widgetPage) ntSettings.widgetPage = {};
  ntSettings.widgetPage[instId] = currentPage;
  saveSettings();
  _spawnTodoWidget(instId, title || "To-Do");
  setTimeout(function() {
    var el = document.getElementById('widget-' + instId);
    if (!el) return;
    el.style.display = 'block';
    var pageElT = currentPage === 1
      ? (document.getElementById('page-workspace') || document.getElementById('page-main'))
      : document.getElementById('page-main');
    if (!pageElT) pageElT = document.body;
    var pwT = pageElT.offsetWidth  || window.innerWidth;
    var phT = pageElT.offsetHeight || window.innerHeight;
    var ewT = el.offsetWidth  || 260; var ehT = el.offsetHeight || 200;
    var cxT = Math.max(20, Math.min(pwT - ewT - 20, Math.round((pwT - ewT) / 2)));
    var cyT = Math.max(20, Math.min(phT - ehT - 20, Math.round((phT - ehT) / 3)));
    el.style.left = cxT + 'px'; el.style.top = cyT + 'px';
    el.style.bottom = 'auto'; el.style.right = 'auto';
    ntSettings.widgetPositions[instId] = { xFrac: cxT / pwT, yFrac: cyT / phT };
    saveSettings();
    el.style.removeProperty('opacity');
  }, 40);
}

// ── Notes content persistence helpers ──────────────────────────────────────
function _notesKey(id)  { return 'nt_notes_' + id; }
function _saveNotesContent(id) {
  var ta = document.getElementById('notes-area-' + id);
  if (ta) LS.set(_notesKey(id), ta.value);
}
function _loadNotesContent(id) {
  return LS.get(_notesKey(id), '');
}

function _attachTitleRename(el, instId, collection) {
  var titleEl = el.querySelector('.widget-title');
  if (!titleEl) return;
  titleEl.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    var current = titleEl.textContent.trim();
    var inp = document.createElement('input');
    inp.type = 'text'; inp.value = current;
    inp.style.cssText = 'background:transparent;border:none;border-bottom:1px solid var(--accent);color:var(--text);font-family:var(--font);font-size:0.72rem;font-weight:600;letter-spacing:0.06em;outline:none;width:100%;text-transform:uppercase;';
    titleEl.replaceWith(inp); inp.focus(); inp.select();
    function commit() {
      var newTitle = inp.value.trim() || current;
      titleEl.textContent = newTitle;
      inp.replaceWith(titleEl);
      var entry = (collection || []).find(function(n) { return n.id === instId; });
      if (entry) { entry.title = newTitle; saveSettings(); }
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); }
      if (ev.key === 'Escape') { inp.value = current; inp.blur(); }
    });
  });
}
function _spawnNotesWidget(instId, title) {
  if (document.getElementById('widget-' + instId)) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget widget-resizable" id="widget-' + instId + '" style="opacity:0;">' +
    '<div class="widget-header"><span>\uD83D\uDCDD</span>' +
    '<span class="widget-title" title="Double-click to rename">' + _esc(title) + '</span>' +
    '<button class="notes-header-add" title="Add new note">+</button>' +
    '<button class="widget-transparent-btn" data-target="widget-' + instId + '" title="Toggle transparent">\u25D0</button>' +
    '<button class="widget-close" data-close="' + instId + '">&times;</button></div>' +
    '<textarea class="notes-area" id="notes-area-' + instId + '" placeholder="Jot something down\u2026" spellcheck="'+ntSettings.spellcheck+'" style="resize:both;min-height:80px;"></textarea>' +
    '<div class="notes-footer"><span id="notes-char-count-' + instId + '">0 chars</span>' +
    '<span class="notes-saved" id="notes-saved-' + instId + '" style="opacity:0">Saved \u2713</span></div>' +
    '</div>';
  var el = div.firstElementChild;
  var _noteTargetPage = (ntSettings.widgetPage && ntSettings.widgetPage[instId] === 1)
    ? (document.getElementById("page-workspace") || document.getElementById("page-main") || document.body)
    : (document.getElementById("page-main") || document.body);
  _noteTargetPage.appendChild(el);
  _restoreWidgetSize(el);


  // Load saved content
  var ta = el.querySelector('.notes-area');
  var savedText = _loadNotesContent(instId);
  if (ta) {
    ta.value = savedText;
    var countEl = document.getElementById('notes-char-count-' + instId);
    if (countEl) countEl.textContent = savedText.length + ' chars';
  }

  // Let widget JS handle if available, otherwise wire saving ourselves
  if (typeof window._initNotesInstance === 'function') {
    window._initNotesInstance(instId);
  } else if (ta) {
    var saveIndicator = document.getElementById('notes-saved-' + instId);
    var saveTimer;
    ta.addEventListener('input', function() {
      var countEl2 = document.getElementById('notes-char-count-' + instId);
      if (countEl2) countEl2.textContent = ta.value.length + ' chars';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function() {
        _saveNotesContent(instId);
        if (saveIndicator) { saveIndicator.style.opacity = '1'; setTimeout(function() { saveIndicator.style.opacity = '0'; }, 1400); }
      }, 600);
    });
  }

  _attachTitleRename(el, instId, ntSettings.extraNotes);

  var addBtn = el.querySelector('.notes-header-add');
  if (addBtn) addBtn.addEventListener('click', function(e) { e.stopPropagation(); addNotesInstance('Notes'); });

  // Restore transparent state (click handled by global delegation)
  if ((ntSettings.widgetTransparent || {})[instId]) el.classList.add('widget-transparent');

  makeDraggable(el);
  el.querySelector('.widget-close').addEventListener('click', function() {
    ntSettings.extraNotes = (ntSettings.extraNotes || []).filter(function(n) { return n.id !== instId; });
    delete ntSettings.widgets[instId]; delete ntSettings.widgetOpen[instId];
    delete ntSettings.widgetPositions[instId];
    if (ntSettings.widgetPage) delete ntSettings.widgetPage[instId];
    if (ntSettings.widgetTransparent) delete ntSettings.widgetTransparent[instId];
    // Clean up saved data for this instance
    localStorage.removeItem(_notesKey(instId));
    // If no extra instances remain AND base notes widget is not present, turn off notes
    var remaining = ntSettings.extraNotes.length;
    var baseEl = document.getElementById('widget-notes');
    if (remaining === 0 && !baseEl) {
      ntSettings.widgets.notes = false;
      ntSettings.widgetOpen.notes = false;
      var chk = document.getElementById('chk-notes');
      if (chk) chk.checked = false;
      var dockToggle = document.querySelector('[data-dock-id="notes"] .dock-widget-toggle');
      if (dockToggle) dockToggle.className = 'dock-widget-toggle';
    }
    saveSettings(); el.remove(); renderWidgetDock();
  });
  renderWidgetDock();
}
function _restoreWidgetSize(el) {
  var map = LS.get(NOTES_H_KEY, {});
  var saved = map[el.id];

  if (!saved) return;

  console.log('Restoring (spawned):', el.id, saved);

  if (typeof saved === 'number') {
    el.style.height = saved + 'px';
  } else {
    if (saved.height) el.style.height = saved.height + 'px';
    if (saved.width) el.style.width = saved.width + 'px';
  }
}
console.log('checkpoint 24');
// ── Todo content persistence helpers ───────────────────────────────────────
function _todoKey(id)  { return 'nt_todo_' + id; }
function _saveTodoItems(id) {
  var items = [];
  var listEl = document.getElementById('todo-list-' + id);
  if (listEl) {
    listEl.querySelectorAll('.todo-item').forEach(function(item) {
      items.push({ text: (item.querySelector('.todo-text') || {}).textContent || '', done: item.classList.contains('todo-done') });
    });
  }
  LS.set(_todoKey(id), items);
}
function _loadTodoItems(id) { return LS.get(_todoKey(id), []); }

function _renderTodoList(instId) {
  var listEl = document.getElementById('todo-list-' + instId);
  var counterEl = document.getElementById('todo-counter-' + instId);
  if (!listEl) return;
  var items = _loadTodoItems(instId);
  listEl.innerHTML = '';
  if (!items.length) {
    listEl.innerHTML = '<div class="todo-empty">No tasks yet</div>';
    if (counterEl) counterEl.textContent = '';
    return;
  }
  var doneCount = items.filter(function(i) { return i.done; }).length;
  if (counterEl) counterEl.textContent = (items.length - doneCount) + '/' + items.length;
  items.forEach(function(item, idx) {
    var row = document.createElement('div');
    row.className = 'todo-item' + (item.done ? ' todo-done' : '');
    var chk = document.createElement('button');
    chk.className = 'todo-check' + (item.done ? ' checked' : '');
    chk.innerHTML = item.done ? '✓' : '';
    chk.addEventListener('click', function() {
      items[idx].done = !items[idx].done;
      LS.set(_todoKey(instId), items);
      _renderTodoList(instId);
    });
    var txt = document.createElement('span');
    txt.className = 'todo-text'; txt.textContent = item.text;
    var del = document.createElement('button');
    del.className = 'todo-delete'; del.textContent = '✕';
    del.addEventListener('click', function() {
      items.splice(idx, 1);
      LS.set(_todoKey(instId), items);
      _renderTodoList(instId);
    });
    row.appendChild(chk); row.appendChild(txt); row.appendChild(del);
    listEl.appendChild(row);
  });
}

function _spawnTodoWidget(instId, title) {
  if (document.getElementById('widget-' + instId)) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-' + instId + '">' +
    '<div class="widget-header"><span>\u2705</span>' +
    '<span class="widget-title" title="Double-click to rename">' + _esc(title) + '</span>' +
    '<span id="todo-counter-' + instId + '" class="todo-header-counter"></span>' +
    '<button class="widget-transparent-btn" data-target="widget-' + instId + '" title="Toggle transparent">•</button>' +
    '<button class="widget-close" data-close="' + instId + '">&times;</button></div>' +
    '<div id="todo-list-' + instId + '" class="todo-list"></div>' +
    '<div class="todo-footer">' +
    '<div class="todo-input-row">' +
    '<input type="text" id="todo-input-' + instId + '" class="todo-input" placeholder="New task\u2026" autocomplete="off" spellcheck="false">' +
    '<button id="todo-add-btn-' + instId + '" class="todo-add-btn" title="Add task">+</button>' +
    '</div>' +
    '<div class="todo-footer-btns">' +
    '<button class="todo-new-widget-btn" data-newtodo="1">+ Add new</button>' +
    '<button id="todo-clear-done-' + instId + '" class="todo-clear-btn">Clear done</button>' +
    '</div>' +
    '</div></div>';
  var el = div.firstElementChild;
  var _todoTargetPage = (ntSettings.widgetPage && ntSettings.widgetPage[instId] === 1)
    ? (document.getElementById("page-workspace") || document.getElementById("page-main") || document.body)
    : (document.getElementById("page-main") || document.body);
  _todoTargetPage.appendChild(el);

  // Always render our saved items — widgets/todo.js _initTodoInstance handles the BASE #widget-todo
  // but for EXTRA instances we own the lifecycle completely
  _renderTodoList(instId);
  // Wire add/clear
  var addBtn2 = document.getElementById('todo-add-btn-' + instId);
  var inp2 = document.getElementById('todo-input-' + instId);
  function doAdd() {
    var text = inp2 ? inp2.value.trim() : '';
    if (!text) return;
    var items = _loadTodoItems(instId);
    items.push({ text: text, done: false });
    LS.set(_todoKey(instId), items);
    if (inp2) inp2.value = '';
    _renderTodoList(instId);
  }
  if (addBtn2) addBtn2.addEventListener('click', doAdd);
  if (inp2) inp2.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') { ev.preventDefault(); doAdd(); } });
  var clearBtn2 = document.getElementById('todo-clear-done-' + instId);
  if (clearBtn2) clearBtn2.addEventListener('click', function() {
    var items = _loadTodoItems(instId).filter(function(i) { return !i.done; });
    LS.set(_todoKey(instId), items);
    _renderTodoList(instId);
  });

  _attachTitleRename(el, instId, ntSettings.extraTodos);

  var newTodoBtn = el.querySelector('[data-newtodo="1"]');
  if (newTodoBtn) newTodoBtn.addEventListener('click', function(e) { e.stopPropagation(); addTodoInstance('To-Do'); });

  // Restore transparent state (click handled by global delegation)
  if ((ntSettings.widgetTransparent || {})[instId]) el.classList.add('widget-transparent');

  if (typeof window._makeTodoTitleEditable === 'function') window._makeTodoTitleEditable(el, instId, ntSettings.extraTodos);
  makeDraggable(el);
  el.querySelector('.widget-close').addEventListener('click', function() {
    ntSettings.extraTodos = (ntSettings.extraTodos || []).filter(function(t) { return t.id !== instId; });
    delete ntSettings.widgets[instId]; delete ntSettings.widgetOpen[instId];
    delete ntSettings.widgetPositions[instId];
    if (ntSettings.widgetPage) delete ntSettings.widgetPage[instId];
    if (ntSettings.widgetTransparent) delete ntSettings.widgetTransparent[instId];
    // Clean up saved data for this instance
    localStorage.removeItem(_todoKey(instId));
    // If no extra instances remain AND base todo widget is not present, turn off todo
    var remaining = ntSettings.extraTodos.length;
    var baseEl = document.getElementById('widget-todo');
    if (remaining === 0 && !baseEl) {
      ntSettings.widgets.todo = false;
      ntSettings.widgetOpen.todo = false;
      var chk = document.getElementById('chk-todo');
      if (chk) chk.checked = false;
      var dockToggle = document.querySelector('[data-dock-id="todo"] .dock-widget-toggle');
      if (dockToggle) dockToggle.className = 'dock-widget-toggle';
    }
    saveSettings(); el.remove(); renderWidgetDock();
  });
  renderWidgetDock();
}

// ════════════════════════════════════════════ DUPLICATE QUICK LINKS

function addQuicklinksInstance() {
  var instId = _genInstanceId('quicklinks');
  var currentPage = _getCurrentPageSafe();
  ntSettings.extraQuicklinks.push({ id: instId });
  ntSettings.widgets[instId] = true; ntSettings.widgetOpen[instId] = true;
  if (!ntSettings.widgetPage) ntSettings.widgetPage = {};
  ntSettings.widgetPage[instId] = currentPage;
  saveSettings();
  _spawnQuicklinksWidget(instId);
  setTimeout(function() {
    var el = document.getElementById('widget-' + instId);
    if (!el) return;
    el.style.display = 'block';
    var pageElQ = currentPage === 1
      ? (document.getElementById('page-workspace') || document.getElementById('page-main'))
      : document.getElementById('page-main');
    if (!pageElQ) pageElQ = document.body;
    var pwQ = pageElQ.offsetWidth  || window.innerWidth;
    var phQ = pageElQ.offsetHeight || window.innerHeight;
    var ewQ = el.offsetWidth  || 300; var ehQ = el.offsetHeight || 200;
    var cxQ = Math.max(20, Math.min(pwQ - ewQ - 20, Math.round((pwQ - ewQ) / 2)));
    var cyQ = Math.max(20, Math.min(phQ - ehQ - 20, Math.round((phQ - ehQ) / 3)));
    el.style.left = cxQ + 'px'; el.style.top = cyQ + 'px';
    el.style.bottom = 'auto'; el.style.right = 'auto';
    ntSettings.widgetPositions[instId] = { xFrac: cxQ / pwQ, yFrac: cyQ / phQ };
    saveSettings();
    el.style.removeProperty('opacity');
  }, 40);
}

function _spawnQuicklinksWidget(instId) {
  if (document.getElementById('widget-' + instId)) return;
  var QL_INST_KEY = 'nt_quicklinks_' + instId;

  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-' + instId + '" style="opacity:0;">' +
    '<div class="widget-header"><span>\uD83D\uDD17</span>' +
    '<span class="widget-title">Quick Links</span>' +
    '<button class="widget-transparent-btn" data-target="widget-' + instId + '" title="Toggle transparent">\u25D0</button>' +
    '<button class="widget-close" data-close="' + instId + '">\u2715</button></div>' +
    '<div id="quicklinks-grid-' + instId + '" class="ql-grid"></div>' +
    '</div>';
  var el = div.firstElementChild;
  var _qlTargetPage = (ntSettings.widgetPage && ntSettings.widgetPage[instId] === 1)
    ? (document.getElementById('page-workspace') || document.getElementById('page-main') || document.body)
    : (document.getElementById('page-main') || document.body);
  _qlTargetPage.appendChild(el);

  function loadLinks()        { return LS.get(QL_INST_KEY, []); }
  function saveLinksInst(ls)  { LS.set(QL_INST_KEY, ls); }
  function getFavQ(url)       { try { return 'https://www.google.com/s2/favicons?domain=' + new URL(url).hostname + '&sz=64'; } catch(e) { return ''; } }

  function renderLinksInst() {
    var grid = document.getElementById('quicklinks-grid-' + instId);
    if (!grid) return;
    var links = loadLinks();
    grid.innerHTML = '';
    var dragSrc = null;
    links.forEach(function(link, idx) {
      var item = document.createElement('div');
      item.className = 'ql-item'; item.draggable = true; item.dataset.idx = idx;
      var anchor = document.createElement('a');
      anchor.className = 'ql-anchor'; anchor.href = link.url; anchor.title = link.label || link.url;
      anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      var iconWrap = document.createElement('div'); iconWrap.className = 'ql-icon-wrap';
      var fav = document.createElement('img'); fav.className = 'ql-favicon';
      fav.src = link.icon || getFavQ(link.url); fav.alt = '';
      var ph = document.createElement('div'); ph.className = 'ql-favicon-ph';
      ph.textContent = (link.label || link.url || '?')[0].toUpperCase();
      fav.addEventListener('error', function() { fav.style.display = 'none'; ph.style.display = 'flex'; });
      iconWrap.appendChild(fav); iconWrap.appendChild(ph);
      var lbl = document.createElement('span'); lbl.className = 'ql-label';
      lbl.textContent = link.label || (function() { try { return new URL(link.url).hostname.replace(/^www\./,''); } catch(e) { return link.url; } })();
      anchor.appendChild(iconWrap); anchor.appendChild(lbl);
      var rmBtn = document.createElement('button'); rmBtn.className = 'ql-remove'; rmBtn.title = 'Remove'; rmBtn.textContent = '\u2715';
      rmBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var arr = loadLinks(); arr.splice(idx, 1); saveLinksInst(arr); renderLinksInst();
      });
      item.appendChild(anchor); item.appendChild(rmBtn);
      item.addEventListener('dragstart', function(e2) { dragSrc = item; item.classList.add('ql-dragging'); e2.dataTransfer.effectAllowed = 'move'; e2.dataTransfer.setData('text/plain', idx); });
      item.addEventListener('dragend',   function()   { item.classList.remove('ql-dragging'); });
      item.addEventListener('dragover',  function(e2) { e2.preventDefault(); if (item !== dragSrc) item.classList.add('ql-drag-over'); });
      item.addEventListener('dragleave', function()   { item.classList.remove('ql-drag-over'); });
      item.addEventListener('drop', function(e2) {
        e2.preventDefault(); item.classList.remove('ql-drag-over');
        if (!dragSrc || dragSrc === item) return;
        var from = parseInt(dragSrc.dataset.idx), to = parseInt(item.dataset.idx);
        var arr = loadLinks(); var moved = arr.splice(from, 1)[0]; arr.splice(to, 0, moved);
        saveLinksInst(arr); renderLinksInst();
      });
      grid.appendChild(item);
    });
    var addWrap = document.createElement('div'); addWrap.className = 'ql-item';
    var addBtnQ  = document.createElement('div'); addBtnQ.className = 'ql-add-btn'; addBtnQ.title = 'Add quick link';
    addBtnQ.innerHTML = '<span class="ql-add-plus">+</span>';
    addBtnQ.addEventListener('click', function(e) { e.stopPropagation(); openModalInst(); });
    addWrap.appendChild(addBtnQ); grid.appendChild(addWrap);
  }

  function openModalInst(editIdx) {
    var existing = document.getElementById('ql-modal-inst-' + instId); if (existing) existing.remove();
    var links = loadLinks(); var editing = editIdx != null ? links[editIdx] : null;
    var overlay = document.createElement('div'); overlay.id = 'ql-modal-inst-' + instId; overlay.className = 'ql-modal-overlay';
    var modal = document.createElement('div'); modal.className = 'ql-modal';
    modal.innerHTML =
      '<div class="ql-modal-title">' + (editing ? 'Edit Link' : 'Add Quick Link') + '</div>' +
      '<input class="ql-modal-input" id="ql-il-' + instId + '" type="text" placeholder="Label (optional)" value="' + _esc(editing ? editing.label || '' : '') + '">' +
      '<input class="ql-modal-input" id="ql-iu-' + instId + '" type="text" placeholder="https://example.com" value="' + _esc(editing ? editing.url || '' : '') + '">' +
      '<div class="ql-modal-btns"><button class="ql-modal-btn-cancel">Cancel</button><button class="ql-modal-btn-save">' + (editing ? 'Save' : 'Add') + '</button></div>';
    overlay.appendChild(modal); document.body.appendChild(overlay);
    var urlInpQ = document.getElementById('ql-iu-' + instId);
    var lblInpQ = document.getElementById('ql-il-' + instId);
    if (urlInpQ) setTimeout(function() { urlInpQ.focus(); }, 50);
    modal.querySelector('.ql-modal-btn-cancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    modal.querySelector('.ql-modal-btn-save').addEventListener('click', function() {
      var url = urlInpQ ? urlInpQ.value.trim() : ''; if (!url) return;
      if (!/^https?:\/\//.test(url)) url = 'https://' + url;
      var lblv = lblInpQ ? lblInpQ.value.trim() : '';
      var arr = loadLinks();
      if (editIdx != null) arr[editIdx] = { url: url, label: lblv }; else arr.push({ url: url, label: lblv });
      saveLinksInst(arr); overlay.remove(); renderLinksInst();
    });
    [urlInpQ, lblInpQ].forEach(function(inp) {
      if (!inp) return;
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') modal.querySelector('.ql-modal-btn-save').click();
        if (e.key === 'Escape') overlay.remove();
      });
    });
  }

  if ((ntSettings.widgetTransparent || {})[instId]) el.classList.add('widget-transparent');
  makeDraggable(el);
  renderLinksInst();

  el.querySelector('.widget-close').addEventListener('click', function() {
    ntSettings.extraQuicklinks = (ntSettings.extraQuicklinks || []).filter(function(q) { return q.id !== instId; });
    delete ntSettings.widgets[instId]; delete ntSettings.widgetOpen[instId];
    delete ntSettings.widgetPositions[instId];
    if (ntSettings.widgetPage) delete ntSettings.widgetPage[instId];
    if (ntSettings.widgetTransparent) delete ntSettings.widgetTransparent[instId];
    var remaining = ntSettings.extraQuicklinks.length;
    if (remaining === 0 && !document.getElementById('widget-quicklinks')) {
      ntSettings.widgets.quicklinks = false; ntSettings.widgetOpen.quicklinks = false;
      var chkQ = document.getElementById('chk-quicklinks'); if (chkQ) chkQ.checked = false;
      var dockQ = document.querySelector('[data-dock-id="quicklinks"] .dock-widget-toggle');
      if (dockQ) dockQ.className = 'dock-widget-toggle';
    }
    saveSettings(); el.remove(); renderWidgetDock();
  });
  renderWidgetDock();
}

console.log('checkpoint 25');
// Restore extra instances on load — also prune stale/zombie entries
(function restoreExtraInstances() {
  ntSettings.extraNotes = (ntSettings.extraNotes || []).filter(function(e) {
    return ntSettings.widgets[e.id] === true;
  });
  ntSettings.extraTodos = (ntSettings.extraTodos || []).filter(function(e) {
    return ntSettings.widgets[e.id] === true;
  });
  ntSettings.extraQuicklinks = (ntSettings.extraQuicklinks || []).filter(function(e) {
    return ntSettings.widgets[e.id] === true;
  });
  saveSettings();

  var anim = ntSettings.widgetAnimation || 'fade-up';
  var animClass = anim === 'fade' ? 'widget-entering-fade' : anim === 'scale' ? 'widget-entering-scale' : anim === 'none' ? '' : 'widget-entering-fade-up';
  function _fadeIn(el, instId) {
    if (!el) return;
    el.style.display = 'block';
    el.style.removeProperty('opacity');
  }
  // Spawn immediately; double-rAF ensures layout is computed before position restore
  (ntSettings.extraNotes || []).forEach(function(entry) {
    _spawnNotesWidget(entry.id, entry.title || "Notes");
    var shouldShow = ntSettings.widgets.notes !== false && ntSettings.widgetOpen[entry.id] !== false;
    if (!shouldShow) {
      var el = document.getElementById('widget-' + entry.id);
      if (el) { el.style.display = 'none'; el.style.removeProperty('opacity'); }
    } else {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          var el2 = document.getElementById('widget-' + entry.id);
          restoreWidgetPos(entry.id);
          _fadeIn(el2, entry.id);
        });
      });
    }
  });
  (ntSettings.extraTodos || []).forEach(function(entry) {
    _spawnTodoWidget(entry.id, entry.title || "To-Do");
    var shouldShow = ntSettings.widgets.todo !== false && ntSettings.widgetOpen[entry.id] !== false;
    if (!shouldShow) {
      var el = document.getElementById('widget-' + entry.id);
      if (el) { el.style.display = 'none'; el.style.removeProperty('opacity'); }
    } else {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          var el2 = document.getElementById('widget-' + entry.id);
          restoreWidgetPos(entry.id);
          if (el2) { el2.style.display = 'block'; el2.style.removeProperty('opacity'); }
        });
      });
    }
  });
})();
  (ntSettings.extraQuicklinks || []).forEach(function(entry) {
    _spawnQuicklinksWidget(entry.id);
    var shouldShowQ = ntSettings.widgets.quicklinks !== false && ntSettings.widgetOpen[entry.id] !== false;
    if (!shouldShowQ) {
      var elQ = document.getElementById('widget-' + entry.id);
      if (elQ) { elQ.style.display = 'none'; elQ.style.removeProperty('opacity'); }
    } else {
      requestAnimationFrame(function() { requestAnimationFrame(function() {
        var elQ2 = document.getElementById('widget-' + entry.id);
        restoreWidgetPos(entry.id);
        if (elQ2) { elQ2.style.display = 'block'; elQ2.style.removeProperty('opacity'); }
      }); });
    }
  });
console.log('checkpoint 26');
// (duplicate widget buttons removed — use the + button inside each widget header/footer instead)

// ── Late widget inits (must run after postWidgetSetup and all scripts loaded) ──