// ════════════════════════════════════════════ TODO WIDGET
(function() {
  const LS_KEY = 'nt_todos';

  function getTodos() { return LS.get(LS_KEY, []); }
  function saveTodos(list) { LS.set(LS_KEY, list); }

  function renderTodos() {
    const list = document.getElementById('todo-list');
    if (!list) return;
    const todos = getTodos();
    list.innerHTML = '';

    if (!todos.length) {
      const empty = document.createElement('div');
      empty.className = 'todo-empty';
      empty.textContent = 'No tasks yet — add one below';
      list.appendChild(empty);
      updateTodoCounter(0, 0);
      return;
    }

    const done = todos.filter(t => t.done).length;
    updateTodoCounter(done, todos.length);

    todos.forEach((todo, idx) => {
      const item = document.createElement('div');
      item.className = 'todo-item' + (todo.done ? ' todo-done' : '');

      const check = document.createElement('button');
      check.className = 'todo-check' + (todo.done ? ' checked' : '');
      check.innerHTML = todo.done ? '✓' : '';
      check.title = todo.done ? 'Mark incomplete' : 'Mark complete';
      check.addEventListener('click', () => {
        const all = getTodos();
        all[idx].done = !all[idx].done;
        saveTodos(all);
        renderTodos();
      });

      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;

      const del = document.createElement('button');
      del.className = 'todo-delete';
      del.title = 'Delete task';
      del.innerHTML = '✕';
      del.addEventListener('click', () => {
        const all = getTodos();
        all.splice(idx, 1);
        saveTodos(all);
        renderTodos();
      });

      item.appendChild(check);
      item.appendChild(text);
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function updateTodoCounter(done, total) {
    const el = document.getElementById('todo-counter');
    if (!el) return;
    if (total === 0) { el.textContent = ''; return; }
    el.textContent = done + ' / ' + total + ' done';
  }

  function addTodo() {
    const input = document.getElementById('todo-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const all = getTodos();
    all.push({ text, done: false, createdAt: Date.now() });
    saveTodos(all);
    input.value = '';
    renderTodos();
  }

  function clearDone() {
    saveTodos(getTodos().filter(t => !t.done));
    renderTodos();
  }

  const todoInput  = document.getElementById('todo-input');
  const todoAddBtn = document.getElementById('todo-add-btn');
  const todoClear  = document.getElementById('todo-clear-done');

  if (todoInput)  todoInput.addEventListener('keydown',  e => { if (e.key === 'Enter') addTodo(); });
  if (todoAddBtn) todoAddBtn.addEventListener('click', addTodo);
  if (todoClear)  todoClear.addEventListener('click', clearDone);

  renderTodos();
})();
