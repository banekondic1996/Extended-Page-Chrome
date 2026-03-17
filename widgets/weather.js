// ══ WIDGET: WEATHER ══════════════════════════════════════════════════════════
// Self-contained: injects HTML, then wires all logic.
// Called via window.initWidget_weather() from the widget bootstrap in newtab.js.
// ═════════════════════════════════════════════════════════════════════════════

window.initWidget_weather = function() {
  const el = document.getElementById('widget-weather');
  if (!el) return; // shouldn't happen — bootstrap injects before calling

  // ── SVG helpers (shared with clock weather inline, kept here for colocation) ──
  window.getWeatherSVG = function(code) {
    const c = parseInt(code);
    const isClear        = c === 113;
    const isPartlyCloudy = c === 116;
    const isCloudy       = c === 119 || c === 122;
    const isFog          = c === 143 || c === 248 || c === 260;
    const isThunder      = c === 200 || c === 386 || c === 389 || c === 392 || c === 395;
    const isSnow         = [179,182,185,281,284,311,314,317,320,323,326,329,332,335,338,350,368,371,374,377].includes(c);
    const isRain         = [176,263,266,293,296,299,302,305,308,353,356,359].includes(c);
    if (isThunder)      return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="22" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="26" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="26" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="32" width="30" height="7" rx="3.5" fill="#9ab0c0"/><polyline points="33,38 28,50 34,50 29,62" stroke="#ffe033" stroke-width="3" stroke-linejoin="round" fill="none" stroke-linecap="round"/><line x1="22" y1="40" x2="22" y2="56" stroke="#6ab0ff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/><line x1="42" y1="40" x2="42" y2="54" stroke="#6ab0ff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/></svg>`;
    if (isSnow)         return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="20" rx="18" ry="12" fill="#b0c4d8"/><ellipse cx="22" cy="24" rx="12" ry="9" fill="#c8d8e8"/><ellipse cx="42" cy="24" rx="11" ry="8" fill="#c8d8e8"/><rect x="17" y="30" width="30" height="7" rx="3.5" fill="#d8e8f4"/><circle cx="24" cy="50" r="3.5" fill="#aaccee"/><circle cx="32" cy="57" r="3.5" fill="#aaccee"/><circle cx="40" cy="50" r="3.5" fill="#aaccee"/></svg>`;
    if (isRain)         return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="20" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="24" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="24" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="30" width="30" height="7" rx="3.5" fill="#9ab0c0"/><line x1="24" y1="40" x2="21" y2="56" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/><line x1="32" y1="40" x2="29" y2="58" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/><line x1="40" y1="40" x2="37" y2="56" stroke="#6ab0ff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    if (isFog)          return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="16" width="48" height="5" rx="2.5" fill="#9ab0c0" opacity="0.75"/><rect x="14" y="27" width="36" height="5" rx="2.5" fill="#9ab0c0" opacity="0.62"/><rect x="10" y="38" width="44" height="5" rx="2.5" fill="#9ab0c0" opacity="0.50"/><rect x="18" y="49" width="28" height="5" rx="2.5" fill="#9ab0c0" opacity="0.38"/></svg>`;
    if (isClear)        return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="13" fill="#ffe033"/><g stroke="#ffe033" stroke-width="2.5" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="13"/><line x1="32" y1="51" x2="32" y2="58"/><line x1="6" y1="32" x2="13" y2="32"/><line x1="51" y1="32" x2="58" y2="32"/><line x1="14" y1="14" x2="19" y2="19"/><line x1="45" y1="45" x2="50" y2="50"/><line x1="50" y1="14" x2="45" y2="19"/><line x1="19" y1="45" x2="14" y2="50"/></g></svg>`;
    if (isPartlyCloudy) return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="36" r="11" fill="#ffe033"/><g stroke="#ffe033" stroke-width="2" stroke-linecap="round" opacity="0.85"><line x1="22" y1="12" x2="22" y2="17"/><line x1="22" y1="55" x2="22" y2="60"/><line x1="2" y1="36" x2="7" y2="36"/><line x1="37" y1="36" x2="42" y2="36"/><line x1="9" y1="23" x2="13" y2="27"/><line x1="31" y1="45" x2="35" y2="49"/><line x1="35" y1="23" x2="31" y2="27"/><line x1="13" y1="45" x2="9" y2="49"/></g><ellipse cx="43" cy="33" rx="14" ry="9" fill="#b0c0d0"/><ellipse cx="35" cy="36" rx="10" ry="7" fill="#c4d0dc"/><ellipse cx="51" cy="36" rx="9" ry="7" fill="#c4d0dc"/><rect x="30" y="38" width="26" height="6" rx="3" fill="#cad6e2"/></svg>`;
    if (isCloudy)       return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="24" rx="18" ry="12" fill="#7a8a9a"/><ellipse cx="22" cy="28" rx="12" ry="9" fill="#8fa0b0"/><ellipse cx="42" cy="28" rx="11" ry="8" fill="#8fa0b0"/><rect x="17" y="32" width="30" height="8" rx="4" fill="#9ab0c0"/></svg>`;
    return `<svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="28" rx="18" ry="12" fill="#8fa0b0"/><ellipse cx="22" cy="32" rx="12" ry="9" fill="#9ab0c0"/><ellipse cx="42" cy="32" rx="11" ry="8" fill="#9ab0c0"/><rect x="17" y="36" width="30" height="8" rx="4" fill="#a0b0c0"/></svg>`;
  };
  window.getWeatherSVGSmall = function(code) {
    return window.getWeatherSVG(code).replace(/width="48" height="48"/g, 'width="24" height="24"');
  };

  let weatherCity    = ntSettings.weatherCity || '';
  let lastWeatherData = null;

  async function fetchWeather(city) {
    const descEl = document.getElementById('weather-desc');
    if (descEl) descEl.textContent = 'Loading…';
    try {
      const res  = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const cur  = data.current_condition[0];
      const area = data.nearest_area[0];
      const iconEl = document.getElementById('weather-icon');
      if (iconEl) iconEl.innerHTML = window.getWeatherSVG(cur.weatherCode);
      const cityName   = area.areaName[0].value;
      const regionName = (area.region && area.region[0]) ? area.region[0].value : '';
      const countryName = area.country[0].value;
      const locStr = cityName + (regionName && regionName !== cityName ? ', ' + regionName : '') + ', ' + countryName;
      const locEl  = document.getElementById('weather-location');
      const tempEl = document.getElementById('weather-temp');
      if (locEl)  locEl.textContent  = locStr;
      if (tempEl) tempEl.textContent = cur.temp_C + '°C / ' + cur.temp_F + '°F';
      if (descEl) descEl.textContent = cur.weatherDesc[0].value;
      ntSettings.weatherCity = city; saveSettings();
      lastWeatherData = { code: cur.weatherCode, tempC: cur.temp_C, tempF: cur.temp_F, desc: cur.weatherDesc[0].value };
      window.lastWeatherData = lastWeatherData;
      updateClockWeatherInline();
    } catch { if (descEl) descEl.textContent = 'City not found'; }
  }

  // Expose for clock-weather (used by newtab.js toggle-clock-weather listener)
  window.fetchWeather = fetchWeather;
  window.fetchWeatherForClock = async function(city) {
    if (!city) return;
    try {
      const res  = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const cur  = data.current_condition[0];
      lastWeatherData = { code: cur.weatherCode, tempC: cur.temp_C, tempF: cur.temp_F, desc: cur.weatherDesc[0].value };
      window.lastWeatherData = lastWeatherData;
      updateClockWeatherInline();
    } catch {}
  };

  function updateClockWeatherInline() {
    const cwEl   = document.getElementById('clock-weather-inline');
    if (!ntSettings.showClockWeather || !lastWeatherData) { if (cwEl) cwEl.classList.remove('visible'); return; }
    if (cwEl) cwEl.classList.add('visible');
    const iconEl = document.getElementById('cwi-icon');
    const tempEl = document.getElementById('cwi-temp');
    const descEl = document.getElementById('cwi-desc');
    if (iconEl) iconEl.innerHTML = window.getWeatherSVGSmall(lastWeatherData.code);
    if (tempEl) tempEl.textContent = lastWeatherData.tempC + '°C';
    if (descEl) descEl.textContent = lastWeatherData.desc;
  }
  window.updateClockWeatherInline = updateClockWeatherInline;

  // City autocomplete
  const cityInput = document.getElementById('weather-city');
  let suggestionBox = null, selectedSuggIdx = -1, debounceTimer = null;

  function createSuggestionBox() {
    if (suggestionBox || !cityInput) return;
    suggestionBox = document.createElement('div');
    suggestionBox.className = 'city-suggestions'; suggestionBox.style.display = 'none';
    cityInput.parentElement.appendChild(suggestionBox);
  }
  function hideSuggestions() { if (suggestionBox) suggestionBox.style.display = 'none'; selectedSuggIdx = -1; }
  function showSuggestions(cities) {
    if (!suggestionBox) createSuggestionBox();
    suggestionBox.innerHTML = ''; selectedSuggIdx = -1;
    if (!cities.length) { suggestionBox.style.display = 'none'; return; }
    cities.forEach(c => {
      const item = document.createElement('div'); item.className = 'city-suggestion-item';
      const region = c.admin1 ? ', ' + c.admin1 : '';
      item.textContent = c.name + region + ', ' + c.country;
      item.addEventListener('mousedown', e => { e.preventDefault(); cityInput.value = c.name; hideSuggestions(); fetchWeather(c.name + region + ', ' + c.country); });
      suggestionBox.appendChild(item);
    });
    suggestionBox.style.display = 'block';
  }
  async function fetchCitySuggestions(query) {
    if (query.length < 2) { hideSuggestions(); return; }
    try {
      const res  = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=6&language=en&format=json');
      if (!res.ok) return;
      const data = await res.json();
      showSuggestions((data.results || []).map(r => ({ name: r.name, admin1: r.admin1 || '', country: r.country || '' })));
    } catch { hideSuggestions(); }
  }

  if (cityInput) {
    cityInput.value = weatherCity;
    cityInput.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fetchCitySuggestions(cityInput.value.trim()), 280); });
    cityInput.addEventListener('keydown', e => {
      const items = suggestionBox ? suggestionBox.querySelectorAll('.city-suggestion-item') : [];
      if (e.key === 'ArrowDown') { e.preventDefault(); selectedSuggIdx = Math.min(selectedSuggIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('selected', i === selectedSuggIdx)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectedSuggIdx = Math.max(selectedSuggIdx - 1, -1); items.forEach((it, i) => it.classList.toggle('selected', i === selectedSuggIdx)); }
      else if (e.key === 'Enter') { if (selectedSuggIdx >= 0 && items[selectedSuggIdx]) items[selectedSuggIdx].dispatchEvent(new MouseEvent('mousedown')); else { const city = cityInput.value.trim(); if (city) { hideSuggestions(); fetchWeather(city); } } }
      else if (e.key === 'Escape') hideSuggestions();
    });
    cityInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));
    createSuggestionBox();
  }

  if (weatherCity) fetchWeather(weatherCity);
  else if (ntSettings.showClockWeather && ntSettings.weatherCity) window.fetchWeatherForClock(ntSettings.weatherCity);
};

// ── HTML injection ────────────────────────────────────────────────────────────
(function injectWeatherHTML() {
  if (document.getElementById('widget-weather')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-weather">
  <div class="widget-header"><span>🌤</span><span class="widget-title">Weather</span><button class="widget-close" data-close="weather">✕</button></div>
  <div class="weather-body" id="weather-body">
    <div class="weather-icon" id="weather-icon">🌡</div>
    <div class="weather-location" id="weather-location">Enter a city below</div>
    <div class="weather-temp" id="weather-temp">--°</div>
    <div class="weather-desc" id="weather-desc">No data</div>
  </div>
  <div class="weather-input-wrap">
    <input class="weather-city-input" id="weather-city" type="text" placeholder="City name…" autocomplete="off">
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();