document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  const textInput = $('text-input'), counter = $('counter'), analyzeBtn = $('analyze');
  const loading = $('loading'), result = $('result');
  const scoreEl = $('score'), corrigidoEl = $('corrigido'), explicacaoEl = $('explicacao'), errorEl = $('error');
  const recordBtn = $('record'), micText = $('mic-text');
  const historyBox = $('history-box'), historyList = $('history');

  const dialeto = () => document.querySelector('input[name="dialeto"]:checked').value;

  // ---------- Armazenamento seguro ----------
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ---------- Tema (claro/escuro) e cor ----------
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  function setTheme(t) {
    root.dataset.theme = t;
    $('theme-toggle').textContent = t === 'dark' ? '☀️' : '🌙';
    store.set('theme', t);
  }
  function setAccent(a) {
    root.dataset.accent = a;
    document.querySelectorAll('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.accent === a));
    store.set('accent', a);
  }
  setTheme(store.get('theme', prefersDark ? 'dark' : 'light'));
  setAccent(store.get('accent', 'blue'));
  $('theme-toggle').onclick = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  document.querySelectorAll('#swatches button').forEach(b => b.onclick = () => setAccent(b.dataset.accent));

  // Lembra o dialeto escolhido
  const savedDialect = store.get('dialeto', 'en-US');
  document.querySelector(`input[name="dialeto"][value="${savedDialect}"]`).checked = true;
  document.querySelectorAll('input[name="dialeto"]').forEach(r => r.onchange = () => store.set('dialeto', dialeto()));

  // ---------- Modos escrever/falar ----------
  function setMode(speak) {
    $('write').hidden = speak; $('speak').hidden = !speak;
    $('mode-write').classList.toggle('on', !speak);
    $('mode-speak').classList.toggle('on', speak);
  }
  $('mode-write').onclick = () => setMode(false);
  $('mode-speak').onclick = () => setMode(true);

  textInput.oninput = () => counter.textContent = `${textInput.value.length}/500`;
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyzeBtn.click();
  });

  // ---------- Análise ----------
  async function analisar(texto, dial) {
    loading.hidden = false; result.hidden = true; analyzeBtn.disabled = true;
    try {
      const res = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, dialeto: dial }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
      mostrar(data);
      salvarHistorico({ texto, dialeto: dial, ...data });
    } catch (err) {
      console.error(err);
      scoreEl.textContent = '–';
      scoreEl.parentElement.className = 'score';
      corrigidoEl.textContent = 'Não foi possível analisar agora.';
      explicacaoEl.textContent = '';
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      result.hidden = false;
    } finally {
      loading.hidden = true; analyzeBtn.disabled = false;
    }
  }

  function mostrar(d) {
    scoreEl.textContent = d.score;
    scoreEl.parentElement.className = 'score ' + (d.score >= 80 ? 'ok' : d.score >= 50 ? 'mid' : 'low');
    corrigidoEl.textContent = d.corrigido;
    explicacaoEl.textContent = d.explicacao;
    errorEl.hidden = true;
    result.hidden = false;
    result.dataset.dialeto = d.dialeto || dialeto();
  }

  analyzeBtn.onclick = () => {
    const t = textInput.value.trim();
    if (t) analisar(t, dialeto());
  };

  // ---------- Ouvir e copiar ----------
  $('listen').onclick = () => {
    if (!('speechSynthesis' in window)) return alert('Seu navegador não suporta áudio.');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(corrigidoEl.textContent);
    u.lang = result.dataset.dialeto || dialeto();
    u.rate = 0.9;
    speechSynthesis.speak(u);
  };
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(corrigidoEl.textContent); $('copy').textContent = '✅ Copiado'; }
    catch { $('copy').textContent = 'Não copiou'; }
    setTimeout(() => $('copy').textContent = '📋 Copiar', 1500);
  };

  // ---------- Reconhecimento de voz ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const rec = new SR();
    let gravando = false;
    rec.continuous = false; rec.interimResults = false;
    const parar = () => { gravando = false; recordBtn.classList.remove('recording'); micText.textContent = 'Toque para falar'; };

    recordBtn.onclick = () => {
      if (gravando) return rec.stop();
      rec.lang = dialeto();
      result.hidden = true;
      rec.start();
      gravando = true;
      recordBtn.classList.add('recording');
      micText.textContent = 'Ouvindo… toque para parar';
    };
    rec.onresult = (e) => {
      const fala = e.results[0][0].transcript;
      textInput.value = fala; counter.textContent = `${fala.length}/500`;
      analisar(fala, rec.lang);
    };
    rec.onend = parar;
    rec.onerror = (e) => { parar(); micText.textContent = e.error === 'not-allowed' ? 'Permita o microfone no navegador' : 'Erro ao gravar. Tente de novo.'; };
  } else {
    $('mode-speak').disabled = true;
    $('mode-speak').title = 'Use o Chrome ou Edge para falar';
  }

  // ---------- Histórico ----------
  function salvarHistorico(item) {
    const lista = [item, ...store.get('historico', [])].slice(0, 5);
    store.set('historico', lista);
    renderHistorico();
  }
  function renderHistorico() {
    const lista = store.get('historico', []);
    historyBox.hidden = lista.length === 0;
    historyList.innerHTML = '';
    lista.forEach((it) => {
      const li = document.createElement('li');
      const a = document.createElement('div'); a.textContent = it.texto;
      const b = document.createElement('small'); b.textContent = `${it.score}% → ${it.corrigido}`;
      li.append(a, b);
      li.onclick = () => { textInput.value = it.texto; counter.textContent = `${it.texto.length}/500`; mostrar(it); };
      historyList.append(li);
    });
  }
  $('clear').onclick = () => { store.set('historico', []); renderHistorico(); };
  renderHistorico();
});
