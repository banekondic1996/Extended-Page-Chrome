// ══ EXTENDED HISTORY BRIDGE ═════════════════════════════════════════════════
// Set this to the Extension ID of Extended History (from chrome://extensions).
// You must also add Extended Page's ID to Extended History's manifest.json
// under "externally_connectable" > "ids", then reload both extensions.
const EH_EXTENSION_ID = 'cdfgfljiefjinljmnedgkfhgcgldkhkk';

// Whether Extended History is installed and reachable — determined at startup.
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

// Probe Extended History once at startup.
// Resolves true/false and then calls applyEhAvailability() to update the UI.
async function probeExtendedHistory() {
  const r = await ehSend({ type: 'GET_SETTINGS' });
  ehAvailable = !!(r && !r.error);
  applyEhAvailability();
}

// Show/hide EH-only UI elements based on availability.
function applyEhAvailability() {
  // Sidebar option entries that require EH
  const sidebarSel = document.getElementById('sidebar-mode');
  if (sidebarSel) {
    ['mostvisited', 'stored'].forEach(val => {
      const opt = sidebarSel.querySelector(`option[value="${val}"]`);
      if (opt) opt.style.display = ehAvailable ? '' : 'none';
    });
    // If current saved mode requires EH but EH is gone, fall back to bookmarks
    const cur = ntSettings.sidebarMode || 'mostvisited';
    if (!ehAvailable && (cur === 'mostvisited' || cur === 'stored')) {
      ntSettings.sidebarMode = 'bookmarks';
      saveSettings();
      if (sidebarSel) sidebarSel.value = 'bookmarks';
      applySidebarMode();
    }
  }

  // Top sites: if EH unavailable, load from native browser history instead
  if (!ehAvailable) loadTopSitesFallbackNative();
}

// ════════════════════════════════════════════ CLOCK
function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const d = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const clockEl = document.getElementById('clock-time');
  const dateEl  = document.getElementById('clock-date');
  if (clockEl) clockEl.textContent = t;
  if (dateEl)  dateEl.textContent  = d;
}
updateClock();
(function scheduleClockUpdate() {
  const now = new Date();
  const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(() => { updateClock(); setInterval(updateClock, 60000); }, ms);
})();

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

// ════════════════════════════════════════════ SEARCH
const searchInput = document.getElementById('search-input');
const searchGo    = document.getElementById('search-go');
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
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
searchGo.addEventListener('click', doSearch);

// ════════════════════════════════════════════ LOCAL STORAGE HELPER
const LS = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : (def !== undefined ? def : null); } catch { return def !== undefined ? def : null; } },
  set: (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ════════════════════════════════════════════ SETTINGS STATE
const DEFAULT_NT = {
  theme: 'dark', wallpaper: 'none', accent: '#3b9eff',
  showTopsites: true, topsitesCount: 8, clockFont: 'mono',
  showClock: true, showDate: true,
  sidebarMode: 'mostvisited',
  bookmarkFolderId: '', bookmarkFolderName: '',
  searchEngine: 'google', searchCustom: '',
  blurAmount: 0,
  widgets: { weather: false },
  weatherCity: '', widgetPositions: {}
};

let ntSettings = Object.assign({}, DEFAULT_NT, LS.get('nt_settings', {}));
ntSettings.widgets         = Object.assign({}, DEFAULT_NT.widgets, ntSettings.widgets || {});
ntSettings.widgetPositions = ntSettings.widgetPositions || {};
ntSettings.topsitesCount   = Math.min(18, Math.max(6, ntSettings.topsitesCount || 8));
if (ntSettings.showClock === undefined) ntSettings.showClock = true;
if (ntSettings.showDate  === undefined) ntSettings.showDate  = true;

function saveSettings() { LS.set('nt_settings', ntSettings); }

function applyBlur() {
  const amt = ntSettings.blurAmount !== undefined ? ntSettings.blurAmount : 0;
  const bg = document.getElementById('wallpaper-bg');
  if (bg) bg.style.filter = amt > 0 ? `blur(${amt}px)` : '';
  const slider = document.getElementById('blur-slider');
  if (slider) slider.value = amt;
  const label = document.getElementById('blur-label');
  if (label) label.textContent = amt + 'px';
}

function applySearchEngine() {
  const engine = ntSettings.searchEngine || 'google';
  const sel = document.getElementById('search-engine-sel');
  if (sel) sel.value = engine;
  const customRow = document.getElementById('search-custom-row');
  if (customRow) customRow.style.display = engine === 'custom' ? '' : 'none';
  const customInput = document.getElementById('search-custom-url');
  if (customInput && ntSettings.searchCustom) customInput.value = ntSettings.searchCustom;
  const labels = { google: 'Google', bing: 'Bing', custom: 'Custom' };
  searchInput.placeholder = 'Search with ' + (labels[engine] || 'Google') + ' or type a URL…';
}

// ════════════════════════════════════════════ THEME
function applyTheme() {
  document.documentElement.setAttribute('data-theme', ntSettings.theme);
  const tog = document.getElementById('toggle-theme');
  if (tog) tog.checked = ntSettings.theme === 'dark';
}
document.getElementById('toggle-theme').addEventListener('change', e => {
  ntSettings.theme = e.target.checked ? 'dark' : 'light';
  applyTheme(); applyWallpaper(); saveSettings();
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
function applyWallpaper() {
  const wp = ntSettings.wallpaper;
  const bg = document.getElementById('wallpaper-bg');
  if (!wp || wp === 'none') {
    bg.style.backgroundImage = 'none';
    document.documentElement.style.setProperty('--wallpaper-overlay',
      ntSettings.theme === 'light' ? 'rgba(240,240,245,0)' : 'rgba(12,12,16,0)');
  } else {
    bg.style.backgroundImage = "url('" + wp + "')";
    document.documentElement.style.setProperty('--wallpaper-overlay',
      ntSettings.theme === 'light' ? 'rgba(240,240,245,0.55)' : 'rgba(12,12,16,0.72)');
  }
  document.querySelectorAll('.wallpaper-thumb').forEach(t =>
    t.classList.toggle('active', t.dataset.wp === wp));
}
document.querySelectorAll('.wallpaper-thumb').forEach(t =>
  t.addEventListener('click', () => { ntSettings.wallpaper = t.dataset.wp; applyWallpaper(); saveSettings(); }));
document.getElementById('wp-upload').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { ntSettings.wallpaper = ev.target.result; applyWallpaper(); saveSettings(); };
  reader.readAsDataURL(file);
});
applyWallpaper();
applyBlur();
applySearchEngine();

// Blur slider
const blurSliderEl = document.getElementById('blur-slider');
if (blurSliderEl) {
  blurSliderEl.addEventListener('input', e => {
    ntSettings.blurAmount = parseInt(e.target.value);
    applyBlur(); saveSettings();
  });
}

// Search engine selector
const searchEngineEl = document.getElementById('search-engine-sel');
if (searchEngineEl) {
  searchEngineEl.addEventListener('change', e => {
    ntSettings.searchEngine = e.target.value;
    applySearchEngine(); saveSettings();
  });
}
const searchCustomEl = document.getElementById('search-custom-url');
if (searchCustomEl) {
  searchCustomEl.addEventListener('input', e => {
    ntSettings.searchCustom = e.target.value.trim();
    saveSettings();
  });
}


function getFaviconUrl(domain) {
  return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64';
}

function renderTopSites(sites) {
  const grid  = document.getElementById('topsites-grid');
  grid.innerHTML = '';
  const slice = sites.slice(0, ntSettings.topsitesCount || 8);
  if (!slice.length) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--text3);font-size:0.8rem;padding:12px;text-align:center';
    msg.textContent = 'Visit some sites to see them here';
    grid.appendChild(msg); return;
  }
  slice.forEach(site => {
    const el = document.createElement('a');
    el.className = 'site-icon'; el.href = site.url;
    el.title = site.title || site.domain || site.url;
    const domain = site.domain || '';
    const label  = site.title || domain;
    const img    = document.createElement('img');
    img.src = getFaviconUrl(domain); img.alt = '';
    const ph = document.createElement('div');
    ph.className = 'site-favicon-placeholder'; ph.style.display = 'none';
    ph.textContent = (label || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const name = document.createElement('div');
    name.className = 'site-name'; name.textContent = label;
    el.appendChild(img); el.appendChild(ph); el.appendChild(name);
    grid.appendChild(el);
  });
}

const TOPSITES_CACHE_KEY = 'nt_topsites_cache';

function computeTopSitesFromHistory(hist1, hist2) {
  const counts = {}, info = {};
  const proc = entries => {
    if (!Array.isArray(entries)) return;
    entries.forEach(e => {
      if (!e.url) return;
      try {
        const u = new URL(e.url);
        const d = u.hostname.replace(/^www\./, '');
        if (!d || d.startsWith('chrome') || d.startsWith('about')) return;
        counts[d] = (counts[d] || 0) + (e.visitCount || 1);
        if (!info[d]) info[d] = { domain: d, url: u.origin, title: d };
      } catch {}
    });
  };
  proc(hist1); proc(hist2);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([d]) => info[d]);
}

function loadTopSites() {
  const block = document.getElementById('topsites-block');
  if (!ntSettings.showTopsites) { block.style.display = 'none'; return; }
  block.style.display = '';

  // Render cache immediately — no loading flash
  const cached = LS.get(TOPSITES_CACHE_KEY, null);
  if (cached && cached.sites && cached.sites.length) renderTopSites(cached.sites);

  if (ehAvailable) {
    // Fetch from Extended History via external message bridge
    ehSend({ type: 'GET_MOST_VISITED', viewType: 'domain', period: 'all' }).then(r => {
      if (!r || !r.items || !r.items.length) { if (!cached) loadFallbackTopSites(); return; }
      const fresh = r.items.map(item => ({
        domain: item.identifier,
        url: 'https://' + item.identifier,
        title: item.title || item.identifier,
      }));
      const n         = ntSettings.topsitesCount;
      const freshKey  = fresh.slice(0, n).map(s => s.domain).join(',');
      const cachedKey = cached ? (cached.sites || []).slice(0, n).map(s => s.domain).join(',') : '';
      if (freshKey !== cachedKey) {
        renderTopSites(fresh);
        LS.set(TOPSITES_CACHE_KEY, { sites: fresh, ts: Date.now() });
      }
    });
  }
  // If EH is not available, applyEhAvailability() will call loadTopSitesFallbackNative()
}

// Fallback: build top sites from native chrome.history API (no EH needed)
function loadTopSitesFallbackNative() {
  const block = document.getElementById('topsites-block');
  if (!ntSettings.showTopsites) { block.style.display = 'none'; return; }
  block.style.display = '';

  const cached = LS.get(TOPSITES_CACHE_KEY, null);
  if (cached && cached.sites && cached.sites.length) renderTopSites(cached.sites);

  if (typeof chrome === 'undefined' || !chrome.history) { if (!cached) loadFallbackTopSites(); return; }

  const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // last 30 days
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
    const n         = ntSettings.topsitesCount;
    const freshKey  = fresh.slice(0, n).map(s => s.domain).join(',');
    const cachedKey = cached ? (cached.sites || []).slice(0, n).map(s => s.domain).join(',') : '';
    if (freshKey !== cachedKey) {
      renderTopSites(fresh);
      LS.set(TOPSITES_CACHE_KEY, { sites: fresh, ts: Date.now() });
    }
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
    { domain: 'netflix.com',       url: 'https://netflix.com',       title: 'Netflix' },
    { domain: 'twitch.tv',         url: 'https://twitch.tv',         title: 'Twitch' },
  ]);
}

document.getElementById('toggle-topsites').addEventListener('change', e => {
  ntSettings.showTopsites = e.target.checked; saveSettings(); loadTopSites();
});
document.getElementById('topsites-count').addEventListener('change', e => {
  ntSettings.topsitesCount = parseInt(e.target.value); saveSettings(); loadTopSites();
});
document.getElementById('toggle-topsites').checked = ntSettings.showTopsites;
document.getElementById('topsites-count').value    = String(ntSettings.topsitesCount);
loadTopSites();

// ════════════════════════════════════════════ SIDEBAR — mode-aware (most visited / stored tabs / none)
function getFaviconUrlSm(domain) {
  return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=32';
}

function renderSidebarEmpty(msg) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'sidebar-empty';
  empty.textContent = msg;
  list.appendChild(empty);
}

// ── Most Visited
function renderMostVisited(items) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  if (!items.length) { renderSidebarEmpty('No history yet'); return; }
  items.forEach(item => {
    // identifier = full URL when viewType='url'
    const url = item.identifier;
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    const el = document.createElement('a');
    el.className = 'tab-item';
    el.href = url;
    el.title = (item.title || domain) + ' — ' + item.count + ' visits';
    el.style.textDecoration = 'none';
    const img = document.createElement('img');
    img.className = 'tab-fav';
    // Use full domain for favicon lookup
    img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=32';
    const ph = document.createElement('div');
    ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (item.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span');
    lbl.className = 'tab-label';
    lbl.textContent = item.title || domain;
    const cnt = document.createElement('span');
    cnt.className = 'tab-restore';
    cnt.style.cssText = 'font-size:0.6rem;color:var(--text3);opacity:1;';
    cnt.textContent = item.count + 'x';
    el.appendChild(img); el.appendChild(ph); el.appendChild(lbl); el.appendChild(cnt);
    list.appendChild(el);
  });
}

function loadMostVisitedSidebar() {
  document.getElementById('sidebar-section-label').textContent = 'Most Visited — 10 days';
  // Request data from Extended History via external message bridge
  ehSend({ type: 'GET_MOST_VISITED', viewType: 'url', period: '10' }).then(r => {
    if (!r || !r.items) {
      renderSidebarEmpty('Link Extended History for history data');
      return;
    }
    renderMostVisited(r.items.slice(0, 30));
  });
}

// ── Stored Tabs
function removeStoredTab(tabId, itemEl) {
  itemEl.style.transition = 'opacity 0.18s, transform 0.18s, max-height 0.22s, padding 0.22s';
  itemEl.style.overflow = 'hidden';
  itemEl.style.maxHeight = itemEl.offsetHeight + 'px';
  requestAnimationFrame(() => {
    itemEl.style.opacity = '0';
    itemEl.style.transform = 'translateX(-10px)';
    itemEl.style.maxHeight = '0';
    itemEl.style.paddingTop = '0';
    itemEl.style.paddingBottom = '0';
  });
  setTimeout(() => {
    itemEl.remove();
    const list = document.getElementById('sidebar-tabs-list');
    if (list && !list.querySelector('.tab-item')) renderSidebarEmpty('No stored tabs yet');
  }, 240);
  // Remove from Extended History's storage via external message bridge
  ehSend({ type: 'REMOVE_TAB_STORAGE_ENTRY', id: tabId });
}

function renderStoredTabs(tabs) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  if (!tabs.length) { renderSidebarEmpty('No stored tabs yet'); return; }
  tabs.forEach(tab => {
    let domain = '';
    try { domain = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
    const item = document.createElement('div');
    item.className = 'tab-item'; item.title = tab.title || tab.url;
    const img = document.createElement('img');
    img.className = 'tab-fav'; img.src = getFaviconUrlSm(domain);
    const ph = document.createElement('div');
    ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (tab.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span');
    lbl.className = 'tab-label'; lbl.textContent = tab.title || domain;
    const rst = document.createElement('span');
    rst.className = 'tab-restore'; rst.textContent = 'Open ✕';
    item.appendChild(img); item.appendChild(ph); item.appendChild(lbl); item.appendChild(rst);
    item.addEventListener('click', () => { window.open(tab.url, '_blank'); removeStoredTab(tab.id, item); });
    list.appendChild(item);
  });
}

function loadStoredTabsSidebar() {
  document.getElementById('sidebar-section-label').textContent = 'Stored Tabs';
  // Fetch stored tabs from Extended History via external message bridge
  ehSend({ type: 'GET_TAB_STORAGE' }).then(r => {
    renderStoredTabs((r && r.entries) || []);
  });
}

// ── Bookmarks folder
function renderBookmarkItems(nodes) {
  const list = document.getElementById('sidebar-tabs-list');
  list.innerHTML = '';
  const bookmarks = (nodes || []).filter(n => !!n.url);
  if (!bookmarks.length) { renderSidebarEmpty('Empty folder'); return; }
  bookmarks.forEach(node => {
    let domain = '';
    try { domain = new URL(node.url).hostname.replace(/^www\./, ''); } catch {}
    const el = document.createElement('a');
    el.className = 'tab-item';
    el.href = node.url;
    el.title = node.title || node.url;
    el.style.textDecoration = 'none';
    const img = document.createElement('img');
    img.className = 'tab-fav';
    img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=32';
    const ph = document.createElement('div');
    ph.className = 'tab-fav';
    ph.style.cssText = 'display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;border-radius:5px';
    ph.textContent = (node.title || domain || '?')[0].toUpperCase();
    img.addEventListener('error', () => { img.style.display = 'none'; ph.style.display = 'flex'; });
    const lbl = document.createElement('span');
    lbl.className = 'tab-label'; lbl.textContent = node.title || domain;
    el.appendChild(img); el.appendChild(ph); el.appendChild(lbl);
    list.appendChild(el);
  });
}

function loadBookmarksSidebar() {
  const folderId = ntSettings.bookmarkFolderId;
  document.getElementById('sidebar-section-label').textContent = ntSettings.bookmarkFolderName || 'Bookmarks';
  if (!folderId || typeof chrome === 'undefined' || !chrome.bookmarks) {
    renderSidebarEmpty('No folder selected'); return;
  }
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
      if (!n.url) {
        folders.push({ id: n.id, title: ('  '.repeat(depth) + (n.title || 'Untitled')) });
        if (n.children) walk(n.children, depth + 1);
      }
    }
  }
  chrome.bookmarks.getTree(tree => {
    walk(tree[0].children || [], 0);
    sel.innerHTML = '';
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id; opt.textContent = f.title.trim();
      if (f.id === ntSettings.bookmarkFolderId) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!ntSettings.bookmarkFolderId && folders.length) {
      ntSettings.bookmarkFolderId = folders[0].id;
      ntSettings.bookmarkFolderName = folders[0].title.trim();
      saveSettings();
    }
  });
  sel.addEventListener('change', e => {
    ntSettings.bookmarkFolderId = e.target.value;
    ntSettings.bookmarkFolderName = e.target.options[e.target.selectedIndex].text;
    saveSettings();
    if (ntSettings.sidebarMode === 'bookmarks') loadBookmarksSidebar();
  });
}

// ── Sidebar mode orchestrator
function applySidebarMode() {
  const sidebar = document.getElementById('sidebar');
  const mode = ntSettings.sidebarMode || 'mostvisited';
  const sel = document.getElementById('sidebar-mode');
  if (sel) sel.value = mode;
  const folderRow = document.getElementById('bookmark-folder-row');
  if (folderRow) folderRow.style.display = mode === 'bookmarks' ? '' : 'none';
  if (mode === 'none') { sidebar.style.display = 'none'; return; }
  sidebar.style.display = '';
  if (mode === 'stored') {
    loadStoredTabsSidebar();
  } else if (mode === 'bookmarks') {
    populateBookmarkFolderPicker();
    loadBookmarksSidebar();
  } else {
    loadMostVisitedSidebar();
  }
}

const sidebarModeEl = document.getElementById('sidebar-mode');
if (sidebarModeEl) {
  sidebarModeEl.addEventListener('change', e => {
    ntSettings.sidebarMode = e.target.value;
    saveSettings();
    applySidebarMode();
  });
}
// Probe Extended History availability at startup, then apply sidebar mode.
// loadTopSites() is called below; applyEhAvailability() handles the fallback
// path if EH is unreachable.
probeExtendedHistory(); // async — updates ehAvailable and re-renders if needed
applySidebarMode();

document.getElementById('openHistoryBtn').addEventListener('click', () => {
  // Always open chrome://history — Extended History overrides it if installed
  chrome.tabs.create({ url: 'chrome://history' });
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

// Clock / Date visibility toggles
document.getElementById('toggle-clock').addEventListener('change', e => {
  ntSettings.showClock = e.target.checked; applyClockVisibility(); saveSettings();
});
document.getElementById('toggle-date').addEventListener('change', e => {
  ntSettings.showDate = e.target.checked; applyClockVisibility(); saveSettings();
});
applyClockVisibility();

// ════════════════════════════════════════════ WIDGETS
function toggleWidget(id, show) {
  const w = document.getElementById('widget-' + id);
  if (w) w.style.display = show ? 'block' : 'none';
  ntSettings.widgets[id] = show;
  saveSettings();
  if (show) restoreWidgetPos(id);
}

function makeDraggable(widget) {
  const header = widget.querySelector('.widget-header');
  let dragging = false, ox = 0, oy = 0;
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
    ntSettings.widgetPositions[widget.id.replace('widget-', '')] = { left: x, top: y };
    saveSettings();
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function restoreWidgetPos(id) {
  const pos = ntSettings.widgetPositions[id];
  const w   = document.getElementById('widget-' + id);
  if (pos && w) {
    w.style.left = pos.left + 'px'; w.style.top = pos.top + 'px';
    w.style.bottom = 'auto'; w.style.right = 'auto';
  }
}
makeDraggable(document.getElementById('widget-weather'));

document.querySelectorAll('.widget-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.close;
    toggleWidget(id, false);
    const chk = document.getElementById('chk-' + id);
    if (chk) chk.checked = false;
  });
});

document.getElementById('chk-weather').addEventListener('change', e => toggleWidget('weather', e.target.checked));
document.getElementById('chk-weather').checked = !!ntSettings.widgets.weather;
toggleWidget('weather', !!ntSettings.widgets.weather);

// ════════════════════════════════════════════ CLOCK FONT
const clockFontSel = document.getElementById('clock-font-sel');
if (clockFontSel) {
  clockFontSel.value = ntSettings.clockFont || 'mono';
  clockFontSel.addEventListener('change', e => {
    ntSettings.clockFont = e.target.value; applyClockFont(); saveSettings();
  });
}
applyClockFont();

// ════════════════════════════════════════════ WEATHER — SVG icons + city name + autocomplete
function getWeatherSVG(code) {
  const c = parseInt(code);
  // wttr.in weather codes (not OWM codes):
  // 113=clear, 116=partly cloudy, 119=cloudy, 122=overcast
  // 143,248,260=fog/mist, 176,263,266,293,296,299,302,305,308,353,356,359=rain
  // 179,182,185,281,284,311,314,317,320,323,326,329,332,335,338,350,368,371,374,377=snow
  // 200,386,389,392,395=thunder
  const isClear       = c === 113;
  const isPartlyCloudy= c === 116;
  const isCloudy      = c === 119 || c === 122;
  const isFog         = c === 143 || c === 248 || c === 260;
  const isThunder     = c === 200 || c === 386 || c === 389 || c === 392 || c === 395;
  const isSnow        = [179,182,185,281,284,311,314,317,320,323,326,329,332,335,338,350,368,371,374,377].includes(c);
  const isRain        = [176,263,266,293,296,299,302,305,308,353,356,359].includes(c);

  if (isThunder) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="22" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="26" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="26" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="32" width="30" height="7" rx="3.5" fill="#9ab0c0"/><polyline points="33,38 28,50 34,50 29,62" stroke="#ffe033" stroke-width="3" stroke-linejoin="round" fill="none" stroke-linecap="round"/><line x1="22" y1="40" x2="22" y2="56" stroke="#6ab0ff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/><line x1="42" y1="40" x2="42" y2="54" stroke="#6ab0ff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/></svg>`;
  if (isSnow) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="20" rx="18" ry="12" fill="#b0c4d8"/><ellipse cx="22" cy="24" rx="12" ry="9" fill="#c8d8e8"/><ellipse cx="42" cy="24" rx="11" ry="8" fill="#c8d8e8"/><rect x="17" y="30" width="30" height="7" rx="3.5" fill="#d8e8f4"/><circle cx="24" cy="50" r="3.5" fill="#aaccee"/><circle cx="32" cy="57" r="3.5" fill="#aaccee"/><circle cx="40" cy="50" r="3.5" fill="#aaccee"/></svg>`;
  if (isRain) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="20" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="24" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="24" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="30" width="30" height="7" rx="3.5" fill="#9ab0c0"/><line x1="24" y1="40" x2="21" y2="56" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/><line x1="32" y1="40" x2="29" y2="58" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/><line x1="40" y1="40" x2="37" y2="56" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  if (isFog) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="16" width="48" height="5" rx="2.5" fill="#9ab0c0" opacity="0.75"/><rect x="14" y="27" width="36" height="5" rx="2.5" fill="#9ab0c0" opacity="0.62"/><rect x="10" y="38" width="44" height="5" rx="2.5" fill="#9ab0c0" opacity="0.50"/><rect x="18" y="49" width="28" height="5" rx="2.5" fill="#9ab0c0" opacity="0.38"/></svg>`;
  if (isClear) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="13" fill="#ffe033"/><g stroke="#ffe033" stroke-width="2.5" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="13"/><line x1="32" y1="51" x2="32" y2="58"/><line x1="6" y1="32" x2="13" y2="32"/><line x1="51" y1="32" x2="58" y2="32"/><line x1="14" y1="14" x2="19" y2="19"/><line x1="45" y1="45" x2="50" y2="50"/><line x1="50" y1="14" x2="45" y2="19"/><line x1="19" y1="45" x2="14" y2="50"/></g></svg>`;
  if (isPartlyCloudy) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="36" r="11" fill="#ffe033"/><g stroke="#ffe033" stroke-width="2" stroke-linecap="round" opacity="0.85"><line x1="22" y1="12" x2="22" y2="17"/><line x1="22" y1="55" x2="22" y2="60"/><line x1="2" y1="36" x2="7" y2="36"/><line x1="37" y1="36" x2="42" y2="36"/><line x1="9" y1="23" x2="13" y2="27"/><line x1="31" y1="45" x2="35" y2="49"/><line x1="35" y1="23" x2="31" y2="27"/><line x1="13" y1="45" x2="9" y2="49"/></g><ellipse cx="43" cy="33" rx="14" ry="9" fill="#b0c0d0"/><ellipse cx="35" cy="36" rx="10" ry="7" fill="#c4d0dc"/><ellipse cx="51" cy="36" rx="9" ry="7" fill="#c4d0dc"/><rect x="30" y="38" width="26" height="6" rx="3" fill="#cad6e2"/></svg>`;
  if (isCloudy) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="24" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="28" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="28" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="32" width="30" height="8" rx="4" fill="#9ab0c0"/></svg>`;
  // fallback — generic cloud
  return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="28" rx="18" ry="12" fill="#8fa0b0"/><ellipse cx="22" cy="32" rx="12" ry="9" fill="#9ab0c0"/><ellipse cx="42" cy="32" rx="11" ry="8" fill="#9ab0c0"/><rect x="17" y="36" width="30" height="8" rx="4" fill="#a0b0c0"/></svg>`;
}

let weatherCity = ntSettings.weatherCity || '';

async function fetchWeather(city) {
  document.getElementById('weather-desc').textContent = 'Loading…';
  try {
    const res  = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const cur  = data.current_condition[0];
    const area = data.nearest_area[0];
    const iconEl = document.getElementById('weather-icon');
    iconEl.innerHTML = getWeatherSVG(cur.weatherCode);
    const cityName    = area.areaName[0].value;
    const regionName  = (area.region && area.region[0]) ? area.region[0].value : '';
    const countryName = area.country[0].value;
    const locationStr = cityName
      + (regionName && regionName !== cityName ? ', ' + regionName : '')
      + ', ' + countryName;
    document.getElementById('weather-location').textContent = locationStr;
    document.getElementById('weather-temp').textContent = cur.temp_C + '°C / ' + cur.temp_F + '°F';
    document.getElementById('weather-desc').textContent = cur.weatherDesc[0].value;
    ntSettings.weatherCity = city; saveSettings();
  } catch {
    document.getElementById('weather-desc').textContent = 'City not found';
  }
}

// ── City autocomplete via Open-Meteo geocoding (free, no API key)
const weatherCityInput = document.getElementById('weather-city');
let suggestionBox   = null;
let suggestionItems = [];
let selectedSuggIdx = -1;
let debounceTimer   = null;

function createSuggestionBox() {
  if (suggestionBox) return;
  suggestionBox = document.createElement('div');
  suggestionBox.className = 'city-suggestions';
  suggestionBox.style.display = 'none';
  weatherCityInput.parentElement.appendChild(suggestionBox);
}

function hideSuggestions() {
  if (suggestionBox) suggestionBox.style.display = 'none';
  selectedSuggIdx = -1;
}

function showSuggestions(cities) {
  if (!suggestionBox) createSuggestionBox();
  suggestionBox.innerHTML = '';
  suggestionItems = cities;
  selectedSuggIdx = -1;
  if (!cities.length) { suggestionBox.style.display = 'none'; return; }
  cities.forEach(c => {
    const item = document.createElement('div');
    item.className = 'city-suggestion-item';
    const region = c.admin1 ? ', ' + c.admin1 : '';
    item.textContent = c.name + region + ', ' + c.country;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      weatherCityInput.value = c.name;
      hideSuggestions();
      fetchWeather(c.name + region + ', ' + c.country);
    });
    suggestionBox.appendChild(item);
  });
  suggestionBox.style.display = 'block';
}

async function fetchCitySuggestions(query) {
  if (query.length < 2) { hideSuggestions(); return; }
  try {
    const res = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(query) + '&count=6&language=en&format=json'
    );
    if (!res.ok) return;
    const data = await res.json();
    showSuggestions((data.results || []).map(r => ({
      name: r.name, admin1: r.admin1 || '', country: r.country || ''
    })));
  } catch { hideSuggestions(); }
}

weatherCityInput.value = weatherCity;

weatherCityInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchCitySuggestions(weatherCityInput.value.trim()), 280);
});

weatherCityInput.addEventListener('keydown', e => {
  const items = suggestionBox ? suggestionBox.querySelectorAll('.city-suggestion-item') : [];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggIdx = Math.min(selectedSuggIdx + 1, items.length - 1);
    items.forEach((it, i) => it.classList.toggle('selected', i === selectedSuggIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggIdx = Math.max(selectedSuggIdx - 1, -1);
    items.forEach((it, i) => it.classList.toggle('selected', i === selectedSuggIdx));
  } else if (e.key === 'Enter') {
    if (selectedSuggIdx >= 0 && items[selectedSuggIdx]) {
      items[selectedSuggIdx].dispatchEvent(new MouseEvent('mousedown'));
    } else {
      const city = weatherCityInput.value.trim();
      if (city) { hideSuggestions(); fetchWeather(city); }
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

weatherCityInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));

createSuggestionBox();
if (weatherCity) fetchWeather(weatherCity);

// ════════════════════════════════════════════ KEYBOARD
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault(); searchInput.focus();
  }
  if (e.key === 'Escape') { closeSettings(); searchInput.blur(); hideSuggestions(); }
});