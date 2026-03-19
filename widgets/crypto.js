// ════════════════════════════════════════════ CRYPTO WIDGET
(function() {
  const LS_KEY = 'nt_crypto_tracked';
  const CACHE_KEY = 'nt_crypto_cache';
  const CACHE_TTL = 60 * 1000; // 1 minute

  // Popular coins for autocomplete — id, symbol, name
  const COIN_LIST = [
    { id:'bitcoin',        symbol:'BTC',  name:'Bitcoin' },
    { id:'ethereum',       symbol:'ETH',  name:'Ethereum' },
    { id:'tether',         symbol:'USDT', name:'Tether' },
    { id:'binancecoin',    symbol:'BNB',  name:'BNB' },
    { id:'solana',         symbol:'SOL',  name:'Solana' },
    { id:'usd-coin',       symbol:'USDC', name:'USD Coin' },
    { id:'ripple',         symbol:'XRP',  name:'XRP' },
    { id:'dogecoin',       symbol:'DOGE', name:'Dogecoin' },
    { id:'cardano',        symbol:'ADA',  name:'Cardano' },
    { id:'avalanche-2',    symbol:'AVAX', name:'Avalanche' },
    { id:'polkadot',       symbol:'DOT',  name:'Polkadot' },
    { id:'tron',           symbol:'TRX',  name:'TRON' },
    { id:'chainlink',      symbol:'LINK', name:'Chainlink' },
    { id:'polygon',        symbol:'MATIC',name:'Polygon' },
    { id:'litecoin',       symbol:'LTC',  name:'Litecoin' },
    { id:'shiba-inu',      symbol:'SHIB', name:'Shiba Inu' },
    { id:'bitcoin-cash',   symbol:'BCH',  name:'Bitcoin Cash' },
    { id:'uniswap',        symbol:'UNI',  name:'Uniswap' },
    { id:'stellar',        symbol:'XLM',  name:'Stellar' },
    { id:'monero',         symbol:'XMR',  name:'Monero' },
    { id:'ethereum-classic',symbol:'ETC', name:'Ethereum Classic' },
    { id:'filecoin',       symbol:'FIL',  name:'Filecoin' },
    { id:'internet-computer',symbol:'ICP',name:'Internet Computer' },
    { id:'hedera',         symbol:'HBAR', name:'Hedera' },
    { id:'vechain',        symbol:'VET',  name:'VeChain' },
    { id:'aave',           symbol:'AAVE', name:'Aave' },
    { id:'the-sandbox',    symbol:'SAND', name:'The Sandbox' },
    { id:'decentraland',   symbol:'MANA', name:'Decentraland' },
    { id:'axie-infinity',  symbol:'AXS',  name:'Axie Infinity' },
    { id:'near',           symbol:'NEAR', name:'NEAR Protocol' },
    { id:'cosmos',         symbol:'ATOM', name:'Cosmos' },
    { id:'algorand',       symbol:'ALGO', name:'Algorand' },
    { id:'tezos',          symbol:'XTZ',  name:'Tezos' },
    { id:'the-open-network',symbol:'TON', name:'Toncoin' },
    { id:'aptos',          symbol:'APT',  name:'Aptos' },
    { id:'arbitrum',       symbol:'ARB',  name:'Arbitrum' },
    { id:'optimism',       symbol:'OP',   name:'Optimism' },
    { id:'sui',            symbol:'SUI',  name:'Sui' },
  ];

  function getTracked() { return LS.get(LS_KEY, ['bitcoin','ethereum','solana']); }
  function saveTracked(list) { LS.set(LS_KEY, list); }

  function getCoinMeta(id) { return COIN_LIST.find(c => c.id === id) || { id, symbol: id.toUpperCase(), name: id }; }

  function formatPrice(p) {
    if (p === null || p === undefined) return '—';
    if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (p >= 1)    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
  }

  function formatChange(pct) {
    if (pct === null || pct === undefined) return '';
    const sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  async function fetchPrices(ids) {
    const cache = LS.get(CACHE_KEY, {});
    const now = Date.now();
    const stale = ids.filter(id => !cache[id] || (now - (cache[id].ts || 0)) > CACHE_TTL);

    if (stale.length > 0) {
      try {
        const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + stale.join(',') + '&vs_currencies=usd&include_24hr_change=true';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          stale.forEach(id => {
            if (data[id]) cache[id] = { price: data[id].usd, change: data[id].usd_24h_change, ts: now };
          });
          LS.set(CACHE_KEY, cache);
        }
      } catch {}
    }
    return cache;
  }

  async function renderCryptoList() {
    const container = document.getElementById('crypto-list');
    if (!container) return;
    const ids = getTracked();

    if (!ids.length) {
      container.innerHTML = '<div class="crypto-empty">Add coins with + below</div>';
      return;
    }

    // Render placeholders immediately
    container.innerHTML = '';
    ids.forEach(id => {
      const meta = getCoinMeta(id);
      const row = document.createElement('div');
      row.className = 'crypto-row';
      row.id = 'crypto-row-' + id;
      row.innerHTML = `
        <div class="crypto-info">
          <span class="crypto-symbol">${meta.symbol}</span>
          <span class="crypto-name">${meta.name}</span>
        </div>
        <div class="crypto-price-col">
          <span class="crypto-price" id="crypto-price-${id}">…</span>
          <span class="crypto-change" id="crypto-change-${id}"></span>
        </div>
        <button class="crypto-remove" data-id="${id}" title="Remove">✕</button>
      `;
      container.appendChild(row);
    });

    // Wire remove buttons
    container.querySelectorAll('.crypto-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const tracked = getTracked().filter(t => t !== id);
        saveTracked(tracked);
        renderCryptoList();
      });
    });

    // Fetch and fill prices
    const cache = await fetchPrices(ids);
    ids.forEach(id => {
      const priceEl  = document.getElementById('crypto-price-' + id);
      const changeEl = document.getElementById('crypto-change-' + id);
      const data = cache[id];
      if (!data) return;
      if (priceEl)  priceEl.textContent  = formatPrice(data.price);
      if (changeEl) {
        changeEl.textContent = formatChange(data.change);
        changeEl.className = 'crypto-change ' + (data.change >= 0 ? 'crypto-up' : 'crypto-down');
      }
    });
  }

  // ── Autocomplete
  let cryptoSuggestBox = null, cryptoSuggestItems = [], cryptoSuggestIdx = -1;

  function hideCryptoSuggestions() {
    if (cryptoSuggestBox) cryptoSuggestBox.style.display = 'none';
    cryptoSuggestIdx = -1;
  }

  function showCryptoSuggestions(coins) {
    const input = document.getElementById('crypto-search-input');
    if (!input) return;
    if (!cryptoSuggestBox) {
      cryptoSuggestBox = document.createElement('div');
      cryptoSuggestBox.className = 'crypto-suggestions';
      input.parentElement.appendChild(cryptoSuggestBox);
    }
    cryptoSuggestBox.innerHTML = '';
    cryptoSuggestItems = coins;
    cryptoSuggestIdx = -1;
    if (!coins.length) { cryptoSuggestBox.style.display = 'none'; return; }
    coins.forEach(coin => {
      const item = document.createElement('div');
      item.className = 'crypto-suggest-item';
      item.innerHTML = `<span class="csi-symbol">${coin.symbol}</span><span class="csi-name">${coin.name}</span>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        addCoin(coin.id);
        input.value = '';
        hideCryptoSuggestions();
      });
      cryptoSuggestBox.appendChild(item);
    });
    cryptoSuggestBox.style.display = 'block';
  }

  function filterCoins(query) {
    if (!query) { hideCryptoSuggestions(); return; }
    const q = query.toLowerCase();
    const tracked = getTracked();
    return COIN_LIST.filter(c =>
      (c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)) && !tracked.includes(c.id)
    ).slice(0, 7);
  }

  function addCoin(id) {
    const tracked = getTracked();
    if (tracked.includes(id)) return;
    tracked.push(id);
    saveTracked(tracked);
    renderCryptoList();
  }

  // Wire search input
  const cryptoInput = document.getElementById('crypto-search-input');
  if (cryptoInput) {
    cryptoInput.addEventListener('input', () => {
      const results = filterCoins(cryptoInput.value.trim());
      if (results) showCryptoSuggestions(results);
    });
    cryptoInput.addEventListener('keydown', e => {
      const items = cryptoSuggestBox ? cryptoSuggestBox.querySelectorAll('.crypto-suggest-item') : [];
      if (e.key === 'ArrowDown') { e.preventDefault(); cryptoSuggestIdx = Math.min(cryptoSuggestIdx + 1, items.length - 1); items.forEach((it,i) => it.classList.toggle('selected', i === cryptoSuggestIdx)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cryptoSuggestIdx = Math.max(cryptoSuggestIdx - 1, -1); items.forEach((it,i) => it.classList.toggle('selected', i === cryptoSuggestIdx)); }
      else if (e.key === 'Enter') {
        if (cryptoSuggestIdx >= 0 && items[cryptoSuggestIdx]) items[cryptoSuggestIdx].dispatchEvent(new MouseEvent('mousedown'));
        else { const q = cryptoInput.value.trim(); const matches = filterCoins(q); if (matches && matches.length) { addCoin(matches[0].id); cryptoInput.value = ''; hideCryptoSuggestions(); } }
      }
      else if (e.key === 'Escape') hideCryptoSuggestions();
    });
    cryptoInput.addEventListener('blur', () => setTimeout(hideCryptoSuggestions, 150));
  }

  const cryptoAddBtn = document.getElementById('crypto-add-btn');
  if (cryptoAddBtn) cryptoAddBtn.addEventListener('click', () => {
    const input = document.getElementById('crypto-search-input');
    if (!input) return;
    const q = input.value.trim();
    const matches = filterCoins(q);
    if (matches && matches.length) { addCoin(matches[0].id); input.value = ''; hideCryptoSuggestions(); }
  });

  // Auto-refresh every 60s
  renderCryptoList();
  setInterval(renderCryptoList, 60 * 1000);
})();
