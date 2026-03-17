// ══ WIDGET LOADER ════════════════════════════════════════════════════════════
// Dynamically injects widget HTML only for widgets that are enabled in settings,
// plus always-needed utility widgets (ignorelist). Widgets in the /widgets/
// folder are the single source of truth for their HTML structure.
//
// Usage: call WidgetLoader.init(ntSettings, containerId) at startup.
// Call WidgetLoader.load(id) to demand-load a single widget later.
// ═════════════════════════════════════════════════════════════════════════════

const WidgetLoader = (() => {
  // Widgets that have a separate HTML file.
  // These were previously hardcoded in newtab.html.
  const WIDGET_FILES = [
    'weather', 'timer', 'notes', 'currency',
    'quotes', 'learn', 'merriam',
    // quicklinks, todo, calendar, crypto already live in widgets/ folder
    // and are injected by their own .js files — no separate .html needed
  ];

  // Always load these regardless of settings (utility widgets)
  const ALWAYS_LOAD = ['ignorelist'];

  let _settings = null;
  let _container = null;
  const _loaded = new Set();
  const _pending = {}; // id → Promise

  function _fetchAndInject(id) {
    if (_pending[id]) return _pending[id];
    _pending[id] = fetch(`widgets/${id}.html`)
      .then(r => {
        if (!r.ok) throw new Error(`Widget HTML not found: widgets/${id}.html`);
        return r.text();
      })
      .then(html => {
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const widgetEl = wrap.firstElementChild;
        if (widgetEl && _container) {
          _container.appendChild(widgetEl);
          _loaded.add(id);
        }
      })
      .catch(err => console.warn('[WidgetLoader]', err));
    return _pending[id];
  }

  /**
   * Load a single widget by id (no-op if already loaded).
   * Returns a Promise that resolves when the HTML is injected.
   */
  function load(id) {
    if (_loaded.has(id)) return Promise.resolve();
    return _fetchAndInject(id);
  }

  /**
   * Initialise: inject HTML for all enabled widgets + always-load widgets.
   * @param {object} settings - ntSettings object
   * @param {string|HTMLElement} container - element (or id) to append widgets into
   * @returns {Promise<void[]>} resolves when all initial widgets are injected
   */
  function init(settings, container) {
    _settings = settings;
    _container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!_container) {
      console.error('[WidgetLoader] Container not found:', container);
      return Promise.resolve();
    }

    const toLoad = [...ALWAYS_LOAD];
    WIDGET_FILES.forEach(id => {
      if (settings.widgets && settings.widgets[id]) toLoad.push(id);
    });

    return Promise.all(toLoad.map(id => load(id)));
  }

  return { init, load, loaded: () => new Set(_loaded) };
})();