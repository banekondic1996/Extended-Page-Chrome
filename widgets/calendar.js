// ══ WIDGET: MINI CALENDAR ════════════════════════════════════════════════════
window.initWidget_calendar = function() {
  var el = document.getElementById('widget-calendar');
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';

  var calYear, calMonth;
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function initCalendar() {
    var now = new Date(); calYear = now.getFullYear(); calMonth = now.getMonth(); renderCalendar();
  }

  function renderCalendar() {
    var grid = document.getElementById('cal-grid');
    var header = document.getElementById('cal-header-title');
    if (!grid || !header) return;
    var now = new Date();
    var today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    header.textContent = MONTHS[calMonth] + ' ' + calYear;
    grid.innerHTML = '';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d) {
      var dh = document.createElement('div'); dh.className = 'cal-day-header'; dh.textContent = d; grid.appendChild(dh);
    });
    var firstDay = new Date(calYear, calMonth, 1).getDay();
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var daysInPrev = new Date(calYear, calMonth, 0).getDate();
    for (var i = firstDay - 1; i >= 0; i--) {
      var cell = document.createElement('div'); cell.className = 'cal-day cal-day-other'; cell.textContent = daysInPrev - i; grid.appendChild(cell);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var cell = document.createElement('div'); cell.className = 'cal-day';
      if (calYear === today.y && calMonth === today.m && d === today.d) cell.classList.add('cal-today');
      var dow = new Date(calYear, calMonth, d).getDay();
      if (dow === 0 || dow === 6) cell.classList.add('cal-weekend');
      cell.textContent = d; grid.appendChild(cell);
    }
    var totalCells = firstDay + daysInMonth;
    var remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (var d = 1; d <= remainder; d++) {
      var cell = document.createElement('div'); cell.className = 'cal-day cal-day-other'; cell.textContent = d; grid.appendChild(cell);
    }
  }

  var prevBtn = document.getElementById('cal-prev');
  var nextBtn = document.getElementById('cal-next');
  var todayBtn = document.getElementById('cal-today-btn');
  if (prevBtn) prevBtn.addEventListener('click', function() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
  if (nextBtn) nextBtn.addEventListener('click', function() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });
  if (todayBtn) todayBtn.addEventListener('click', function() { var n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); renderCalendar(); });

  initCalendar();
};

(function injectCalendarHTML() {
  if (document.getElementById('widget-calendar')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-calendar">' +
    '<div class="widget-header"><span>\uD83D\uDCC5</span><span class="widget-title">Calendar</span>' +
    '<button class="widget-close" data-close="calendar">\u2715</button></div>' +
    '<div class="cal-nav">' +
    '<button id="cal-prev" class="cal-nav-btn">\u2039</button>' +
    '<span id="cal-header-title" class="cal-month-title"></span>' +
    '<button id="cal-next" class="cal-nav-btn">\u203A</button>' +
    '</div>' +
    '<div id="cal-grid" class="cal-grid"></div>' +
    '<div class="cal-footer"><button id="cal-today-btn" class="cal-today-btn">Today</button></div>' +
    '</div>';
  document.body.appendChild(div.firstElementChild);
})();