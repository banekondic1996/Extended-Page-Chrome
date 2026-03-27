// ══ WIDGET: CURRENCY ═════════════════════════════════════════════════════════
window.initWidget_currency = function() {
  if (!document.getElementById('widget-currency')) return;
  const CURRENCIES = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','SEK','NOK','DKK','PLN','CZK','HUF','RON','BGN','HRK','RSD','RUB','TRY','BRL','MXN','INR','IDR','MYR','PHP','SGD','THB','ZAR','KRW','AED','SAR','ILS','NGN','EGP','PKR','BDT','VND','UAH','TWD','HKD'];
  let exchangeRates = null;

  // Guard: ntSettings may not be defined yet when this widget initialises
  const settings = (typeof ntSettings !== 'undefined' && ntSettings) ? ntSettings : {};

  function populateSelects() {
    ['currency-from','currency-to'].forEach((id, idx) => {
      const sel = document.getElementById(id); if (!sel) return;
      CURRENCIES.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.appendChild(opt); });
      sel.value = idx === 0 ? (settings.currencyFrom || 'USD') : (settings.currencyTo || 'EUR');
    });
  }
  populateSelects();

  async function fetchExchangeRates() {
    const rateLabel = document.getElementById('currency-rate');
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error();
      const data = await res.json();
      exchangeRates = data.rates;
      if (rateLabel) rateLabel.textContent = 'Rates loaded • ' + new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'});
      convertCurrency();
    } catch { if (rateLabel) rateLabel.textContent = 'Could not load rates'; }
  }

  function convertCurrency() {
    if (!exchangeRates) return;
    const amount = parseFloat(document.getElementById('currency-amount').value) || 0;
    const from   = document.getElementById('currency-from').value;
    const to     = document.getElementById('currency-to').value;
    if (!exchangeRates[from] || !exchangeRates[to]) return;
    const result = (amount / exchangeRates[from]) * exchangeRates[to];
    const rate   = exchangeRates[to] / exchangeRates[from];
    document.getElementById('currency-result').textContent = result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ' + to;
    document.getElementById('currency-result-input').value = result.toFixed(4);
    document.getElementById('currency-rate').textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
    // Only persist back to ntSettings if it exists
    if (typeof ntSettings !== 'undefined' && ntSettings) {
      ntSettings.currencyFrom = from; ntSettings.currencyTo = to;
      if (typeof saveSettings === 'function') saveSettings();
    }
  }

  document.getElementById('currency-amount').addEventListener('input', convertCurrency);
  document.getElementById('currency-from').addEventListener('change', convertCurrency);
  document.getElementById('currency-to').addEventListener('change', convertCurrency);
  document.getElementById('currency-swap').addEventListener('click', () => {
    const fromSel = document.getElementById('currency-from'), toSel = document.getElementById('currency-to');
    const tmp = fromSel.value; fromSel.value = toSel.value; toSel.value = tmp;
    convertCurrency();
  });

  fetchExchangeRates();
  setInterval(fetchExchangeRates, 30 * 60 * 1000);
};

(function injectCurrencyHTML() {
  if (document.getElementById('widget-currency')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-currency">
  <div class="widget-header"><span>💱</span><span class="widget-title">Currency</span><button class="widget-close" data-close="currency">✕</button></div>
  <div class="currency-body">
    <div class="currency-row">
      <input type="number" id="currency-amount" value="1" min="0" step="any">
      <select class="currency-sel" id="currency-from"></select>
    </div>
    <button class="currency-swap-btn" id="currency-swap">⇅ Swap</button>
    <div class="currency-row">
      <input type="number" id="currency-result-input" value="" placeholder="—" readonly style="color:var(--accent)">
      <select class="currency-sel" id="currency-to"></select>
    </div>
    <div class="currency-result" id="currency-result">—</div>
    <div class="currency-rate" id="currency-rate">Loading rates…</div>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();

// Defer init until storage cache is populated so ntSettings is ready.
(typeof _storageReady !== 'undefined' ? _storageReady : Promise.resolve())
  .then(function() { window.initWidget_currency(); });