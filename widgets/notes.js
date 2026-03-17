// ══ WIDGET: NOTES ════════════════════════════════════════════════════════════
window.initWidget_notes = function() {
  var el = document.getElementById('widget-notes');
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';
  window._initNotesInstance('notes');
  window._makeNotesTitleEditable(el, 'notes', null);
};

window._initNotesInstance = function(instId) {
  var area      = document.getElementById('notes-area-' + instId);
  var charCount = document.getElementById('notes-char-count-' + instId);
  var savedEl   = document.getElementById('notes-saved-' + instId);
  if (!area) return;
  var storageKey = 'nt_notes_' + instId;
  area.value = LS.get(storageKey, '') || '';
  if (charCount) charCount.textContent = area.value.length + ' chars';
  var saveTimer;
  area.addEventListener('input', function() {
    if (charCount) charCount.textContent = area.value.length + ' chars';
    if (savedEl) savedEl.style.opacity = '0';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      LS.set(storageKey, area.value);
      if (savedEl) { savedEl.style.opacity = '1'; setTimeout(function() { savedEl.style.opacity = '0'; }, 1500); }
    }, 600);
  });
};

// Double-click title to rename
window._makeNotesTitleEditable = function(el, instId, extraList) {
  var titleEl = el && el.querySelector('.widget-title');
  if (!titleEl || titleEl.dataset.renameWired) return;
  titleEl.dataset.renameWired = '1';

  var storageKey = 'nt_widget_title_' + instId;
  var saved = LS.get(storageKey, null);
  if (saved) titleEl.textContent = saved;
  titleEl.title = 'Double-click to rename';

  titleEl.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    titleEl.setAttribute('contenteditable', 'true');
    titleEl.setAttribute('spellcheck', 'false');
    titleEl.style.cssText += ';outline:1px solid var(--accent);border-radius:3px;cursor:text;';
    titleEl.focus();
    var range = document.createRange(); range.selectNodeContents(titleEl);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  });

  function finishRename() {
    titleEl.removeAttribute('contenteditable');
    titleEl.style.outline = ''; titleEl.style.cursor = '';
    var t = titleEl.textContent.trim() || 'Notes';
    titleEl.textContent = t; LS.set(storageKey, t);
    if (extraList) { var entry = extraList.find(function(n) { return n.id === instId; }); if (entry) { entry.title = t; saveSettings(); } }
  }
  titleEl.addEventListener('blur', finishRename);
  titleEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });
};

(function injectNotesHTML() {
  if (document.getElementById('widget-notes')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-notes">' +
    '<div class="widget-header"><span>\uD83D\uDCDD</span>' +
    '<span class="widget-title">Notes</span>' +
    '<button class="widget-close" data-close="notes">\u2715</button></div>' +
    '<textarea class="notes-area" id="notes-area-notes" placeholder="Jot something down\u2026" spellcheck="false"></textarea>' +
    '<div class="notes-footer">' +
    '<span id="notes-char-count-notes">0 chars</span>' +
    '<span class="notes-saved" id="notes-saved-notes" style="opacity:0">Saved \u2713</span>' +
    '</div></div>';
  document.body.appendChild(div.firstElementChild);
})();