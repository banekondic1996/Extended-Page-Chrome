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
  showSearch: true, showClockWeather: false, hiResFeed: false,
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
if (ntSettings.showDate   === undefined) ntSettings.showDate   = true;
if (ntSettings.showSearch === undefined) ntSettings.showSearch = true;
if (ntSettings.overlayOpacity === undefined) ntSettings.overlayOpacity = 72;

function saveSettings() { LS.set('nt_settings', ntSettings); }

// ════════════════════════════════════════════ WALLPAPER FIRST PAINT
// chrome.storage.local is async, so first-paint applies theme/overlay synchronously
// and then immediately reads the preloaded blob to paint the wallpaper as fast as possible.
// This runs before clocks, widgets, and all other init work.
(function wallpaperFirstPaint() {
  const bg = document.getElementById('wallpaper-bg');
  if (!bg) return;

  // Apply theme synchronously so there is no flash of wrong theme
  document.documentElement.setAttribute('data-theme', ntSettings.theme || 'dark');

  // Apply a neutral overlay immediately so the page doesn't flash unstyled
  const isLight = ntSettings.theme === 'light';
  const pct = isLight
    ? (ntSettings.overlayOpacityLight !== undefined ? ntSettings.overlayOpacityLight : 20)
    : (ntSettings.overlayOpacity      !== undefined ? ntSettings.overlayOpacity      : 72);
  const alpha = (pct / 100).toFixed(2);
  // Set overlay assuming a wallpaper will appear (corrected later by applyOverlayOpacity if not)
  document.documentElement.style.setProperty('--wallpaper-overlay',
    isLight ? `rgba(240,240,245,${alpha})` : `rgba(12,12,16,${alpha})`);

  // Read preloaded blob from chrome.storage.local and paint immediately
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const key = ntSettings.randomWallpaper ? 'nt_wp_next' : 'nt_wp_current';
    chrome.storage.local.get(key, result => {
      const entry = result[key];
      if (!entry || !entry.dataUrl) {
        // Nothing preloaded yet — applyRandomWallpaper() / applyWallpaper() will handle it
        return;
      }
      if (ntSettings.randomWallpaper) {
        bg.style.backgroundImage = "url('" + entry.dataUrl + "')";
        bg.dataset.wpFirstPaint = 'random';
      } else if (entry.url === ntSettings.wallpaper) {
        bg.style.backgroundImage = "url('" + entry.dataUrl + "')";
      }
    });
  } else {
    // Fallback for non-extension context: paint static wallpaper URL directly
    const wp = ntSettings.wallpaper;
    if (!ntSettings.randomWallpaper && wp && wp !== 'none') {
      bg.style.backgroundImage = "url('" + wp + "')";
    }
  }
})();

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
document.getElementById('toggle-hires-feed').addEventListener('change', e => { ntSettings.hiResFeed = e.target.checked; applyHiResFeed(); saveSettings(); });
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
    const w = document.getElementById('widget-' + id);
    const isOpen = ntSettings.widgetOpen[id] !== false && w && w.style.display !== 'none';
    const meta = WIDGET_DOCK_META[id];
    const btn = document.createElement('div');
    btn.className = 'dock-btn' + (isOpen ? ' dock-active' : '');
    btn.innerHTML = `${meta.icon}<span class="dock-btn-tooltip">${meta.label}</span>`;
    btn.addEventListener('click', () => {
      if (w) {
        const nowVisible = w.style.display !== 'none';
        if (nowVisible) {
          w.style.display = 'none';
          ntSettings.widgetOpen[id] = false;
        } else {
          w.style.display = 'block';
          ntSettings.widgetOpen[id] = true;
          restoreWidgetPos(id);
          bringWidgetToFront(w);
        }
        saveSettings();
      }
      renderWidgetDock();
    });
    dock.appendChild(btn);
  });
}

// ════════════════════════════════════════════ WIDGETS
const ALL_WIDGETS = ['weather','timer','notes','currency','quotes','learn','merriam','quicklinks','todo','calendar','crypto'];

// Enable/disable widget (checkbox toggle)
function toggleWidget(id, show) {
  ntSettings.widgets[id] = show;
  if (!show) {
    // disabling: hide widget entirely
    const w = document.getElementById('widget-' + id);
    if (w) w.style.display = 'none';
    ntSettings.widgetOpen[id] = false;
  } else {
    // enabling: restore to open state
    ntSettings.widgetOpen[id] = true;
    const w = document.getElementById('widget-' + id);
    if (w) { w.style.display = 'block'; restoreWidgetPos(id); }
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
    const x = Math.max(0, Math.min(window.innerWidth  - widget.offsetWidth,  e.clientX - ox));
    const y = Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, e.clientY - oy));
    widget.style.left = x + 'px'; widget.style.top = y + 'px';
    // Save as fractions of viewport so position survives resize
    const id = widget.id.replace('widget-', '');
    ntSettings.widgetPositions[id] = {
      xFrac: x / window.innerWidth,
      yFrac: y / window.innerHeight,
    };
    saveSettings();
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function restoreWidgetPos(id) {
  const pos = ntSettings.widgetPositions[id];
  const w   = document.getElementById('widget-' + id);
  if (!pos || !w) return;
  // Support both old pixel format and new fraction format
  const x = pos.xFrac != null
    ? Math.round(pos.xFrac * window.innerWidth)
    : (pos.left || 0);
  const y = pos.yFrac != null
    ? Math.round(pos.yFrac * window.innerHeight)
    : (pos.top || 0);
  // Clamp so widget stays inside viewport after resize
  const cx = Math.max(0, Math.min(window.innerWidth  - w.offsetWidth,  x));
  const cy = Math.max(0, Math.min(window.innerHeight - w.offsetHeight, y));
  w.style.left = cx + 'px'; w.style.top = cy + 'px';
  w.style.bottom = 'auto'; w.style.right = 'auto';
}

ALL_WIDGETS.forEach(id => {
  const el = document.getElementById('widget-' + id);
  if (el) makeDraggable(el);
});
makeDraggable(document.getElementById('widget-ignorelist'));

// Widget close buttons — collapse to dock, save open state
document.querySelectorAll('.widget-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.close;
    if (id === 'ignorelist') { document.getElementById('widget-ignorelist').style.display = 'none'; return; }
    const w = document.getElementById('widget-' + id);
    if (w) w.style.display = 'none';
    ntSettings.widgetOpen[id] = false;
    saveSettings();
    renderWidgetDock();
  });
});

// Widget transparent toggle buttons
const TRANSPARENT_WIDGETS = ['quotes', 'learn', 'merriam'];
function applyWidgetTransparent(id, on) {
  const w = document.getElementById('widget-' + id);
  if (w) w.classList.toggle('widget-transparent', on);
}
// Load saved transparent state
TRANSPARENT_WIDGETS.forEach(id => {
  const saved = ntSettings.widgetTransparent || {};
  applyWidgetTransparent(id, !!saved[id]);
});
document.querySelectorAll('.widget-transparent-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const id = btn.dataset.target;
    const w = document.getElementById(id);
    if (!w) return;
    const nowTransparent = w.classList.toggle('widget-transparent');
    if (!ntSettings.widgetTransparent) ntSettings.widgetTransparent = {};
    ntSettings.widgetTransparent[id.replace('widget-', '')] = nowTransparent;
    saveSettings();
  });
});
ALL_WIDGETS.forEach(id => {
  const chk = document.getElementById('chk-' + id);
  if (!chk) return;
  chk.addEventListener('change', e => {
    toggleWidget(id, e.target.checked);
    if (id === 'merriam' && e.target.checked) fetchMerriamWordOfDay();
  });
  chk.checked = !!ntSettings.widgets[id];
  // Show/hide based on both enabled AND open state
  const w = document.getElementById('widget-' + id);
  if (w) {
    const isEnabled = !!ntSettings.widgets[id];
    const isOpen = ntSettings.widgetOpen[id] !== false;
    w.style.display = (isEnabled && isOpen) ? 'block' : 'none';
    if (isEnabled && isOpen) restoreWidgetPos(id);
  }
});

// Fetch Merriam data on load if widget is enabled
if (ntSettings.widgets.merriam) fetchMerriamWordOfDay();

// ════════════════════════════════════════════ CLOCK FONT
const clockFontSel = document.getElementById('clock-font-sel');
if (clockFontSel) {
  clockFontSel.value = ntSettings.clockFont || 'mono';
  clockFontSel.addEventListener('change', e => { ntSettings.clockFont = e.target.value; applyClockFont(); saveSettings(); });
}
applyClockFont();

// ════════════════════════════════════════════ WEATHER SVG
function getWeatherSVG(code) {
  const c = parseInt(code);
  const isClear        = c === 113;
  const isPartlyCloudy = c === 116;
  const isCloudy       = c === 119 || c === 122;
  const isFog          = c === 143 || c === 248 || c === 260;
  const isThunder      = c === 200 || c === 386 || c === 389 || c === 392 || c === 395;
  const isSnow         = [179,182,185,281,284,311,314,317,320,323,326,329,332,335,338,350,368,371,374,377].includes(c);
  const isRain         = [176,263,266,293,296,299,302,305,308,353,356,359].includes(c);
  if (isThunder)      return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="22" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="26" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="26" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="32" width="30" height="7" rx="3.5" fill="#9ab0c0"/><polyline points="33,38 28,50 34,50 29,62" stroke="#ffe033" stroke-width="3" stroke-linejoin="round" fill="none" stroke-linecap="round"/><line x1="22" y1="40" x2="22" y2="56" stroke="#6ab0ff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/><line x1="42" y1="40" x2="42" y2="54" stroke="#6ab0ff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/></svg>`;
  if (isSnow)         return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="20" rx="18" ry="12" fill="#b0c4d8"/><ellipse cx="22" cy="24" rx="12" ry="9" fill="#c8d8e8"/><ellipse cx="42" cy="24" rx="11" ry="8" fill="#c8d8e8"/><rect x="17" y="30" width="30" height="7" rx="3.5" fill="#d8e8f4"/><circle cx="24" cy="50" r="3.5" fill="#aaccee"/><circle cx="32" cy="57" r="3.5" fill="#aaccee"/><circle cx="40" cy="50" r="3.5" fill="#aaccee"/></svg>`;
  if (isRain)         return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="20" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="24" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="24" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="30" width="30" height="7" rx="3.5" fill="#9ab0c0"/><line x1="24" y1="40" x2="21" y2="56" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/><line x1="32" y1="40" x2="29" y2="58" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/><line x1="40" y1="40" x2="37" y2="56" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  if (isFog)          return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="16" width="48" height="5" rx="2.5" fill="#9ab0c0" opacity="0.75"/><rect x="14" y="27" width="36" height="5" rx="2.5" fill="#9ab0c0" opacity="0.62"/><rect x="10" y="38" width="44" height="5" rx="2.5" fill="#9ab0c0" opacity="0.50"/><rect x="18" y="49" width="28" height="5" rx="2.5" fill="#9ab0c0" opacity="0.38"/></svg>`;
  if (isClear)        return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="13" fill="#ffe033"/><g stroke="#ffe033" stroke-width="2.5" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="13"/><line x1="32" y1="51" x2="32" y2="58"/><line x1="6" y1="32" x2="13" y2="32"/><line x1="51" y1="32" x2="58" y2="32"/><line x1="14" y1="14" x2="19" y2="19"/><line x1="45" y1="45" x2="50" y2="50"/><line x1="50" y1="14" x2="45" y2="19"/><line x1="19" y1="45" x2="14" y2="50"/></g></svg>`;
  if (isPartlyCloudy) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="36" r="11" fill="#ffe033"/><g stroke="#ffe033" stroke-width="2" stroke-linecap="round" opacity="0.85"><line x1="22" y1="12" x2="22" y2="17"/><line x1="22" y1="55" x2="22" y2="60"/><line x1="2" y1="36" x2="7" y2="36"/><line x1="37" y1="36" x2="42" y2="36"/><line x1="9" y1="23" x2="13" y2="27"/><line x1="31" y1="45" x2="35" y2="49"/><line x1="35" y1="23" x2="31" y2="27"/><line x1="13" y1="45" x2="9" y2="49"/></g><ellipse cx="43" cy="33" rx="14" ry="9" fill="#b0c0d0"/><ellipse cx="35" cy="36" rx="10" ry="7" fill="#c4d0dc"/><ellipse cx="51" cy="36" rx="9" ry="7" fill="#c4d0dc"/><rect x="30" y="38" width="26" height="6" rx="3" fill="#cad6e2"/></svg>`;
  if (isCloudy)       return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="24" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="28" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="28" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="32" width="30" height="8" rx="4" fill="#9ab0c0"/></svg>`;
  return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="28" rx="18" ry="12" fill="#8fa0b0"/><ellipse cx="22" cy="32" rx="12" ry="9" fill="#9ab0c0"/><ellipse cx="42" cy="32" rx="11" ry="8" fill="#9ab0c0"/><rect x="17" y="36" width="30" height="8" rx="4" fill="#a0b0c0"/></svg>`;
}
function getWeatherSVGSmall(code) { return getWeatherSVG(code).replace(/width="48" height="48"/g, 'width="24" height="24"'); }

let weatherCity = ntSettings.weatherCity || '';
let lastWeatherData = null;

async function fetchWeather(city) {
  document.getElementById('weather-desc').textContent = 'Loading…';
  try {
    const res  = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const cur  = data.current_condition[0];
    const area = data.nearest_area[0];
    document.getElementById('weather-icon').innerHTML = getWeatherSVG(cur.weatherCode);
    const cityName    = area.areaName[0].value;
    const regionName  = (area.region && area.region[0]) ? area.region[0].value : '';
    const countryName = area.country[0].value;
    const locationStr = cityName + (regionName && regionName !== cityName ? ', ' + regionName : '') + ', ' + countryName;
    document.getElementById('weather-location').textContent = locationStr;
    document.getElementById('weather-temp').textContent = cur.temp_C + '°C / ' + cur.temp_F + '°F';
    document.getElementById('weather-desc').textContent = cur.weatherDesc[0].value;
    ntSettings.weatherCity = city; saveSettings();
    lastWeatherData = { code: cur.weatherCode, tempC: cur.temp_C, tempF: cur.temp_F, desc: cur.weatherDesc[0].value };
    updateClockWeatherInline();
  } catch { document.getElementById('weather-desc').textContent = 'City not found'; }
}
async function fetchWeatherForClock(city) {
  if (!city) return;
  try {
    const res  = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const cur  = data.current_condition[0];
    lastWeatherData = { code: cur.weatherCode, tempC: cur.temp_C, tempF: cur.temp_F, desc: cur.weatherDesc[0].value };
    updateClockWeatherInline();
  } catch {}
}
function updateClockWeatherInline() {
  const el = document.getElementById('clock-weather-inline');
  if (!ntSettings.showClockWeather || !lastWeatherData) { if (el) el.classList.remove('visible'); return; }
  if (el) el.classList.add('visible');
  const iconEl = document.getElementById('cwi-icon');
  const tempEl = document.getElementById('cwi-temp');
  const descEl = document.getElementById('cwi-desc');
  if (iconEl) iconEl.innerHTML = getWeatherSVGSmall(lastWeatherData.code);
  if (tempEl) tempEl.textContent = lastWeatherData.tempC + '°C';
  if (descEl) descEl.textContent = lastWeatherData.desc;
}
document.getElementById('toggle-clock-weather').addEventListener('change', e => {
  ntSettings.showClockWeather = e.target.checked; saveSettings(); updateClockWeatherInline();
  if (ntSettings.showClockWeather && !lastWeatherData) {
    const city = ntSettings.weatherCity || (document.getElementById('settings-weather-city') || {}).value;
    if (city) fetchWeatherForClock(city);
  }
});
document.getElementById('toggle-clock-weather').checked = !!ntSettings.showClockWeather;

const settingsWeatherCity = document.getElementById('settings-weather-city');
if (settingsWeatherCity) {
  settingsWeatherCity.value = ntSettings.weatherCity || '';
  let wcTimer;
  settingsWeatherCity.addEventListener('input', e => {
    clearTimeout(wcTimer);
    wcTimer = setTimeout(() => {
      const city = e.target.value.trim();
      if (city) { ntSettings.weatherCity = city; saveSettings(); fetchWeather(city); const wci = document.getElementById('weather-city'); if (wci) wci.value = city; }
    }, 600);
  });
}

// City autocomplete
const weatherCityInput = document.getElementById('weather-city');
let suggestionBox = null, suggestionItems = [], selectedSuggIdx = -1, debounceTimer = null;
function createSuggestionBox() {
  if (suggestionBox) return;
  suggestionBox = document.createElement('div');
  suggestionBox.className = 'city-suggestions'; suggestionBox.style.display = 'none';
  weatherCityInput.parentElement.appendChild(suggestionBox);
}
function hideSuggestions() { if (suggestionBox) suggestionBox.style.display = 'none'; selectedSuggIdx = -1; }
function showSuggestions(cities) {
  if (!suggestionBox) createSuggestionBox();
  suggestionBox.innerHTML = ''; suggestionItems = cities; selectedSuggIdx = -1;
  if (!cities.length) { suggestionBox.style.display = 'none'; return; }
  cities.forEach(c => {
    const item = document.createElement('div'); item.className = 'city-suggestion-item';
    const region = c.admin1 ? ', ' + c.admin1 : '';
    item.textContent = c.name + region + ', ' + c.country;
    item.addEventListener('mousedown', e => { e.preventDefault(); weatherCityInput.value = c.name; hideSuggestions(); fetchWeather(c.name + region + ', ' + c.country); });
    suggestionBox.appendChild(item);
  });
  suggestionBox.style.display = 'block';
}
async function fetchCitySuggestions(query) {
  if (query.length < 2) { hideSuggestions(); return; }
  try {
    const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=6&language=en&format=json');
    if (!res.ok) return;
    const data = await res.json();
    showSuggestions((data.results || []).map(r => ({ name: r.name, admin1: r.admin1 || '', country: r.country || '' })));
  } catch { hideSuggestions(); }
}
weatherCityInput.value = weatherCity;
weatherCityInput.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fetchCitySuggestions(weatherCityInput.value.trim()), 280); });
weatherCityInput.addEventListener('keydown', e => {
  const items = suggestionBox ? suggestionBox.querySelectorAll('.city-suggestion-item') : [];
  if (e.key === 'ArrowDown') { e.preventDefault(); selectedSuggIdx = Math.min(selectedSuggIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('selected', i === selectedSuggIdx)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selectedSuggIdx = Math.max(selectedSuggIdx - 1, -1); items.forEach((it, i) => it.classList.toggle('selected', i === selectedSuggIdx)); }
  else if (e.key === 'Enter') { if (selectedSuggIdx >= 0 && items[selectedSuggIdx]) items[selectedSuggIdx].dispatchEvent(new MouseEvent('mousedown')); else { const city = weatherCityInput.value.trim(); if (city) { hideSuggestions(); fetchWeather(city); } } }
  else if (e.key === 'Escape') hideSuggestions();
});
weatherCityInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));
createSuggestionBox();
if (weatherCity) fetchWeather(weatherCity);
else if (ntSettings.showClockWeather && ntSettings.weatherCity) fetchWeatherForClock(ntSettings.weatherCity);

// ════════════════════════════════════════════ TIMER WIDGET
let timerInterval = null, timerTotal = 0, timerRemaining = 0, timerRunning = false;
const CIRCUMFERENCE = 2 * Math.PI * 36;

// Timer beep using Web Audio API
function playTimerBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beepTimes = [0, 0.3, 0.6];
    beepTimes.forEach(t => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.6, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

function formatTimerTime(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function updateTimerDisplay() {
  document.getElementById('timer-display').textContent = formatTimerTime(timerRemaining);
  const ring = document.getElementById('timer-ring');
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
    if (raw.includes(':')) { const parts = raw.split(':'); if (parts.length === 2) secs = parseInt(parts[0]||0)*60+parseInt(parts[1]||0); else if (parts.length === 3) secs = parseInt(parts[0]||0)*3600+parseInt(parts[1]||0)*60+parseInt(parts[2]||0); }
    else secs = Math.round(parseFloat(raw) * 60) || 0;
    if (secs <= 0) return;
    timerTotal = secs; timerRemaining = secs;
    document.getElementById('timer-ring').style.strokeDashoffset = 0;
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
function formatSWTime(ms) {
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
    swInterval = setInterval(() => { swMs = Date.now() - t0; document.getElementById('stopwatch-display').textContent = formatSWTime(swMs); }, 100);
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
  row.innerHTML = `<span>Lap ${swLapCount}</span><span>${formatSWTime(lapTime)}</span><span>${formatSWTime(swMs)}</span>`;
  lapsEl.insertBefore(row, lapsEl.firstChild);
});
document.getElementById('sw-reset-btn').addEventListener('click', () => {
  clearInterval(swInterval); swRunning = false; swMs = 0; swLapCount = 0; swLastLap = 0;
  document.getElementById('stopwatch-display').textContent = '00:00.0';
  document.getElementById('sw-start-btn').textContent = 'Start';
  document.getElementById('sw-status').textContent = 'Ready';
  document.getElementById('sw-laps').innerHTML = '';
});

// ════════════════════════════════════════════ IGNORE LIST
function renderIgnoreList() {
  const body = document.getElementById('ignorelist-body');
  if (!body) return;
  const list = getIgnoreList();
  body.innerHTML = '';
  if (!list.length) { body.innerHTML = '<div style="font-size:0.78rem;color:var(--text2);padding:8px 0;text-align:center;">No ignored sites</div>'; return; }
  list.forEach(domain => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--glass-border);';
    const img = document.createElement('img');
    img.src = getFaviconUrlSm(domain); img.style.cssText = 'width:16px;height:16px;border-radius:3px;flex-shrink:0;';
    img.addEventListener('error', () => img.style.display = 'none');
    const lbl = document.createElement('span'); lbl.textContent = domain;
    lbl.style.cssText = 'flex:1;font-size:0.78rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const restoreBtn = document.createElement('button'); restoreBtn.textContent = '×'; restoreBtn.title = 'Remove from ignore list';
    restoreBtn.style.cssText = 'background:none;border:none;color:var(--accent);font-size:1rem;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;';
    restoreBtn.addEventListener('click', () => { saveIgnoreList(getIgnoreList().filter(d => d !== domain)); renderIgnoreList(); loadTopSites(); });
    row.appendChild(img); row.appendChild(lbl); row.appendChild(restoreBtn);
    body.appendChild(row);
  });
}
document.getElementById('open-ignore-list-btn').addEventListener('click', () => {
  closeSettings();
  const w = document.getElementById('widget-ignorelist');
  w.style.display = 'block'; renderIgnoreList(); bringWidgetToFront(w);
  w.style.top = Math.max(60, (window.innerHeight - w.offsetHeight) / 2) + 'px';
  w.style.transform = '';
});
document.getElementById('ignorelist-clear-btn').addEventListener('click', () => { saveIgnoreList([]); renderIgnoreList(); loadTopSites(); });

// ════════════════════════════════════════════ NOTES
const notesArea      = document.getElementById('notes-area');
const notesCharCount = document.getElementById('notes-char-count');
const notesSaved     = document.getElementById('notes-saved');
let notesSaveTimer = null;
notesArea.value = LS.get('nt_notes', '') || '';
notesCharCount.textContent = notesArea.value.length + ' chars';
notesArea.addEventListener('input', () => {
  notesCharCount.textContent = notesArea.value.length + ' chars';
  notesSaved.style.opacity = '0';
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => { LS.set('nt_notes', notesArea.value); notesSaved.style.opacity = '1'; setTimeout(() => notesSaved.style.opacity = '0', 1500); }, 600);
});

// ════════════════════════════════════════════ CURRENCY WIDGET
const CURRENCIES = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','SEK','NOK','DKK','PLN','CZK','HUF','RON','BGN','HRK','RSD','RUB','TRY','BRL','MXN','INR','IDR','MYR','PHP','SGD','THB','ZAR','KRW','AED','SAR','ILS','NGN','EGP','PKR','BDT','VND','UAH','TWD','HKD'];
let exchangeRates = null, rateBase = 'USD';
function populateCurrencySelects() {
  ['currency-from','currency-to'].forEach((id, idx) => {
    const sel = document.getElementById(id); if (!sel) return;
    CURRENCIES.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.appendChild(opt); });
    sel.value = idx === 0 ? (ntSettings.currencyFrom || 'USD') : (ntSettings.currencyTo || 'EUR');
  });
}
populateCurrencySelects();
async function fetchExchangeRates() {
  const rateLabel = document.getElementById('currency-rate');
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error();
    const data = await res.json();
    exchangeRates = data.rates; rateBase = 'USD';
    if (rateLabel) rateLabel.textContent = 'Rates loaded • ' + new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'});
    convertCurrency();
  } catch { if (rateLabel) rateLabel.textContent = 'Could not load rates'; }
}
fetchExchangeRates();
setInterval(fetchExchangeRates, 30 * 60 * 1000);
function convertCurrency() {
  if (!exchangeRates) return;
  const amount = parseFloat(document.getElementById('currency-amount').value) || 0;
  const from   = document.getElementById('currency-from').value;
  const to     = document.getElementById('currency-to').value;
  if (!exchangeRates[from] || !exchangeRates[to]) return;
  const inUSD  = amount / exchangeRates[from];
  const result = inUSD * exchangeRates[to];
  const rate   = exchangeRates[to] / exchangeRates[from];
  document.getElementById('currency-result').textContent = result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ' + to;
  document.getElementById('currency-result-input').value = result.toFixed(4);
  document.getElementById('currency-rate').textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
  ntSettings.currencyFrom = from; ntSettings.currencyTo = to; saveSettings();
}
document.getElementById('currency-amount').addEventListener('input', convertCurrency);
document.getElementById('currency-from').addEventListener('change', convertCurrency);
document.getElementById('currency-to').addEventListener('change', convertCurrency);
document.getElementById('currency-swap').addEventListener('click', () => {
  const fromSel = document.getElementById('currency-from'), toSel = document.getElementById('currency-to');
  const tmp = fromSel.value; fromSel.value = toSel.value; toSel.value = tmp;
  convertCurrency();
});

// ════════════════════════════════════════════ QUOTES WIDGET
// QUOTES array is loaded from quotes.js

// Advance quote on every new tab/refresh — pick random index, avoid repeating last seen
const lastQuoteIdx = LS.get('nt_quote_last', -1);
let currentQuoteIdx = Math.floor(Math.random() * QUOTES.length);
if (currentQuoteIdx === lastQuoteIdx && QUOTES.length > 1) {
  currentQuoteIdx = (currentQuoteIdx + 1) % QUOTES.length;
}
LS.set('nt_quote_last', currentQuoteIdx);

function showQuote(idx, animate) {
  const textEl    = document.getElementById('quotes-text');
  const authorEl  = document.getElementById('quotes-author');
  const counterEl = document.getElementById('quotes-counter');
  if (!textEl) return;
  function set() {
    textEl.textContent   = QUOTES[idx].text;
    authorEl.textContent = '— ' + QUOTES[idx].author;
    if (counterEl) counterEl.textContent = (idx + 1) + ' / ' + QUOTES.length;
    textEl.classList.remove('fade-out'); authorEl.classList.remove('fade-out');
  }
  if (animate) {
    textEl.classList.add('fade-out'); authorEl.classList.add('fade-out');
    setTimeout(set, 350);
  } else set();
  currentQuoteIdx = idx;
  LS.set('nt_quote_last', idx);
}

document.getElementById('quotes-next').addEventListener('click', () => {
  showQuote((currentQuoteIdx + 1) % QUOTES.length, true);
});
showQuote(currentQuoteIdx, false);

// ════════════════════════════════════════════ LEARN LANGUAGE WIDGET
// WORD_LIST is loaded from words.js (3015 words)

// Language name → MyMemory lang code
const LANG_CODES = {
  'English':    'en', 'Spanish':   'es', 'French':     'fr', 'German':  'de',
  'Italian':    'it', 'Portuguese':'pt', 'Dutch':      'nl', 'Russian': 'ru',
  'Polish':     'pl', 'Swedish':   'sv', 'Norwegian':  'no', 'Danish':  'da',
  'Finnish':    'fi', 'Turkish':   'tr', 'Arabic':     'ar', 'Japanese':'ja',
  'Chinese':    'zh', 'Korean':    'ko', 'Hindi':      'hi', 'Greek':   'el',
  'Latin':      'la', 'Serbian':    'sr',
};


// Advance word on every new tab using a shuffled permutation (no repeats until all seen)
const WORD_PERM_KEY = 'nt_word_perm';
const WORD_POS_KEY  = 'nt_word_pos';

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextWordIdx() {
  let perm = LS.get(WORD_PERM_KEY, null);
  let pos  = LS.get(WORD_POS_KEY,  0) || 0;
  if (!perm || perm.length !== WORD_LIST.length || pos >= perm.length) {
    perm = shuffleArray(WORD_LIST.map((_, i) => i));
    pos  = 0;
    LS.set(WORD_PERM_KEY, perm);
  }
  const idx = perm[pos];
  LS.set(WORD_POS_KEY, pos + 1);
  return idx;
}

let currentWordIdx = getNextWordIdx();

// Translation cache: key = "word|fromCode|toCode"
const WORD_CACHE_KEY = 'nt_word_cache';
function getWordCache() { return LS.get(WORD_CACHE_KEY, {}); }
function setWordCache(cache) { LS.set(WORD_CACHE_KEY, cache); }

// ════════════════════════════════════════════ TRANSLATION + SPEECH
// Uses the unofficial Google Translate endpoint — same one Chrome extension uses.
// No API key needed. Works for all languages including Latin.
// Google TTS endpoint returns an mp3 directly — also no key needed.

async function translateWord(word, fromCode, toCode) {
  if (fromCode === toCode) return word;
  const cacheKey = `${word}|${fromCode}|${toCode}`;
  const cache = getWordCache();
  if (cache[cacheKey]) return cache[cacheKey];
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromCode}&tl=${toCode}&dt=t&q=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // Response shape: [[[translatedText, originalText, ...],...], ...]
    const translated = data?.[0]?.[0]?.[0];
    if (!translated) throw new Error('empty');
    const clean = sanitizeText(translated).trim();
    if (!clean) throw new Error('blank');
    cache[cacheKey] = clean;
    setWordCache(cache);
    return clean;
  } catch {
    return word; // fall back to original on any error
  }
}

// Build Google TTS audio URL — returns mp3 directly, no key needed
function googleTTSUrl(text, langCode) {
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=gtx`;
}

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
    const safeW1 = sanitizeText(w1);
    const safeW2 = sanitizeText(w2);
    const cap1 = safeW1.charAt(0).toUpperCase() + safeW1.slice(1);
    const cap2 = safeW2.charAt(0).toUpperCase() + safeW2.slice(1);
    // Store for speak button (skip placeholder '…')
    if (cap2 !== '…') {
      window._learnLastW1 = cap1;
      window._learnLastW2 = cap2;
      window._learnCode1  = code1;
      window._learnCode2  = code2;
    }
    if (animate) {
      pairEl.classList.add('fade-out');
      setTimeout(() => {
        pairEl.innerHTML = `${cap1}<span class="word-separator">–</span>${cap2}`;
        pairEl.classList.remove('fade-out');
      }, 350);
    } else {
      pairEl.innerHTML = `${cap1}<span class="word-separator">–</span>${cap2}`;
    }
  };

  const capWord = word.charAt(0).toUpperCase() + word.slice(1);
  applyWords(capWord, '…');

  const [w1, w2] = await Promise.all([
    code1 === 'en' ? Promise.resolve(capWord) : translateWord(word, 'en', code1),
    code2 === 'en' ? Promise.resolve(capWord) : translateWord(word, 'en', code2),
  ]);

  applyWords(w1, w2);
}

document.getElementById('word-next').addEventListener('click', () => {
  currentWordIdx = (currentWordIdx + 1) % WORD_LIST.length;
  showLearnWord(currentWordIdx, true);
});

// ── SPEAK BUTTON — uses Google TTS mp3 endpoint (same as Google Translate speaker button)
// Plays w1 then w2 sequentially via Audio elements. No Web Speech API, no voices to worry about.
window._learnLastW1 = '';
window._learnLastW2 = '';
window._learnCode1  = 'en';
window._learnCode2  = 'fr';

(function() {
  const speakBtn = document.getElementById('word-speak');
  if (!speakBtn) return;

  function resetBtn() {
    speakBtn.disabled = false;
    speakBtn.textContent = 'Speak';
  }

  function playAudio(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  }

speakBtn.addEventListener('click', async () => {
    const w2    = window._learnLastW2;
    const code2 = window._learnCode2 || 'fr';
    if (!w2) return;

    speakBtn.disabled = true;
    speakBtn.textContent = '…';

    try {
      await playAudio(googleTTSUrl(w2, code2));
    } catch (e) {
      // Google TTS may block autoplay or fail — fall back to Web Speech silently
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const u2 = new SpeechSynthesisUtterance(w2); u2.lang = code2;
          window.speechSynthesis.speak(u2);
        }
      } catch {}
    }

    resetBtn();
  });
})();

// Word lang settings
const wordLangRow = document.getElementById('word-lang-row');
document.getElementById('chk-learn') && document.getElementById('chk-learn').addEventListener('change', e => {
  if (wordLangRow) wordLangRow.style.display = e.target.checked ? '' : 'none';
});
if (wordLangRow) wordLangRow.style.display = ntSettings.widgets.learn ? '' : 'none';

document.getElementById('word-lang1').value = ntSettings.wordLang1 || 'English';
document.getElementById('word-lang2').value = ntSettings.wordLang2 || 'French';
document.getElementById('word-lang1').addEventListener('change', e => {
  ntSettings.wordLang1 = e.target.value; saveSettings(); showLearnWord(currentWordIdx, false);
});
document.getElementById('word-lang2').addEventListener('change', e => {
  ntSettings.wordLang2 = e.target.value; saveSettings(); showLearnWord(currentWordIdx, false);
});

showLearnWord(currentWordIdx, false);

// ════════════════════════════════════════════ KEYBOARD
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (searchInput && ntSettings.showSearch !== false) searchInput.focus();
  }
  if (e.key === 'Escape') { closeSettings(); if (searchInput) searchInput.blur(); hideSuggestions(); }
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

    // Widget disabled or user-collapsed — keep hidden, not a collision issue
    if (!isEnabled || !isOpen) {
      collisionHidden.delete(id);
      w.style.display = 'none';
      return;
    }

    // Always reposition from saved fractions at current viewport size FIRST
    restoreWidgetPos(id);

    // Temporarily force visible to get accurate bounding rect
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
checkWidgetVisibility();

// ════════════════════════════════════════════ STARTUP
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
renderWidgetDock();
