// ══ WIDGET: QUICK LINKS ══════════════════════════════════════════════════════
window.initWidget_quicklinks = function() {
  var el = document.getElementById('widget-quicklinks');
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';

  var LS_KEY = 'nt_quicklinks';
  function getLinks() { return LS.get(LS_KEY, []); }
  function saveLinks(links) { LS.set(LS_KEY, links); }
  function getFavicon(url) { try { return 'https://www.google.com/s2/favicons?domain=' + new URL(url).hostname + '&sz=64'; } catch(e) { return ''; } }

  function renderQuickLinks() {
    var grid = document.getElementById('quicklinks-grid');
    if (!grid) return;
    var links = getLinks();
    grid.innerHTML = '';
    links.forEach(function(link, idx) {
      var item = document.createElement('div');
      item.className = 'ql-item'; item.draggable = true; item.dataset.idx = idx;
      var anchor = document.createElement('a');
      anchor.href = link.url; anchor.className = 'ql-anchor'; anchor.title = link.label || link.url;
      var iconWrap = document.createElement('div'); iconWrap.className = 'ql-icon-wrap';
      var favicon = document.createElement('img'); favicon.src = getFavicon(link.url); favicon.className = 'ql-favicon';
      var ph = document.createElement('div'); ph.className = 'ql-favicon-ph';
      ph.textContent = (link.label || link.url || '?')[0].toUpperCase();
      favicon.addEventListener('error', function() { favicon.style.display = 'none'; ph.style.display = 'flex'; });
      iconWrap.appendChild(favicon); iconWrap.appendChild(ph);
      var label = document.createElement('div'); label.className = 'ql-label';
      label.textContent = link.label || (function() { try { return new URL(link.url).hostname.replace('www.',''); } catch(e) { return link.url; } })();
      anchor.appendChild(iconWrap); anchor.appendChild(label);
      var removeBtn = document.createElement('button');
      removeBtn.className = 'ql-remove'; removeBtn.title = 'Remove'; removeBtn.textContent = '\u2715';
      removeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var list = getLinks(); list.splice(idx, 1); saveLinks(list); renderQuickLinks();
      });
      item.appendChild(anchor); item.appendChild(removeBtn); grid.appendChild(item);
      item.addEventListener('dragstart', function(e) { e.dataTransfer.setData('text/plain', idx); item.classList.add('ql-dragging'); });
      item.addEventListener('dragend', function() { item.classList.remove('ql-dragging'); });
      item.addEventListener('dragover', function(e) { e.preventDefault(); item.classList.add('ql-drag-over'); });
      item.addEventListener('dragleave', function() { item.classList.remove('ql-drag-over'); });
      item.addEventListener('drop', function(e) {
        e.preventDefault(); item.classList.remove('ql-drag-over');
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain')), toIdx = parseInt(item.dataset.idx);
        if (fromIdx === toIdx) return;
        var list = getLinks(); var moved = list.splice(fromIdx, 1)[0]; list.splice(toIdx, 0, moved); saveLinks(list); renderQuickLinks();
      });
    });
    var addBtn = document.createElement('div');
    addBtn.className = 'ql-add-btn'; addBtn.innerHTML = '<span class="ql-add-plus">+</span>'; addBtn.title = 'Add link';
    addBtn.addEventListener('click', function() { openModal(); });
    grid.appendChild(addBtn);
  }

  function openModal(editIdx) {
    var overlay = document.getElementById('ql-modal-overlay');
    var urlInp = document.getElementById('ql-url-input');
    var lblInp = document.getElementById('ql-label-input');
    if (!overlay) return;
    if (editIdx != null) {
      var links = getLinks(); urlInp.value = links[editIdx].url; lblInp.value = links[editIdx].label || '';
      overlay.dataset.editIdx = editIdx;
    } else { urlInp.value = ''; lblInp.value = ''; delete overlay.dataset.editIdx; }
    overlay.style.display = 'flex'; setTimeout(function() { urlInp && urlInp.focus(); }, 60);
  }

  function closeModal() { var o = document.getElementById('ql-modal-overlay'); if (o) o.style.display = 'none'; }

  function saveForm() {
    var overlay = document.getElementById('ql-modal-overlay');
    var urlInp = document.getElementById('ql-url-input');
    var lblInp = document.getElementById('ql-label-input');
    var url = urlInp ? urlInp.value.trim() : ''; if (!url) { closeModal(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var label = lblInp ? lblInp.value.trim() : '';
    var links = getLinks();
    if (overlay && overlay.dataset.editIdx != null && overlay.dataset.editIdx !== '') links[parseInt(overlay.dataset.editIdx)] = { url: url, label: label };
    else links.push({ url: url, label: label });
    saveLinks(links); closeModal(); renderQuickLinks();
  }

  var saveBtn = document.getElementById('ql-save-btn');
  var cancelBtn = document.getElementById('ql-cancel-btn');
  var qlOverlay = document.getElementById('ql-modal-overlay');
  var urlInp = document.getElementById('ql-url-input');
  var lblInp = document.getElementById('ql-label-input');
  if (saveBtn)   saveBtn.addEventListener('click', saveForm);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (qlOverlay) qlOverlay.addEventListener('click', function(e) { if (e.target === qlOverlay) closeModal(); });
  if (urlInp)    urlInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') saveForm(); if (e.key === 'Escape') closeModal(); });
  if (lblInp)    lblInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') saveForm(); if (e.key === 'Escape') closeModal(); });

  renderQuickLinks();
  window._renderQuickLinks = renderQuickLinks;
};

(function injectQuicklinksHTML() {
  if (document.getElementById('widget-quicklinks')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-quicklinks">' +
    '<div class="widget-header"><span>\uD83D\uDD17</span><span class="widget-title">Quick Links</span>' +
    '<button class="widget-close" data-close="quicklinks">\u2715</button></div>' +
    '<div id="quicklinks-grid" class="ql-grid"></div>' +
    '</div>';
  document.body.appendChild(div.firstElementChild);
})();