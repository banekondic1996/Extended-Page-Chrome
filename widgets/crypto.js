// ══ WIDGET: CRYPTO TRACKER ═══════════════════════════════════════════════════

// ── HTML injection (must run FIRST so the element exists when logic runs) ─────
(function injectCryptoHTML() {
  if (document.getElementById('widget-crypto')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="widget" id="widget-crypto">' +
    '<div class="widget-header"><span>\u20BF</span><span class="widget-title">Crypto</span>' +
    '<button class="widget-close" data-close="crypto">\u2715</button></div>' +
    '<div id="crypto-list" class="crypto-list"></div>' +
    '<div class="crypto-search-row"><div class="crypto-search-wrap">' +
    '<input type="text" id="crypto-search-input" class="crypto-search-input" placeholder="Search coin\u2026" autocomplete="off" spellcheck="false">' +
    '<button id="crypto-add-btn" class="crypto-add-btn">+</button>' +
    '</div></div></div>';
  document.body.appendChild(div.firstElementChild);
})();

// ── Widget logic ──────────────────────────────────────────────────────────────
(function() {
  var el = document.getElementById('widget-crypto');
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';

  var LS_KEY = 'nt_crypto_tracked', CACHE_KEY = 'nt_crypto_cache', CACHE_TTL = 60000;
  var COIN_LIST = [
    {id:'bitcoin',symbol:'BTC',name:'Bitcoin'},{id:'ethereum',symbol:'ETH',name:'Ethereum'},
    {id:'tether',symbol:'USDT',name:'Tether'},{id:'binancecoin',symbol:'BNB',name:'BNB'},
    {id:'solana',symbol:'SOL',name:'Solana'},{id:'usd-coin',symbol:'USDC',name:'USD Coin'},
    {id:'ripple',symbol:'XRP',name:'XRP'},{id:'dogecoin',symbol:'DOGE',name:'Dogecoin'},
    {id:'cardano',symbol:'ADA',name:'Cardano'},{id:'avalanche-2',symbol:'AVAX',name:'Avalanche'},
    {id:'polkadot',symbol:'DOT',name:'Polkadot'},{id:'tron',symbol:'TRX',name:'TRON'},
    {id:'chainlink',symbol:'LINK',name:'Chainlink'},{id:'polygon',symbol:'MATIC',name:'Polygon'},
    {id:'litecoin',symbol:'LTC',name:'Litecoin'},{id:'shiba-inu',symbol:'SHIB',name:'Shiba Inu'},
    {id:'bitcoin-cash',symbol:'BCH',name:'Bitcoin Cash'},{id:'uniswap',symbol:'UNI',name:'Uniswap'},
    {id:'stellar',symbol:'XLM',name:'Stellar'},{id:'monero',symbol:'XMR',name:'Monero'},
    {id:'near',symbol:'NEAR',name:'NEAR Protocol'},{id:'cosmos',symbol:'ATOM',name:'Cosmos'},
    {id:'the-open-network',symbol:'TON',name:'Toncoin'},{id:'aptos',symbol:'APT',name:'Aptos'},
    {id:'arbitrum',symbol:'ARB',name:'Arbitrum'},{id:'sui',symbol:'SUI',name:'Sui'},
  ];

  function getTracked() { return LS.get(LS_KEY, ['bitcoin','ethereum','solana']); }
  function saveTracked(list) { LS.set(LS_KEY, list); }
  function getCoinMeta(id) { return COIN_LIST.find(function(c){return c.id===id;}) || {id:id,symbol:id.toUpperCase(),name:id}; }
  function formatPrice(p) {
    if (p===null||p===undefined) return '\u2014';
    if (p>=1000) return '$'+p.toLocaleString('en-US',{maximumFractionDigits:2});
    if (p>=1)    return '$'+p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4});
    return '$'+p.toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:8});
  }
  function formatChange(pct) { if (pct===null||pct===undefined) return ''; var s=pct>=0?'+':''; return s+pct.toFixed(2)+'%'; }

  async function fetchPrices(ids) {
    var cache = LS.get(CACHE_KEY, {}); var now = Date.now();
    var stale = ids.filter(function(id){return !cache[id]||(now-(cache[id].ts||0))>CACHE_TTL;});
    if (stale.length) {
      try {
        var res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+stale.join(',')+'&vs_currencies=usd&include_24hr_change=true');
        if (res.ok) {
          var data = await res.json();
          stale.forEach(function(id){if(data[id])cache[id]={price:data[id].usd,change:data[id].usd_24h_change,ts:now};});
          LS.set(CACHE_KEY, cache);
        }
      } catch(e){}
    }
    return cache;
  }

  async function renderCryptoList() {
    var container = document.getElementById('crypto-list');
    if (!container) return;
    var ids = getTracked();
    if (!ids.length) { container.innerHTML = '<div class="crypto-empty">Add coins with + below</div>'; return; }
    container.innerHTML = '';
    ids.forEach(function(id) {
      var meta = getCoinMeta(id);
      var row = document.createElement('div'); row.className = 'crypto-row'; row.id = 'crypto-row-'+id;
      row.innerHTML =
        '<div class="crypto-info"><span class="crypto-symbol">'+meta.symbol+'</span><span class="crypto-name-lbl">'+meta.name+'</span></div>' +
        '<div class="crypto-price-col"><span class="crypto-price" id="crypto-price-'+id+'">\u2026</span><span class="crypto-change" id="crypto-change-'+id+'"></span></div>' +
        '<button class="crypto-remove" data-id="'+id+'" title="Remove">\u2715</button>';
      container.appendChild(row);
    });
    container.querySelectorAll('.crypto-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.dataset.id; saveTracked(getTracked().filter(function(t){return t!==id;})); renderCryptoList();
      });
    });
    var cache = await fetchPrices(ids);
    ids.forEach(function(id) {
      var d = cache[id]; if (!d) return;
      var pe = document.getElementById('crypto-price-'+id); if (pe) pe.textContent = formatPrice(d.price);
      var ce = document.getElementById('crypto-change-'+id);
      if (ce) { ce.textContent = formatChange(d.change); ce.className = 'crypto-change '+(d.change>=0?'crypto-up':'crypto-down'); }
    });
  }

  var suggestBox = null, suggestIdx = -1;
  function hideSuggestions() { if (suggestBox) suggestBox.style.display = 'none'; suggestIdx = -1; }
  function filterCoins(q) {
    if (!q) return [];
    var lq = q.toLowerCase(), tracked = getTracked();
    return COIN_LIST.filter(function(c){return (c.name.toLowerCase().includes(lq)||c.symbol.toLowerCase().includes(lq))&&!tracked.includes(c.id);}).slice(0,7);
  }
  function showSuggestions(coins) {
    var input = document.getElementById('crypto-search-input'); if (!input) return;
    if (!suggestBox) { suggestBox = document.createElement('div'); suggestBox.className = 'crypto-suggestions'; input.parentElement.appendChild(suggestBox); }
    suggestBox.innerHTML = ''; suggestIdx = -1;
    if (!coins.length) { suggestBox.style.display = 'none'; return; }
    coins.forEach(function(coin) {
      var item = document.createElement('div'); item.className = 'crypto-suggest-item';
      item.innerHTML = '<span class="csi-symbol">'+coin.symbol+'</span><span class="csi-name">'+coin.name+'</span>';
      item.addEventListener('mousedown', function(e) { e.preventDefault(); addCoin(coin.id); input.value=''; hideSuggestions(); });
      suggestBox.appendChild(item);
    });
    suggestBox.style.display = 'block';
  }
  function addCoin(id) { var t = getTracked(); if (t.includes(id)) return; t.push(id); saveTracked(t); renderCryptoList(); }

  var cryptoInput = document.getElementById('crypto-search-input');
  if (cryptoInput) {
    cryptoInput.addEventListener('input', function() { showSuggestions(filterCoins(cryptoInput.value.trim())); });
    cryptoInput.addEventListener('keydown', function(e) {
      var items = suggestBox ? suggestBox.querySelectorAll('.crypto-suggest-item') : [];
      if (e.key==='ArrowDown'){e.preventDefault();suggestIdx=Math.min(suggestIdx+1,items.length-1);items.forEach(function(it,i){it.classList.toggle('selected',i===suggestIdx);});}
      else if(e.key==='ArrowUp'){e.preventDefault();suggestIdx=Math.max(suggestIdx-1,-1);items.forEach(function(it,i){it.classList.toggle('selected',i===suggestIdx);});}
      else if(e.key==='Enter'){
        if(suggestIdx>=0&&items[suggestIdx])items[suggestIdx].dispatchEvent(new MouseEvent('mousedown'));
        else{var m=filterCoins(cryptoInput.value.trim());if(m.length){addCoin(m[0].id);cryptoInput.value='';hideSuggestions();}}
      }
      else if(e.key==='Escape')hideSuggestions();
    });
    cryptoInput.addEventListener('blur', function(){setTimeout(hideSuggestions,150);});
  }
  var addBtn = document.getElementById('crypto-add-btn');
  if (addBtn) addBtn.addEventListener('click', function() {
    var input = document.getElementById('crypto-search-input'); if (!input) return;
    var m = filterCoins(input.value.trim()); if (m.length) { addCoin(m[0].id); input.value=''; hideSuggestions(); }
  });

  renderCryptoList();
  setInterval(renderCryptoList, 60000);
})();