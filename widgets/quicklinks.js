// ════════════════════════════════════════════ QUICK LINKS WIDGET
(function() {
  const LS_KEY = 'nt_quicklinks';

  function getLinks() { return LS.get(LS_KEY, []); }
  function saveLinks(links) { LS.set(LS_KEY, links); }

  function getFavicon(url) {
    try { const d = new URL(url).hostname; return 'https://www.google.com/s2/favicons?domain=' + d + '&sz=64'; }
    catch { return ''; }
  }

  function renderQuickLinks() {
    const grid = document.getElementById('quicklinks-grid');
    if (!grid) return;
    const links = getLinks();
    grid.innerHTML = '';

    links.forEach((link, idx) => {
      const item = document.createElement('div');
      item.className = 'ql-item';
      item.draggable = true;
      item.dataset.idx = idx;

      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.className = 'ql-anchor';
      anchor.title = link.label || link.url;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'ql-icon-wrap';

      const favicon = document.createElement('img');
      favicon.src = getFavicon(link.url);
      favicon.className = 'ql-favicon';
      const ph = document.createElement('div');
      ph.className = 'ql-favicon-ph';
      ph.textContent = (link.label || link.url || '?')[0].toUpperCase();
      favicon.addEventListener('error', () => { favicon.style.display = 'none'; ph.style.display = 'flex'; });

      iconWrap.appendChild(favicon);
      iconWrap.appendChild(ph);

      const label = document.createElement('div');
      label.className = 'ql-label';
      label.textContent = link.label || (() => { try { return new URL(link.url).hostname.replace('www.',''); } catch { return link.url; }})();

      anchor.appendChild(iconWrap);
      anchor.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'ql-remove';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const list = getLinks();
        list.splice(idx, 1);
        saveLinks(list);
        renderQuickLinks();
      });

      item.appendChild(anchor);
      item.appendChild(removeBtn);
      grid.appendChild(item);

      // Drag-to-reorder
      item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', idx); item.classList.add('ql-dragging'); });
      item.addEventListener('dragend', () => item.classList.remove('ql-dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('ql-drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('ql-drag-over'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('ql-drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx   = parseInt(item.dataset.idx);
        if (fromIdx === toIdx) return;
        const list = getLinks();
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        saveLinks(list);
        renderQuickLinks();
      });
    });

    // Add button
    const addBtn = document.createElement('div');
    addBtn.className = 'ql-add-btn';
    addBtn.innerHTML = '<span class="ql-add-plus">+</span>';
    addBtn.title = 'Add link';
    addBtn.addEventListener('click', () => openQuickLinkModal());
    grid.appendChild(addBtn);
  }

  function openQuickLinkModal(editIdx) {
    const overlay = document.getElementById('ql-modal-overlay');
    const urlInput = document.getElementById('ql-url-input');
    const labelInput = document.getElementById('ql-label-input');
    if (!overlay) return;
    if (editIdx != null) {
      const links = getLinks();
      urlInput.value   = links[editIdx].url;
      labelInput.value = links[editIdx].label || '';
      overlay.dataset.editIdx = editIdx;
    } else {
      urlInput.value = '';
      labelInput.value = '';
      delete overlay.dataset.editIdx;
    }
    overlay.style.display = 'flex';
    setTimeout(() => urlInput.focus(), 60);
  }

  function closeQuickLinkModal() {
    const overlay = document.getElementById('ql-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function saveQuickLinkForm() {
    const overlay = document.getElementById('ql-modal-overlay');
    const urlInput   = document.getElementById('ql-url-input');
    const labelInput = document.getElementById('ql-label-input');
    let url = urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const label = labelInput.value.trim();
    const links = getLinks();
    if (overlay && overlay.dataset.editIdx != null && overlay.dataset.editIdx !== '') {
      links[parseInt(overlay.dataset.editIdx)] = { url, label };
    } else {
      links.push({ url, label });
    }
    saveLinks(links);
    closeQuickLinkModal();
    renderQuickLinks();
  }

  // Wire up modal buttons
  document.addEventListener('DOMContentLoaded', () => {}, false); // guard
  const qlSaveBtn   = document.getElementById('ql-save-btn');
  const qlCancelBtn = document.getElementById('ql-cancel-btn');
  const qlOverlay   = document.getElementById('ql-modal-overlay');

  if (qlSaveBtn)   qlSaveBtn.addEventListener('click', saveQuickLinkForm);
  if (qlCancelBtn) qlCancelBtn.addEventListener('click', closeQuickLinkModal);
  if (qlOverlay)   qlOverlay.addEventListener('click', e => { if (e.target === qlOverlay) closeQuickLinkModal(); });

  const qlUrlInput = document.getElementById('ql-url-input');
  if (qlUrlInput) qlUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveQuickLinkForm(); if (e.key === 'Escape') closeQuickLinkModal(); });
  const qlLabelInput = document.getElementById('ql-label-input');
  if (qlLabelInput) qlLabelInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveQuickLinkForm(); if (e.key === 'Escape') closeQuickLinkModal(); });

  renderQuickLinks();
  window._renderQuickLinks = renderQuickLinks;
})();
