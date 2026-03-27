// ══ WIDGET: TO-DO ════════════════════════════════════════════════════════════
window.initWidget_todo = function() {
  var el = document.getElementById('widget-todo');
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';
  window._initTodoInstance('todo');
  window._makeTodoTitleEditable(el, 'todo', null);
};

window._initTodoInstance = function(instId) {
  var LS_KEY = 'nt_todos_' + instId;
  function getTodos() { return LS.get(LS_KEY, []); }
  function saveTodos(list) { LS.set(LS_KEY, list); }

  function updateCounter(done, total) {
    var el = document.getElementById('todo-counter-' + instId);
    if (!el) return;
    el.textContent = total ? (done + ' / ' + total + ' done') : '';
  }

  function renderTodos() {
    var list = document.getElementById('todo-list-' + instId);
    if (!list) return;
    var todos = getTodos();
    list.innerHTML = '';
    if (!todos.length) {
      var empty = document.createElement('div');
      empty.className = 'todo-empty';
      empty.textContent = 'No tasks yet \u2014 add one below';
      list.appendChild(empty);
      updateCounter(0, 0); return;
    }
    var done = todos.filter(function(t) { return t.done; }).length;
    updateCounter(done, todos.length);
    todos.forEach(function(todo, idx) {
      var item = document.createElement('div');
      item.className = 'todo-item' + (todo.done ? ' todo-done' : '');

      var check = document.createElement('button');
      check.className = 'todo-check' + (todo.done ? ' checked' : '');
      check.innerHTML = todo.done ? '\u2713' : '';
      check.title = todo.done ? 'Mark incomplete' : 'Mark complete';
      check.addEventListener('click', function() {
        var all = getTodos(); all[idx].done = !all[idx].done; saveTodos(all); renderTodos();
      });

      var text = document.createElement('span');
      text.className = 'todo-text'; text.textContent = todo.text;

      var del = document.createElement('button');
      del.className = 'todo-delete'; del.title = 'Delete'; del.innerHTML = '\u2715';
      del.addEventListener('click', function() {
        var all = getTodos(); all.splice(idx, 1); saveTodos(all); renderTodos();
      });

      item.appendChild(check); item.appendChild(text); item.appendChild(del);
      list.appendChild(item);
    });
  }

  function addTodo() {
    var inp = document.getElementById('todo-input-' + instId);
    if (!inp) return;
    var text = inp.value.trim(); if (!text) return;
    var all = getTodos();
    all.push({ text: text, done: false, createdAt: Date.now() });
    saveTodos(all); inp.value = ''; renderTodos();
  }

  var inp    = document.getElementById('todo-input-' + instId);
  var addBtn = document.getElementById('todo-add-btn-' + instId);
  var clrBtn = document.getElementById('todo-clear-done-' + instId);
  if (inp)    inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') addTodo(); });
  if (addBtn) addBtn.addEventListener('click', addTodo);
  if (clrBtn) clrBtn.addEventListener('click', function() {
    saveTodos(getTodos().filter(function(t) { return !t.done; })); renderTodos();
  });
  renderTodos();
};

// Double-click title to rename
window._makeTodoTitleEditable = function(el, instId, extraList) {
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
    // Select all
    var range = document.createRange(); range.selectNodeContents(titleEl);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  });

  function finishRename() {
    titleEl.removeAttribute('contenteditable');
    titleEl.style.outline = ''; titleEl.style.cursor = '';
    var t = titleEl.textContent.trim() || 'To-Do';
    titleEl.textContent = t; LS.set(storageKey, t);
    if (extraList) { var entry = extraList.find(function(n) { return n.id === instId; }); if (entry) { entry.title = t; saveSettings(); } }
  }
  titleEl.addEventListener('blur', finishRename);
  titleEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });
};

(function injectTodoHTML() {
  if (document.getElementById('widget-todo')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-todo">' +
    '<div class="widget-header"><span>\u2705</span>' +
    '<span class="widget-title">To-Do</span>' +
    '<span id="todo-counter-todo" class="todo-header-counter"></span>' +
    '<button class="widget-close" data-close="todo">\u2715</button></div>' +
    '<div id="todo-list-todo" class="todo-list"></div>' +
    '<div class="todo-footer">' +
    '<div class="todo-input-row">' +
    '<input type="text" id="todo-input-todo" class="todo-input" placeholder="New task\u2026" autocomplete="off" spellcheck="false">' +
    '<button id="todo-add-btn-todo" class="todo-add-btn" title="Add task">+</button>' +
    '</div>' +
    '<div class="todo-footer-btns">' +
    '<button id="todo-clear-done-todo" class="todo-clear-btn">Clear done</button>' +
    '</div>' +
    '</div></div>';
  document.body.appendChild(div.firstElementChild);
})();

// Defer init until storage cache is populated so LS.get() has real data.
(typeof _storageReady !== 'undefined' ? _storageReady : Promise.resolve())
  .then(function() { window.initWidget_todo(); });