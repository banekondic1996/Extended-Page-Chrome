// ══ WIDGET: QUOTES ═══════════════════════════════════════════════════════════
// QUOTES array is provided by quotes.js loaded before this file.
window.initWidget_quotes = function() {
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
};

(function injectQuotesHTML() {
  if (document.getElementById('widget-quotes')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-quotes">
  <div class="widget-header"><span>💬</span><span class="widget-title">Quote</span>
    <button class="widget-transparent-btn" data-target="widget-quotes" title="Toggle transparent style">•</button>
    <button class="widget-close" data-close="quotes">✕</button>
  </div>
  <div class="quotes-body">
    <div class="quotes-text" id="quotes-text">Loading…</div>
    <div class="quotes-author" id="quotes-author"></div>
  </div>
  <div class="quotes-footer">
    <span id="quotes-counter" style="font-size:0.62rem;color:var(--text2);"></span>
    <button class="quotes-next-btn" id="quotes-next">Next →</button>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();