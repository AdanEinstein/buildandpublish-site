// BuildAndPublish — site. Sem dependências. Respeita prefers-reduced-motion (estados finais, sem loops).
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage: segue sem lembrar */ } },
  };

  // --- idioma (o <head> já aplicou o idioma salvo, aqui só o alternador) ---
  const setLang = (l) => {
    root.lang = l;
    store.set('bnp-lang', l);
    document.querySelectorAll('.lang').forEach((b) => { b.textContent = l === 'en' ? 'PT' : 'EN'; b.setAttribute('aria-label', l === 'en' ? 'Mudar para português' : 'Switch to English'); });
  };
  document.querySelectorAll('.lang').forEach((b) => b.addEventListener('click', () => setLang(root.lang === 'en' ? 'pt-BR' : 'en')));
  setLang(root.lang === 'en' ? 'en' : 'pt-BR');

  // --- tema (mesma chave do painel: bnp-theme; escuro por padrão) ---
  const setTheme = (t) => {
    root.dataset.theme = t; store.set('bnp-theme', t);
    document.getElementById('theme-color')?.setAttribute('content', t === 'light' ? '#ffffff' : '#000000');
    document.querySelectorAll('.theme').forEach((b) => { b.textContent = t === 'light' ? '☾' : '☀'; b.setAttribute('aria-label', root.lang === 'en' ? 'Toggle theme' : 'Alternar tema'); });
  };
  document.querySelectorAll('.theme').forEach((b) => b.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light')));
  setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');

  // --- régua: playhead + timecode seguem o scroll (cada rolagem "reproduz" a timeline) ---
  const rail = document.querySelector('.rail');
  const tcEl = document.getElementById('tc');
  if (rail && tcEl) {
    const FPS = 24, TOTAL = 96; // s de "timeline" mapeados em toda a página
    let queued = false;
    const draw = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      rail.style.setProperty('--p', p.toFixed(4));
      const f = Math.round(p * TOTAL * FPS);
      const pad = (n) => String(n).padStart(2, '0');
      tcEl.textContent = `${pad(Math.floor(f / FPS / 60))}:${pad(Math.floor(f / FPS) % 60)}:${pad(f % FPS)}`;
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(draw); } }, { passive: true });
    addEventListener('resize', draw);
    draw();
  }

  // --- animações disparam quando o "playhead" chega no clip ---
  const anims = document.querySelectorAll('[data-anim]');
  if (still || !('IntersectionObserver' in window)) {
    anims.forEach((el) => el.classList.add('is-playing'));
  } else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      e.target.classList.toggle('is-playing', e.isIntersecting);
      e.target.dispatchEvent(new CustomEvent(e.isIntersecting ? 'play' : 'stop'));
    }), { threshold: 0.3 });
    anims.forEach((el) => io.observe(el));
  }

  // --- hero: smart reframe (crop 9:16 segue o rosto com mola criticamente amortecida) ---
  const world = document.getElementById('reframe');
  if (world) {
    const W = 640, H = 360, CW = H * 9 / 16;
    const $ = (id) => document.getElementById(id);
    const person = $('rf-person'), crop = $('rf-crop'), shadeL = $('rf-shade-l'), shadeR = $('rf-shade-r'), mirror = $('rf-mirror'), face = $('rf-face'), score = $('rf-score');
    let x = 0, v = 0, cx = 0, t = 0, last = 0, raf = 0;
    const frame = (ts) => {
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; t += dt;
      // locutor anda de um lado a outro, com pausas
      x = W / 2 + Math.sin(t * 0.55) * 190 + Math.sin(t * 1.3) * 22;
      person.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
      // mola criticamente amortecida até o centro do rosto (alvo = x), igual ao conceito do SpeakerTracker
      const target = Math.min(W - CW / 2, Math.max(CW / 2, x));
      const w0 = 7; const d = cx - target;
      v += (-w0 * w0 * d - 2 * w0 * v) * dt; cx += v * dt;
      const left = cx - CW / 2;
      crop.setAttribute('x', left.toFixed(1));
      shadeL.setAttribute('width', Math.max(0, left).toFixed(1));
      shadeR.setAttribute('x', (left + CW).toFixed(1)); shadeR.setAttribute('width', Math.max(0, W - left - CW).toFixed(1));
      mirror.setAttribute('transform', `translate(${(-left).toFixed(1)} 0)`);
      face.setAttribute('x', (x - 34).toFixed(1));
      score.setAttribute('x', (x - 34).toFixed(1));
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    if (still) { x = W * 0.42; cx = x; t = 1; frame(performance.now()); stop(); }
    else {
      const host = world.closest('[data-anim]');
      host.addEventListener('play', start); host.addEventListener('stop', stop);
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : host.classList.contains('is-playing') && start()));
    }
  }

  // --- terminal: o agente digita o comando e o job avança ---
  const term = document.getElementById('term');
  if (term) {
    const script = [
      ['p', '> /bnp-youtube-shorts https://youtu.be/…  tema: "3 erros de quem começa"'],
      ['', '▸ job 7f3a criado — fila: 0'],
      ['', '▸ baixando o vídeo (yt-dlp)'],
      ['', '▸ cortando os trechos com mais retenção'],
      ['', '▸ enquadrando em 9:16 seguindo o locutor'],
      ['', '▸ narrando com TTS e aplicando SFX'],
      ['', '▸ gerando título, descrição e thumbnail'],
      ['ok', '✓ publicado no YouTube Shorts · agendado 18:00'],
    ];
    let timers = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const render = (n, partial) => {
      term.textContent = '';
      script.slice(0, n).forEach(([k, s]) => addLine(k, s));
      if (partial != null) addLine(script[n][0], partial, true);
    };
    const addLine = (k, s, caret) => {
      const d = document.createElement('div');
      d.className = 'term__line' + (k === 'p' ? ' term__p' : k === 'ok' ? ' term__ok' : '') + (caret ? ' term__caret' : '');
      d.textContent = s; term.appendChild(d);
    };
    const play = () => {
      clear();
      const cmd = script[0][1]; let i = 0;
      const type = () => {
        render(0, cmd.slice(0, i));
        if (i++ < cmd.length) timers.push(setTimeout(type, 28));
        else step(1);
      };
      const step = (n) => {
        render(n);
        timers.push(setTimeout(() => (n < script.length ? step(n + 1) : timers.push(setTimeout(play, 3500))), n === 1 ? 500 : 750));
      };
      type();
    };
    if (still) render(script.length);
    else { const host = term.closest('[data-anim]'); host.addEventListener('play', play); host.addEventListener('stop', clear); }
  }

  // --- barra de ondas do hero: alturas e atrasos variados (determinístico, sem Math.random) ---
  document.querySelectorAll('.wave').forEach((w) => {
    for (let i = 0; i < 56; i++) {
      const b = document.createElement('i');
      b.style.animationDelay = `${-((i * 37) % 11) / 10}s`;
      b.style.animationDuration = `${0.7 + ((i * 53) % 7) / 10}s`;
      w.appendChild(b);
    }
  });

  // --- botões "copiar" nos blocos de código ---
  document.querySelectorAll('.pre').forEach((pre) => {
    const b = document.createElement('button');
    b.className = 'copy'; b.type = 'button'; b.textContent = root.lang === 'en' ? 'COPY' : 'COPIAR';
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.querySelector('code').innerText); b.textContent = '✓'; } catch { b.textContent = '✗'; }
      setTimeout(() => { b.textContent = root.lang === 'en' ? 'COPY' : 'COPIAR'; }, 1400);
    });
    pre.appendChild(b);
  });

  // --- sumário das páginas de docs: destaca a seção visível ---
  const links = [...document.querySelectorAll('.toc a')];
  if (links.length && 'IntersectionObserver' in window) {
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const so = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { links.forEach((a) => a.classList.remove('on')); map.get(e.target.id)?.classList.add('on'); }
    }), { rootMargin: '-20% 0px -70% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) so.observe(s); });
  }
})();
