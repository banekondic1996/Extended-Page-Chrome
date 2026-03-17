// ══ WIDGET: LEARN LANGUAGE ═══════════════════════════════════════════════════
// WORD_LIST is provided by words.js loaded before this file.
window.initWidget_learn = function() {
  if (!document.getElementById('widget-learn')) return;

  const LANG_CODES = {
    'English':'en','Spanish':'es','French':'fr','German':'de','Italian':'it',
    'Portuguese':'pt','Dutch':'nl','Russian':'ru','Polish':'pl','Swedish':'sv',
    'Norwegian':'no','Danish':'da','Finnish':'fi','Turkish':'tr','Arabic':'ar',
    'Japanese':'ja','Chinese':'zh','Korean':'ko','Hindi':'hi','Greek':'el',
    'Latin':'la','Serbian':'sr',
  };

  const WORD_PERM_KEY = 'nt_word_perm';
  const WORD_POS_KEY  = 'nt_word_pos';
  const WORD_CACHE_KEY = 'nt_word_cache';

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function getNextWordIdx() {
    let perm = LS.get(WORD_PERM_KEY, null);
    let pos  = LS.get(WORD_POS_KEY, 0) || 0;
    if (!perm || perm.length !== WORD_LIST.length || pos >= perm.length) {
      perm = shuffleArray(WORD_LIST.map((_, i) => i)); pos = 0; LS.set(WORD_PERM_KEY, perm);
    }
    const idx = perm[pos]; LS.set(WORD_POS_KEY, pos + 1); return idx;
  }

  let currentWordIdx = getNextWordIdx();

  function getWordCache() { return LS.get(WORD_CACHE_KEY, {}); }
  function setWordCache(c) { LS.set(WORD_CACHE_KEY, c); }

  async function translateWord(word, fromCode, toCode) {
    if (fromCode === toCode) return word;
    const key = `${word}|${fromCode}|${toCode}`;
    const cache = getWordCache();
    if (cache[key]) return cache[key];
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromCode}&tl=${toCode}&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const translated = data?.[0]?.[0]?.[0];
      if (!translated) throw new Error();
      const clean = sanitizeText(translated).trim();
      if (!clean) throw new Error();
      cache[key] = clean; setWordCache(cache); return clean;
    } catch { return word; }
  }

  function googleTTSUrl(text, langCode) {
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=gtx`;
  }

  let _lastW1 = '', _lastW2 = '', _lastCode1 = 'en', _lastCode2 = 'fr';

  async function showLearnWord(idx, animate) {
    const pairEl = document.getElementById('word-pair');
    const langEl = document.getElementById('word-lang-display');
    if (!pairEl) return;
    const word  = WORD_LIST[idx % WORD_LIST.length];
    const lang1 = ntSettings.wordLang1 || 'English';
    const lang2 = ntSettings.wordLang2 || 'French';
    const code1 = LANG_CODES[lang1] || 'en';
    const code2 = LANG_CODES[lang2] || 'fr';
    if (langEl) langEl.textContent = lang1 + ' – ' + lang2;

    const applyWords = (w1, w2) => {
      const c1 = sanitizeText(w1); const c2 = sanitizeText(w2);
      const cap1 = c1.charAt(0).toUpperCase() + c1.slice(1);
      const cap2 = c2.charAt(0).toUpperCase() + c2.slice(1);
      if (cap2 !== '…') { _lastW1 = cap1; _lastW2 = cap2; _lastCode1 = code1; _lastCode2 = code2; }
      if (animate) {
        pairEl.classList.add('fade-out');
        setTimeout(() => { pairEl.innerHTML = `${cap1}<span class="word-separator">–</span>${cap2}`; pairEl.classList.remove('fade-out'); }, 350);
      } else {
        pairEl.innerHTML = `${cap1}<span class="word-separator">–</span>${cap2}`;
      }
    };

    const capWord = word.charAt(0).toUpperCase() + word.slice(1);
    applyWords(capWord, '…');
    const [w1, w2] = await Promise.all([
      code1 === 'en' ? Promise.resolve(capWord) : translateWord(word, 'en', code1),
      code2 === 'en' ? Promise.resolve(capWord) : translateWord(word, 'en', code2),
    ]);
    applyWords(w1, w2);
  }

  document.getElementById('word-next').addEventListener('click', () => {
    currentWordIdx = (currentWordIdx + 1) % WORD_LIST.length;
    showLearnWord(currentWordIdx, true);
  });

  // Speak button
  const speakBtn = document.getElementById('word-speak');
  if (speakBtn) {
    function playAudio(url) {
      return new Promise((resolve, reject) => {
        const audio = new Audio(url); audio.onended = resolve; audio.onerror = reject;
        audio.play().catch(reject);
      });
    }
    speakBtn.addEventListener('click', async () => {
      if (!_lastW2) return;
      speakBtn.disabled = true; speakBtn.textContent = '…';
      try {
        await playAudio(googleTTSUrl(_lastW2, _lastCode2));
      } catch {
        try {
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(_lastW2); u.lang = _lastCode2;
            window.speechSynthesis.speak(u);
          }
        } catch {}
      }
      speakBtn.disabled = false; speakBtn.textContent = 'Speak';
    });
  }

  // Language pickers (in settings panel — wired here)
  const lang1Sel = document.getElementById('word-lang1');
  const lang2Sel = document.getElementById('word-lang2');
  if (lang1Sel) {
    lang1Sel.value = ntSettings.wordLang1 || 'English';
    lang1Sel.addEventListener('change', e => { ntSettings.wordLang1 = e.target.value; saveSettings(); showLearnWord(currentWordIdx, false); });
  }
  if (lang2Sel) {
    lang2Sel.value = ntSettings.wordLang2 || 'French';
    lang2Sel.addEventListener('change', e => { ntSettings.wordLang2 = e.target.value; saveSettings(); showLearnWord(currentWordIdx, false); });
  }

  showLearnWord(currentWordIdx, false);
};

(function injectLearnHTML() {
  if (document.getElementById('widget-learn')) return;
  const div = document.createElement('div');
  div.innerHTML = `<div class="widget" id="widget-learn">
  <div class="widget-header"><span>🔤</span><span class="widget-title">Learn Language</span>
    <button class="widget-transparent-btn" data-target="widget-learn" title="Toggle transparent style">•</button>
    <button class="widget-close" data-close="learn">✕</button>
  </div>
  <div class="word-body">
    <div class="word-pair" id="word-pair">—</div>
    <div class="word-lang-display" id="word-lang-display">English – French</div>
  </div>
  <div class="word-footer">
    <button class="word-speak-btn" id="word-speak">Speak</button>
    <button class="quotes-next-btn" id="word-next">Next →</button>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
})();