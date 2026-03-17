// ══ WIDGET: IGNORE LIST (utility, always loaded) ═════════════════════════════
window.initWidget_ignorelist = function() {
  const w = document.getElementById('widget-ignorelist');
  if (!w) return;

  function renderIgnoreList() {
    const body = document.getElementById('ignorelist-body');
    if (!body) return;
    const list = getIgnoreList();
    body.innerHTML = '';
    if (!list.length) {
      body.innerHTML = '<div style="font-size:0.78rem;color:var(--text2);padding:8px 0;text-align:center;">No ignored sites</div>'; return;
    }
    list.forEach(domain => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--glass-border);';
      const img = document.createElement('img');
      img.src = getFaviconUrlSm(domain);
      img.style.cssText = 'width:16px;height:16px;border-radius:3px;flex-shrink:0;';
      img.addEventListener('error', () => img.style.display = 'none');
      const lbl = document.createElement('span'); lbl.textContent = domain;
      lbl.style.cssText = 'flex:1;font-size:0.78rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      const btn = document.createElement('button'); btn.textContent = '×'; btn.title = 'Remove from ignore list';
      btn.style.cssText = 'background:none;border:none;color:var(--accent);font-size:1rem;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;';
      btn.addEventListener('click', () => { saveIgnoreList(getIgnoreList().filter(d => d !== domain)); renderIgnoreList(); loadTopSites(); });
      row.appendChild(img); row.appendChild(lbl); row.appendChild(btn);
      body.appendChild(row);
    });
  }
  window.renderIgnoreList = renderIgnoreList;

  const openBtn = document.getElementById('open-ignore-list-btn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      closeSettings();
      w.style.display = 'block'; renderIgnoreList(); bringWidgetToFront(w);
      w.style.top = Math.max(60, (window.innerHeight - w.offsetHeight) / 2) + 'px';
      w.style.transform = '';
    });
  }

  const clearBtn = document.getElementById('ignorelist-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => { saveIgnoreList([]); renderIgnoreList(); loadTopSites(); });
};

(function injectIgnorelistHTML() {
  if (document.getElementById('widget-ignorelist')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-ignorelist" style="display:none;right:24px;top:50%;transform:translateY(-50%);width:300px;max-height:420px;">
  <div class="widget-header"><span>🚫</span><span class="widget-title">Ignored Sites</span><button class="widget-close" data-close="ignorelist">✕</button></div>
  <div style="padding:10px 14px 4px;font-size:0.72rem;color:var(--text2);">Sites hidden from Most Visited. Click × to restore.</div>
  <div id="ignorelist-body" style="padding:6px 14px;max-height:280px;overflow-y:auto;scrollbar-width:thin;"></div>
  <div style="padding:8px 14px 12px;">
    <button id="ignorelist-clear-btn" style="width:100%;padding:7px;background:rgba(229,62,62,0.12);border:1px solid rgba(229,62,62,0.3);border-radius:8px;color:#e53e3e;font-family:var(--font);font-size:0.75rem;cursor:pointer;transition:background 0.12s;">Clear All</button>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();