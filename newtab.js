// ══ EXTENDED HISTORY BRIDGE ══════════════════════════════════════════════
const EH_EXTENSION_ID = 'cafkcdbcpedhmjmnkbgkecahgkoclhji';
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
  const r = await ehSend({ type: 'GET_SETTINGS' });
  ehAvailable = !!(r && !r.error);
  applyEhAvailability();
}

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
  if (!ehAvailable) loadTopSitesFallbackNative();
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
  enablePage2: true,
  showSearch: true, showClockWeather: false, hiResFeed: true,
  randomWallpaper: true, uiFontSize: 100, clockTopOffset: 0,
  wpAnimation: 'none', clockAnimation: 'none',
  grain: false, grainOpacity: 10, grainSize: 200,
  showExtraClocks: false, extraClocks: [],
  wordLang1: 'English', wordLang2: 'French',
  widgetFade: false, showWidgetDock: true, widgetTransparent: {},
  widgets: { weather: false, timer: false, notes: false, currency: false, quotes: false, learn: false, merriam: false, quicklinks: false, todo: false, calendar: false, crypto: false },
  widgetOpen: { weather: true, timer: true, notes: true, currency: true, quotes: true, learn: true, merriam: true, quicklinks: true, todo: true, calendar: true, crypto: true },
  weatherCity: '', widgetPositions: {}
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

function saveSettings() {
  LS.set('nt_settings', ntSettings);
  // Mirror randomWallpaper flag to chrome.storage.local so the background
  // service worker can check it without access to localStorage.
  csSet('nt_settings', { randomWallpaper: ntSettings.randomWallpaper });
}


// ════════════════════════════════════════════ CLOCK
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
  const clockEl = document.getElementById('clock-time');
  const dateEl  = document.getElementById('clock-date');
  const block   = document.getElementById('clock-block');
  if (clockEl) clockEl.style.display = ntSettings.showClock === false ? 'none' : '';
  if (dateEl)  dateEl.style.display  = ntSettings.showDate  === false ? 'none' : '';
  if (block)   block.style.display   = (ntSettings.showClock === false && ntSettings.showDate === false) ? 'none' : '';
  const tc = document.getElementById('toggle-clock');
  const td = document.getElementById('toggle-date');
  if (tc) tc.checked = ntSettings.showClock !== false;
  if (td) td.checked = ntSettings.showDate  !== false;
}

function applyClockTop() {
  const val = ntSettings.clockTopOffset || 0;
  document.documentElement.style.setProperty('--clock-top-offset', val + 'px');
  const slider = document.getElementById('clock-top-slider');
  const label  = document.getElementById('clock-top-label');
  if (slider) slider.value = val;
  if (label)  label.textContent = val + 'px';
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
    const labels = { google: 'Google', bing: 'Bing', custom: 'Custom' };
    searchInput.placeholder = 'Search with ' + (labels[engine] || 'Google') + ' or type a URL…';
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

// ════════════════════════════════════════════ ACCENT
function applyAccent() {
  document.documentElement.style.setProperty('--accent', ntSettings.accent);
  document.querySelectorAll('.accent-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.color === ntSettings.accent));
}
document.querySelectorAll('.accent-swatch').forEach(s =>
  s.addEventListener('click', () => { ntSettings.accent = s.dataset.color; applyAccent(); saveSettings(); }));
applyAccent();

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

document.querySelectorAll('.wallpaper-thumb').forEach(t =>
  t.addEventListener('click', () => {
    ntSettings.wallpaper = t.dataset.wp;
    applyWallpaper(true);
    saveSettings();
    // Cache the selected wallpaper blob so next paint is instant
    if (t.dataset.wp && t.dataset.wp !== 'none') {
      fetch(t.dataset.wp).then(r => r.blob()).then(blob => {
        const reader = new FileReader();
        reader.onload = () => csSet(WP_CURRENT_KEY, { url: t.dataset.wp, dataUrl: reader.result });
        reader.readAsDataURL(blob);
      }).catch(() => {});
    }
  }));
document.getElementById('wp-upload').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { ntSettings.wallpaper = ev.target.result; applyWallpaper(true); saveSettings(); };
  reader.readAsDataURL(file);
});
applyWallpaper(false);
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
document.getElementById('search-custom-url').addEventListener('input', e => { ntSettings.searchCustom = e.target.value.trim(); saveSettings(); });

// Clock top slider
document.getElementById('clock-top-slider').addEventListener('input', e => {
  ntSettings.clockTopOffset = parseInt(e.target.value); applyClockTop(); saveSettings();
});


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
    ntSettings.randomWallpaper = e.target.checked; saveSettings();
    if (ntSettings.randomWallpaper) applyRandomWallpaper(); else applyWallpaper(true);
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
})();



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
function getFaviconUrl(domain) { return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64'; }
function getFaviconUrlSm(domain) { return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=32'; }

// ════════════════════════════════════════════ TOP SITES
function getIgnoreList() { return LS.get('nt_topsites_ignore', []); }
function saveIgnoreList(list) { LS.set('nt_topsites_ignore', list); }
function addToIgnoreList(domain) {
  const list = getIgnoreList();
  if (!list.includes(domain)) { list.push(domain); saveIgnoreList(list); }
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
    const label  = site.title || domain;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-flex;';
    const el = document.createElement('a');
    el.className = 'site-icon'; el.href = site.url; el.title = label;
    const img = document.createElement('img'); img.src = getFaviconUrl(domain); img.alt = '';
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

const TOPSITES_CACHE_KEY = 'nt_topsites_cache';
function loadTopSites() {
  const block = document.getElementById('topsites-block');
  if (!ntSettings.showTopsites) { block.style.display = 'none'; return; }
  block.style.display = '';
  const cached = LS.get(TOPSITES_CACHE_KEY, null);
  if (cached && cached.sites && cached.sites.length) renderTopSites(cached.sites);
  if (ehAvailable) {
    ehSend({ type: 'GET_MOST_VISITED', viewType: 'domain', period: 'all' }).then(r => {
      if (!r || !r.items || !r.items.length) { if (!cached) loadFallbackTopSites(); return; }
      const fresh = r.items.map(item => ({ domain: item.identifier, url: 'https://' + item.identifier, title: item.title || item.identifier }));
      const n = ntSettings.topsitesCount;
      const freshKey  = fresh.slice(0, n).map(s => s.domain).join(',');
      const cachedKey = cached ? (cached.sites || []).slice(0, n).map(s => s.domain).join(',') : '';
      if (freshKey !== cachedKey) { renderTopSites(fresh); LS.set(TOPSITES_CACHE_KEY, { sites: fresh, ts: Date.now() }); }
    });
  }
}
function loadTopSitesFallbackNative() {
  const block = document.getElementById('topsites-block');
  if (!ntSettings.showTopsites) { block.style.display = 'none'; return; }
  block.style.display = '';
  const cached = LS.get(TOPSITES_CACHE_KEY, null);
  if (cached && cached.sites && cached.sites.length) renderTopSites(cached.sites);
  if (typeof chrome === 'undefined' || !chrome.history) { if (!cached) loadFallbackTopSites(); return; }
  const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  chrome.history.search({ text: '', startTime, maxResults: 500 }, items => {
    if (!items || !items.length) { if (!cached) loadFallbackTopSites(); return; }
    const counts = {}, info = {};
    items.forEach(item => {
      try {
        const u = new URL(item.url);
        const d = u.hostname.replace(/^www\./, '');
        if (!d || d.startsWith('chrome') || d.startsWith('about')) return;
        counts[d] = (counts[d] || 0) + (item.visitCount || 1);
        if (!info[d]) info[d] = { domain: d, url: u.origin, title: item.title || d };
      } catch {}
    });
    const fresh = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([d]) => info[d]);
    if (!fresh.length) { if (!cached) loadFallbackTopSites(); return; }
    renderTopSites(fresh);
    LS.set(TOPSITES_CACHE_KEY, { sites: fresh, ts: Date.now() });
  });
}
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
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
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

// ════════════════════════════════════════════ WIDGET FADE + DOCK TOGGLE
function applyWidgetFade() {
  document.body.classList.toggle('widget-fade-on', !!ntSettings.widgetFade);
  const tog = document.getElementById('toggle-widget-fade');
  if (tog) tog.checked = !!ntSettings.widgetFade;
}

function applyWidgetDockVisibility() {
  const dock = document.getElementById('widget-dock');
  const show = ntSettings.showWidgetDock !== false;
  if (dock) dock.style.display = show ? '' : 'none';
  const tog = document.getElementById('toggle-widget-dock');
  if (tog) tog.checked = show;
}

document.getElementById('toggle-widget-fade').addEventListener('change', e => {
  ntSettings.widgetFade = e.target.checked; applyWidgetFade(); saveSettings();
});
document.getElementById('toggle-widget-dock').addEventListener('change', e => {
  ntSettings.showWidgetDock = e.target.checked; applyWidgetDockVisibility(); renderWidgetDock(); saveSettings();
});
applyWidgetFade();
applyWidgetDockVisibility();
document.getElementById('toggle-clock').addEventListener('change', e => { ntSettings.showClock = e.target.checked; applyClockVisibility(); saveSettings(); });
document.getElementById('toggle-date').addEventListener('change', e => { ntSettings.showDate = e.target.checked; applyClockVisibility(); saveSettings(); });
applyClockVisibility();
applyClockTop();

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
  weather:    { icon: '🌤', label: 'Weather' },
  timer:      { icon: '⏱', label: 'Timer' },
  notes:      { icon: '📝', label: 'Notes' },
  currency:   { icon: '💱', label: 'Currency' },
  quotes:     { icon: '💬', label: 'Quotes' },
  learn:      { icon: '🔤', label: 'Learn Language' },
  merriam:    { icon: '📖', label: 'Word of the Day' },
  quicklinks: { icon: '🔗', label: 'Quick Links' },
  todo:       { icon: '✅', label: 'To-Do' },
  calendar:   { icon: '📅', label: 'Calendar' },
  crypto:     { icon: '₿',  label: 'Crypto' },
};

// ════════════════════════════════════════════ WIDGET DOCK
function applyWidgetDockVisibility() {
  const dock = document.getElementById('widget-dock');
  if (!dock) return;
  const show = ntSettings.showWidgetDock !== false;
  dock.style.display = show ? '' : 'none';
}

function renderWidgetDock() {
  const dock = document.getElementById('widget-dock');
  if (!dock) return;
  dock.innerHTML = '';
  if (ntSettings.showWidgetDock === false) return;
  Object.keys(WIDGET_DOCK_META).forEach(id => {
    if (!ntSettings.widgets[id]) return;
    const meta = WIDGET_DOCK_META[id];
    // Gather all instances for notes/todo (base + extras)
    const instances = _getWidgetInstances(id);
    const anyOpen = instances.some(el => el && el.style.display !== 'none');
    const btn = document.createElement('div');
    btn.className = 'dock-btn' + (anyOpen ? ' dock-active' : '');
    btn.innerHTML = `${meta.icon}<span class="dock-btn-tooltip">${meta.label}</span>`;
    btn.addEventListener('click', () => {
      if (anyOpen) {
        instances.forEach(el => { if (!el) return; el.style.display = 'none'; });
        ntSettings.widgetOpen[id] = false;
      } else {
        instances.forEach(el => {
          if (!el) return;
          el.style.display = 'block';
          ntSettings.widgetOpen[id] = true;
          restoreWidgetPos(el.id.replace('widget-', ''));
          bringWidgetToFront(el);
        });
      }
      saveSettings();
      renderWidgetDock();
    });
    dock.appendChild(btn);
  });
}

/** Return the widget element + all extra instances for a given base id */
function _getWidgetInstances(id) {
  const els = [];
  const w = document.getElementById('widget-' + id);
  if (w) els.push(w);
  if (id === 'notes') (ntSettings.extraNotes || []).forEach(e => { const el = document.getElementById('widget-' + e.id); if (el) els.push(el); });
  if (id === 'todo')  (ntSettings.extraTodos  || []).forEach(e => { const el = document.getElementById('widget-' + e.id); if (el) els.push(el); });
  return els;
}

// ════════════════════════════════════════════ WIDGETS
const ALL_WIDGETS = ['weather','timer','notes','currency','quotes','learn','merriam','quicklinks','todo','calendar','crypto'];

// Enable/disable widget (checkbox toggle)
function toggleWidget(id, show) {
  ntSettings.widgets[id] = show;
  if (!show) {
    const w = document.getElementById('widget-' + id);
    if (w) w.style.display = 'none';
    ntSettings.widgetOpen[id] = false;
  } else {
    ntSettings.widgetOpen[id] = true;
    const w = document.getElementById('widget-' + id);
    if (w) {
      // Always open on page-main unless this widget was explicitly saved to page 2
      const savedPage = (ntSettings.widgetPage || {})[id];
      if (savedPage !== 1) {
        // Ensure it's in page-main
        const page1 = document.getElementById('page-main');
        if (page1 && w.parentElement !== page1) page1.appendChild(w);
        if (savedPage === undefined) delete (ntSettings.widgetPage || {})[id];
      }
      w.style.display = 'block';
      restoreWidgetPos(id);
    }
  }
  saveSettings();
  renderWidgetDock();
}

function bringWidgetToFront(widget) {
  document.querySelectorAll('.widget').forEach(w => w.classList.remove('widget-focused'));
  widget.classList.add('widget-focused');
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
  // Reposition all enabled+open widgets, including collision-hidden ones,
  // so their position is correct when checkWidgetVisibility re-evaluates
  ALL_WIDGETS.forEach(id => {
    const w = document.getElementById('widget-' + id);
    if (!w) return;
    if (!ntSettings.widgets[id] || ntSettings.widgetOpen[id] === false) return;
    restoreWidgetPos(id);
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

  ALL_WIDGETS.forEach(id => {
    const w = document.getElementById('widget-' + id);
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

    const prevDisplay = w.style.display;
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

// ════════════════════════════════════════════ WIDGET SCRIPTS BOOTSTRAP
// Each widget is a self-contained .js file that:
//   (a) immediately injects its own HTML via an IIFE at the bottom of the file
//   (b) exposes window.initWidget_<id>() for the logic wiring
// This bootstrap loads scripts for enabled widgets, then calls their init fns.

const WIDGET_SCRIPTS = {
  weather:    'widgets/weather.js',
  timer:      'widgets/timer.js',
  notes:      'widgets/notes.js',
  currency:   'widgets/currency.js',
  quotes:     'widgets/quotes.js',
  learn:      'widgets/learn.js',
  merriam:    'widgets/merriam.js',
  quicklinks: 'widgets/quicklinks.js',
  todo:       'widgets/todo.js',
  calendar:   'widgets/calendar.js',
  crypto:     'widgets/crypto.js',
};

function loadWidgetScript(src) {
  return new Promise(resolve => {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => { console.warn('[widgets] failed:', src); resolve(); };
    document.head.appendChild(s);
  });
}

/** Load + init a single widget on demand (e.g. user enables it in settings). */
async function loadWidget(id) {
  const src = WIDGET_SCRIPTS[id];
  if (!src) return;
  await loadWidgetScript(src);
  const init = window['initWidget_' + id];
  if (typeof init === 'function') init();
}

(async function bootstrapWidgets() {
  // Always-on utility: ignorelist
  await loadWidgetScript('widgets/ignorelist.js');
  const initIL = window.initWidget_ignorelist;
  if (typeof initIL === 'function') initIL();

  // Load + init all currently-enabled widgets in parallel
  const enabled = ALL_WIDGETS.filter(id => ntSettings.widgets[id]);
  await Promise.all(enabled.map(id => loadWidgetScript(WIDGET_SCRIPTS[id])));
  for (const id of enabled) {
    const init = window['initWidget_' + id];
    if (typeof init === 'function') init();
  }

  postWidgetSetup();
})();

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

  // Transparent toggle buttons
  document.querySelectorAll('.widget-transparent-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const w = document.getElementById(btn.dataset.target);
      if (!w) return;
      const on = w.classList.toggle('widget-transparent');
      if (!ntSettings.widgetTransparent) ntSettings.widgetTransparent = {};
      ntSettings.widgetTransparent[btn.dataset.target.replace('widget-', '')] = on;
      saveSettings();
    });
  });

  // Restore saved transparent state
  ['quotes','learn','merriam'].forEach(id => {
    const w = document.getElementById('widget-' + id);
    if (w) w.classList.toggle('widget-transparent', !!(ntSettings.widgetTransparent||{})[id]);
  });

  // Settings checkboxes — wire with on-demand loading
  ALL_WIDGETS.forEach(id => {
    const chk = document.getElementById('chk-' + id);
    if (!chk) return;
    chk.checked = !!ntSettings.widgets[id];
    chk.addEventListener('change', async e => {
      if (e.target.checked) {
        await loadWidget(id);
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
      w.style.display = show ? 'block' : 'none';
      if (show) { restoreWidgetPos(id); assignWidgetPage(id, w); }
    }
  });

  // toggle-page2
  var togP2 = document.getElementById("toggle-page2");
  if (togP2) {
    togP2.checked = ntSettings.enablePage2 !== false;
    togP2.addEventListener("change", function(e) {
      ntSettings.enablePage2 = e.target.checked; saveSettings();
      if (typeof window.applyPage2Enabled === "function") window.applyPage2Enabled();
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
}

// ════════════════════════════════════════════ SCROLL-SNAP TWO-PAGE SYSTEM
(function initScrollPages() {
  const pagesEl = document.getElementById('pages');
  const page1   = document.getElementById('page-main');
  const page2   = document.getElementById('page-workspace');
  if (!pagesEl || !page1 || !page2) return;

  function applyPage2Enabled() {
    const on = ntSettings.enablePage2 !== false;
    page2.style.display = on ? '' : 'none';
    // scroll-snap-type only works when there are snappable children
    pagesEl.style.overflowY = on ? 'scroll' : 'hidden';
    const hint = document.getElementById('scroll-hint');
    if (hint) hint.style.display = on ? '' : 'none';
    if (!on && pagesEl.scrollTop > 0) pagesEl.scrollTo({ top: 0, behavior: 'instant' });
    const tog = document.getElementById('toggle-page2');
    if (tog) tog.checked = on;
  }

  let currentPage = 0;
  function update() {
    const onPage2 = pagesEl.scrollTop > page1.offsetHeight / 2;
    pagesEl.classList.toggle('page2-active', onPage2);
    currentPage = onPage2 ? 1 : 0;
  }
  pagesEl.addEventListener('scroll', update, { passive: true });
  update();
  applyPage2Enabled();

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

// ════════════════════════════════════════════ DUPLICATE NOTES / TODO
// Extra instances of notes/todo. Spawner functions call into widget JS.

if (!ntSettings.extraNotes) ntSettings.extraNotes = [];
if (!ntSettings.extraTodos) ntSettings.extraTodos = [];

function _genInstanceId(base) { return base + "_" + Date.now().toString(36); }
function _esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function addNotesInstance(title) {
  var instId = _genInstanceId("notes");
  ntSettings.extraNotes.push({ id: instId, title: title || "Notes" });
  ntSettings.widgets[instId] = true; ntSettings.widgetOpen[instId] = true;
  saveSettings(); _spawnNotesWidget(instId, title || "Notes");
}
function addTodoInstance(title) {
  var instId = _genInstanceId("todo");
  ntSettings.extraTodos.push({ id: instId, title: title || "To-Do" });
  ntSettings.widgets[instId] = true; ntSettings.widgetOpen[instId] = true;
  saveSettings(); _spawnTodoWidget(instId, title || "To-Do");
}

function _spawnNotesWidget(instId, title) {
  if (document.getElementById("widget-" + instId)) return;
  var div = document.createElement("div");
  div.innerHTML =
    '<div class="widget" id="widget-' + instId + '" style="display:block;">' +
    '<div class="widget-header"><span>\uD83D\uDCDD</span>' +
    '<span class="widget-title">' + _esc(title) + '</span>' +
    '<button class="widget-close" data-close="' + instId + '">&times;</button></div>' +
    '<textarea class="notes-area" id="notes-area-' + instId + '" placeholder="Jot something down\u2026" spellcheck="false"></textarea>' +
    '<div class="notes-footer"><span id="notes-char-count-' + instId + '">0 chars</span>' +
    '<span class="notes-saved" id="notes-saved-' + instId + '" style="opacity:0">Saved \u2713</span></div>' +
    '</div>';
  var el = div.firstElementChild;
  (document.getElementById("page-main") || document.body).appendChild(el);
  if (typeof window._initNotesInstance === "function") window._initNotesInstance(instId);
  if (typeof window._makeNotesTitleEditable === "function") window._makeNotesTitleEditable(el, instId, ntSettings.extraNotes);
  makeDraggable(el);
  el.querySelector(".widget-close").addEventListener("click", function() {
    ntSettings.extraNotes = (ntSettings.extraNotes || []).filter(function(n) { return n.id !== instId; });
    delete ntSettings.widgets[instId]; delete ntSettings.widgetOpen[instId];
    delete ntSettings.widgetPositions[instId];
    if (ntSettings.widgetPage) delete ntSettings.widgetPage[instId];
    saveSettings(); el.remove(); renderWidgetDock();
  });
  renderWidgetDock();
}

function _spawnTodoWidget(instId, title) {
  if (document.getElementById("widget-" + instId)) return;
  var div = document.createElement("div");
  div.innerHTML =
    '<div class="widget" id="widget-' + instId + '" style="display:block;">' +
    '<div class="widget-header"><span>\u2705</span>' +
    '<span class="widget-title">' + _esc(title) + '</span>' +
    '<span id="todo-counter-' + instId + '" class="todo-header-counter"></span>' +
    '<button class="widget-close" data-close="' + instId + '">&times;</button></div>' +
    '<div id="todo-list-' + instId + '" class="todo-list"></div>' +
    '<div class="todo-footer">' +
    '<div class="todo-input-row">' +
    '<input type="text" id="todo-input-' + instId + '" class="todo-input" placeholder="New task\u2026" autocomplete="off" spellcheck="false">' +
    '<button id="todo-add-btn-' + instId + '" class="todo-add-btn" title="Add task">+</button>' +
    '</div>' +
    '<div class="todo-footer-btns">' +
    '<button id="todo-clear-done-' + instId + '" class="todo-clear-btn">Clear done</button>' +
    '</div>' +
    '</div></div>';
  var el = div.firstElementChild;
  (document.getElementById("page-main") || document.body).appendChild(el);
  if (typeof window._initTodoInstance === "function") window._initTodoInstance(instId);
  if (typeof window._makeTodoTitleEditable === "function") window._makeTodoTitleEditable(el, instId, ntSettings.extraTodos);
  makeDraggable(el);
  el.querySelector(".widget-close").addEventListener("click", function() {
    ntSettings.extraTodos = (ntSettings.extraTodos || []).filter(function(t) { return t.id !== instId; });
    delete ntSettings.widgets[instId]; delete ntSettings.widgetOpen[instId];
    delete ntSettings.widgetPositions[instId];
    if (ntSettings.widgetPage) delete ntSettings.widgetPage[instId];
    saveSettings(); el.remove(); renderWidgetDock();
  });
  renderWidgetDock();
}

// Restore extra instances on load — also prune stale/zombie entries
(function restoreExtraInstances() {
  // Prune entries explicitly disabled by user (widget[id] === false)
  // and orphan entries from old broken sessions (id exists in extraNotes but widget
  // was disabled=false or explicitly removed).
  ntSettings.extraNotes = (ntSettings.extraNotes || []).filter(function(e) {
    return ntSettings.widgets[e.id] !== false;
  });
  ntSettings.extraTodos = (ntSettings.extraTodos || []).filter(function(e) {
    return ntSettings.widgets[e.id] !== false;
  });
  saveSettings();
  setTimeout(function() {
    (ntSettings.extraNotes || []).forEach(function(entry) {
      _spawnNotesWidget(entry.id, entry.title || "Notes");
    });
    (ntSettings.extraTodos || []).forEach(function(entry) {
      _spawnTodoWidget(entry.id, entry.title || "To-Do");
    });
  }, 200);
})();

// + duplicate buttons in settings panel
(function addDuplicateButtons() {
  setTimeout(function() {
    ["notes","todo"].forEach(function(base) {
      var row = document.querySelector(".widget-toggle-row[for=\"chk-" + base + "\"]");
      if (!row || row.querySelector(".dup-btn")) return;
      var btn = document.createElement("button");
      btn.className = "dup-btn"; btn.title = "Duplicate"; btn.textContent = "+";
      btn.style.cssText = "margin-left:6px;background:none;border:1px solid var(--glass-border);border-radius:6px;color:var(--text2);padding:2px 7px;font-size:0.8rem;cursor:pointer;flex-shrink:0;";
      btn.addEventListener("click", function(e) {
        e.preventDefault(); e.stopPropagation();
        var name = prompt("Name for the new " + (base === "notes" ? "Notes" : "To-Do") + " widget:", base === "notes" ? "Notes" : "To-Do");
        if (name === null) return;
        if (base === "notes") addNotesInstance(name || "Notes");
        else addTodoInstance(name || "To-Do");
      });
      var toggle = row.querySelector(".toggle");
      if (toggle) row.insertBefore(btn, toggle); else row.appendChild(btn);
    });
  }, 100);
})();