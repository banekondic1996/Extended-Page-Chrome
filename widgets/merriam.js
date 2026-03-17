// ══ WIDGET: MERRIAM-WEBSTER WORD OF THE DAY ══════════════════════════════════
window.initWidget_merriam = function() {
  if (!document.getElementById('widget-merriam')) return;

  async function fetchMerriamWordOfDay() {
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      const rssUrl = 'https://www.merriam-webster.com/wotd/feed/rss2';
      const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const json = await res.json();
      if (json.status !== 'ok' || !json.items?.length) throw new Error('Bad response');
      const item  = json.items[0];
      const word  = sanitizeText(item.title || '').trim();
      const parser = new DOMParser();
      const doc    = parser.parseFromString(item.description || '', 'text/html');
      const allP   = Array.from(doc.querySelectorAll('p'));
      let def = '', pos = '', ex = '';
      if (allP[1]) { def = sanitizeText(allP[1].textContent).trim().slice(0, 400); const em = allP[1].querySelector('em'); if (em) pos = sanitizeText(em.textContent).trim(); }
      if (allP[2]) ex = sanitizeText(allP[2].textContent).trim().replace(/^\/\/\s*/, '').slice(0, 300);
      renderMerriamWord({ date: todayKey, word, pos, def, ex });
    } catch {
      const wEl = document.getElementById('merriam-word');
      const dEl = document.getElementById('merriam-def');
      if (wEl) wEl.textContent = 'Word of the Day';
      if (dEl) dEl.textContent = 'Could not load. Visit merriam-webster.com';
    }
  }

  function renderMerriamWord(data) {
    const wEl = document.getElementById('merriam-word');
    const pEl = document.getElementById('merriam-pos');
    const dEl = document.getElementById('merriam-def');
    const eEl = document.getElementById('merriam-example');
    if (wEl) wEl.textContent = data.word || '';
    if (pEl) pEl.textContent = data.pos  || '';
    if (dEl) dEl.textContent = data.def  || '';
    if (eEl) eEl.textContent = data.ex   || '';
  }

  // Expose so newtab.js bootstrap can call it on-enable
  window.fetchMerriamWordOfDay = fetchMerriamWordOfDay;
  fetchMerriamWordOfDay();
};

(function injectMerriamHTML() {
  if (document.getElementById('widget-merriam')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-merriam">
  <div class="widget-header">
    <span>📖</span><span class="widget-title">Word of the Day</span>
    <button class="widget-transparent-btn" data-target="widget-merriam" title="Toggle transparent style">•</button>
    <button class="widget-close" data-close="merriam">✕</button>
  </div>
  <div class="merriam-body" id="merriam-body">
    <div class="merriam-word" id="merriam-word">Loading…</div>
    <div class="merriam-pos" id="merriam-pos"></div>
    <div class="merriam-def" id="merriam-def"></div>
    <div class="merriam-example" id="merriam-example"></div>
  </div>
  <div class="merriam-footer">
    <a class="merriam-link" id="merriam-link" href="https://www.merriam-webster.com/word-of-the-day" target="_blank">merriam-webster.com ↗</a>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();