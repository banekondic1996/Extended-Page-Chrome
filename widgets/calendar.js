// ════════════════════════════════════════════ MINI CALENDAR WIDGET
(function() {
  let calYear, calMonth;

  function initCalendar() {
    const now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();
  }

  function renderCalendar() {
    const grid   = document.getElementById('cal-grid');
    const header = document.getElementById('cal-header-title');
    if (!grid || !header) return;

    const now   = new Date();
    const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    header.textContent = MONTHS[calMonth] + ' ' + calYear;

    // Build day headers
    grid.innerHTML = '';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
      const dh = document.createElement('div');
      dh.className = 'cal-day-header';
      dh.textContent = d;
      grid.appendChild(dh);
    });

    // First day of month
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev  = new Date(calYear, calMonth, 0).getDate();

    // Prev month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'cal-day cal-day-other';
      cell.textContent = daysInPrev - i;
      grid.appendChild(cell);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      const isToday = (calYear === today.y && calMonth === today.m && d === today.d);
      if (isToday) cell.classList.add('cal-today');
      const isWeekend = (() => { const dow = new Date(calYear, calMonth, d).getDay(); return dow === 0 || dow === 6; })();
      if (isWeekend) cell.classList.add('cal-weekend');
      cell.textContent = d;
      grid.appendChild(cell);
    }

    // Next month filler to complete last row
    const totalCells = firstDay + daysInMonth;
    const remainder  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remainder; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day cal-day-other';
      cell.textContent = d;
      grid.appendChild(cell);
    }
  }

  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  const todayBtn = document.getElementById('cal-today-btn');

  if (prevBtn) prevBtn.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  if (todayBtn) todayBtn.addEventListener('click', () => {
    const now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();
  });

  initCalendar();
})();
