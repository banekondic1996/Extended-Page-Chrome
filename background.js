// ══ BACKGROUND SERVICE WORKER ════════════════════════════════════════════════
// Pre-fetches the next random wallpaper into chrome.storage.local so it is
// ready the instant the user opens a new tab — even after all tabs were closed.
//
// Storage keys (must match newtab.js):
//   nt_wp_next    → { url, dataUrl }  — waiting for the next tab open
//   nt_screen     → { w, h }          — screen resolution saved by newtab.js
// ═════════════════════════════════════════════════════════════════════════════

const WP_NEXT_KEY   = 'nt_wp_next';
const SCREEN_KEY    = 'nt_screen';
const SETTINGS_KEY  = 'nt_settings';

// ── helpers ──────────────────────────────────────────────────────────────────
function csGet(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, r => resolve(r[key] || null));
  });
}
function csSet(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

// ── check whether random wallpaper is enabled in user settings ───────────────
async function isRandomWallpaperEnabled() {
  try {
    // Settings are stored in localStorage of the extension page, but we can
    // also keep a mirror in chrome.storage.local (written below on each save).
    // Fall back to true so we pre-fetch by default when the mirror isn't set yet.
    const settings = await csGet(SETTINGS_KEY);
    if (settings && typeof settings.randomWallpaper !== 'undefined') {
      return !!settings.randomWallpaper;
    }
  } catch {}
  return true; // default: pre-fetch
}

// ── core: fetch a random picsum photo and store it as WP_NEXT_KEY ─────────────
async function prefetchWallpaper() {
  if (!(await isRandomWallpaperEnabled())) return;

  // Check whether a prefetched image is already waiting — don't waste bandwidth
  const existing = await csGet(WP_NEXT_KEY);
  if (existing && existing.dataUrl) return; // already ready

  try {
    // Read screen size saved by newtab.js, fall back to 1920×1080
    const screen = await csGet(SCREEN_KEY);
    const w = (screen && screen.w) || 1920;
    const h = (screen && screen.h) || 1080;

    const seed = Math.floor(Math.random() * 100000);
    const url  = `https://picsum.photos/seed/${seed}/${w}/${h}`;

    const res = await fetch(url);
    if (!res.ok) return;

    // Convert blob → base64 data-URL via ArrayBuffer (no FileReader in SW)
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64   = btoa(binary);
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    const dataUrl  = `data:${mimeType};base64,${base64}`;

    await csSet(WP_NEXT_KEY, { url, dataUrl });
    console.log('[BG] Wallpaper pre-fetched and stored.');
  } catch (err) {
    console.warn('[BG] prefetchWallpaper failed:', err);
  }
}

// ── trigger: last tab closed → pre-fetch immediately ─────────────────────────
chrome.tabs.onRemoved.addListener(async (_tabId, _removeInfo) => {
  const tabs = await chrome.tabs.query({});
  if (tabs.length === 0) {
    console.log('[BG] All tabs closed — running background refresh.');
    runBackgroundRefresh();
  }
});

// ── trigger: browser start / extension install ────────────────────────────────

// ══ BACKGROUND CACHE: QUOTES, WEATHER, LEARN WORD ════════════════════════════
// Pre-fetches data so the new tab page renders instantly with fresh content.
// Runs on a 30-minute alarm, browser start, and install.

const CACHE_KEY_WEATHER = 'nt_bg_weather';   // { data, city, ts }
const CACHE_KEY_WOTD    = 'nt_bg_wotd';      // { word, pos, def, ex, date, ts }
const ALARM_NAME        = 'nt_bg_refresh';

// ── alarm setup ──────────────────────────────────────────────────────────────
async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
}

// ── weather pre-fetch ─────────────────────────────────────────────────────────
async function prefetchWeather() {
  try {
    const settings = await csGet('nt_settings');
    const city = (settings && settings.weatherCity) ? settings.weatherCity : null;
    if (!city) return;
    const cached = await csGet(CACHE_KEY_WEATHER);
    const age = cached ? (Date.now() - (cached.ts || 0)) : Infinity;
    if (cached && cached.city === city && age < 25 * 60 * 1000) return; // fresh enough
    const res = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1');
    if (!res.ok) return;
    const data = await res.json();
    const cur  = data.current_condition[0];
    const area = data.nearest_area[0];
    const cityName    = area.areaName[0].value;
    const regionName  = (area.region && area.region[0]) ? area.region[0].value : '';
    const countryName = area.country[0].value;
    const locStr = cityName + (regionName && regionName !== cityName ? ', ' + regionName : '') + ', ' + countryName;
    await csSet(CACHE_KEY_WEATHER, {
      city, locStr,
      code: cur.weatherCode, tempC: cur.temp_C, tempF: cur.temp_F,
      desc: cur.weatherDesc[0].value, ts: Date.now()
    });
    console.log('[BG] Weather cached for', city);
  } catch (err) { console.warn('[BG] prefetchWeather failed:', err); }
}

// ── word-of-the-day pre-fetch ─────────────────────────────────────────────────
async function prefetchWotd() {
  try {
    const cached = await csGet(CACHE_KEY_WOTD);
    const todayKey = new Date().toISOString().slice(0, 10);
    if (cached && cached.date === todayKey) return; // already today's word
    const rssUrl = 'https://www.merriam-webster.com/wotd/feed/rss2';
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);
    const res = await fetch(apiUrl);
    if (!res.ok) return;
    const json = await res.json();
    if (json.status !== 'ok' || !json.items?.length) return;
    const item = json.items[0];
    const word = (item.title || '').trim();
    // Parse HTML description for pos/def/ex — simple regex, no DOMParser in SW
    const desc = item.description || '';
    const stripped = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const parts = stripped.split(/\s{2,}/);
    const def = parts[1] ? parts[1].trim().slice(0, 400) : '';
    const ex  = parts[2] ? parts[2].trim().replace(/^\/\/\s*/, '').slice(0, 300) : '';
    await csSet(CACHE_KEY_WOTD, { word, def, ex, date: todayKey, ts: Date.now() });
    console.log('[BG] WOTD cached:', word);
  } catch (err) { console.warn('[BG] prefetchWotd failed:', err); }
}

// ── run all pre-fetches ───────────────────────────────────────────────────────
async function runBackgroundRefresh() {
  await Promise.allSettled([
    prefetchWallpaper(),
    prefetchWeather(),
    prefetchWotd(),
  ]);
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) runBackgroundRefresh();
});
chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); runBackgroundRefresh(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); runBackgroundRefresh(); });