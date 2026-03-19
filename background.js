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
    console.log('[BG] All tabs closed — pre-fetching next wallpaper.');
    prefetchWallpaper();
  }
});

// ── trigger: browser start / extension install ────────────────────────────────
chrome.runtime.onInstalled.addListener(() => prefetchWallpaper());
chrome.runtime.onStartup.addListener(() => prefetchWallpaper());