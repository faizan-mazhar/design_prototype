/* Scroll scenes for the applyd.ai prototype.
   Structure comes from CSS (sticky stages, overlapping sheets). GSAP only scrubs transform and opacity. */
(function () {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  wireUI();
  navMenus();

  if (!root.classList.contains('motion')) return;
  if (!window.gsap || !window.ScrollTrigger || !window.Lenis) { root.classList.remove('motion'); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  const lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 0.8, autoRaf: false, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const fontsReady = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  fontsReady.then(init);

  function init() {
    drawRoutes();
    root.classList.add('ready');

    const mm = gsap.matchMedia();
    const home = !!$('.hero .stack');
    mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, (ctx) => {
      let stopOrbit;
      if (home) {
        heroIntro();
        heroScene(ctx.conditions.desktop);
        proofScene();
        stopOrbit = industryScene(ctx.conditions.desktop);
        bandScene();
        exits();
      } else {
        subScenes(ctx.conditions.desktop);
      }
      navTone();
      reveals();
      return stopOrbit;
    });

    $$('.faq__list details').forEach((d) => d.addEventListener('toggle', () => ScrollTrigger.refresh()));
    addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    ScrollTrigger.refresh();
  }

  /* Inner pages. The hero holds still while the page rides up over it as a sheet; walkthroughs,
     event logs and single-sentence answers are read with the scroll. */
  function subScenes(desktop) {
    const hero = $('.phero');
    const flow = $('.flow--sub');
    const title = $('.phero__title');
    if (title) {
      SplitText.create(title, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 0.9, ease: 'power3.out', stagger: { amount: 0.22, ease: 'power1.out' }, delay: 0.05 }),
      });
      gsap.from($$('.crumbs, .phero__lead, .phero .btns'), { autoAlpha: 0, y: 14, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.25 });
    }

    if (hero && flow && !hero.classList.contains('phero--plain')) {
      const over = { trigger: flow, start: 'top bottom', end: 'top top', scrub: true };
      gsap.fromTo($('.phero__media', hero), { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to($('.phero__media', hero), { yPercent: 10, ease: 'none', immediateRender: false, scrollTrigger: over });
      gsap.to($('.phero__copy', hero), { y: () => -innerHeight * 0.12, autoAlpha: 0, ease: 'power1.in', scrollTrigger: { ...over, end: 'top 30%' } });
      gsap.to($('.phero__cue', hero), { autoAlpha: 0, ease: 'none', scrollTrigger: { ...over, end: 'top 70%' } });
      gsap.fromTo(flow, { '--sheet-r': desktop ? '28px' : '18px' }, { '--sheet-r': '0px', ease: 'none', scrollTrigger: { trigger: flow, start: 'top 40%', end: 'top top', scrub: true } });
      // Once covered, the hero stops painting.
      ScrollTrigger.create({ trigger: flow, start: 'top top', onToggle: (st) => gsap.set(hero, { visibility: st.isActive ? 'hidden' : 'visible' }) });
    }

    // Walkthroughs: a rail fills down the steps and the step at the reading line lights up.
    $$('[data-run]').forEach((run, r) => {
      const fill = document.createElement('i');
      fill.className = 'run__fill';
      run.prepend(fill);
      gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: run, start: 'top 62%', end: 'bottom 62%', scrub: true } });
      // Sticky index of the steps beside the run, when there is a head column to hold it.
      const head = run.closest('.runwrap') && $('.runwrap__head', run.closest('.runwrap'));
      const steps = $$('.run__step', run);
      let index = [];
      if (head && steps.length > 3) {
        const ol = document.createElement('nav');
        ol.className = 'run__index';
        ol.setAttribute('aria-label', 'Steps');
        steps.forEach((s, n) => {
          s.id = s.id || `run${r}-${n + 1}`;
          const a = document.createElement('a');
          a.href = `#${s.id}`;
          a.innerHTML = `<span>${String(n + 1).padStart(2, '0')}</span>${$('h3', s).textContent}`;
          ol.appendChild(a);
        });
        head.appendChild(ol);
        index = $$('a', ol);
      }
      steps.forEach((step, n) => {
        ScrollTrigger.create({
          trigger: step, start: 'top 62%', end: 'bottom 62%',
          onEnter: () => step.classList.add('is-seen'),
          onToggle: (st) => {
            step.classList.toggle('is-on', st.isActive);
            if (index[n]) {
              index[n].classList.toggle('is-on', st.isActive);
              if (st.isActive) { const box = index[n].parentElement; box.scrollTo({ top: index[n].offsetTop - box.clientHeight / 2, behavior: 'smooth' }); }
            }
          },
        });
      });
    });

    // Event logs: each row lights in turn, in step with the scroll.
    $$('[data-log]').forEach((log) => {
      const rows = $$('li', log);
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: log, start: 'top 78%', end: 'bottom 50%', scrub: true } });
      rows.forEach((row, i) => tl.to(row, { opacity: 1, duration: 1 }, i * 0.8));
    });

    // A single answered question: words light up as the sticky block is read.
    $$('.answer').forEach((sec) => {
      const words = SplitText.create($('.answer__text', sec), { type: 'words' }).words;
      gsap.fromTo(words, { opacity: 0.16 }, { opacity: 1, ease: 'none', stagger: 1, scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true } });
    });

    // Long-form: progress bar and the current heading in the contents list.
    $$('.article--toc').forEach((art) => {
      const prose = $('.prose', art);
      gsap.to($('.toc__bar i', art), { scaleX: 1, ease: 'none', scrollTrigger: { trigger: prose, start: 'top 30%', end: 'bottom 70%', scrub: true } });
      const links = $$('.toc a', art);
      links.forEach((a) => {
        const h = document.getElementById(a.getAttribute('href').slice(1));
        if (!h) return;
        ScrollTrigger.create({
          trigger: h, start: 'top 40%', endTrigger: prose, end: 'bottom 40%',
          onToggle: (st) => { if (st.isActive) links.forEach((l) => l.classList.toggle('is-on', l === a)); },
        });
      });
    });

    // Stacked stages: each card settles back as the next one slides over it.
    if (desktop) {
      const chapters = $$('.chapter');
      chapters.forEach((c, n) => {
        const next = chapters[n + 1];
        if (!next || next.parentElement !== c.parentElement) return;
        gsap.to(c, { scale: 0.94, '--shade': 0.18, ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: `top ${108 + (n + 1) * 16}px`, scrub: true } });
      });
    }

    // Pipelines: each step's bar fills in order with the scroll.
    $$('[data-pipe]').forEach((pipe) => {
      const steps = $$('.pipe__step', pipe);
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: pipe, start: 'top 80%', end: 'bottom 45%', scrub: true } });
      steps.forEach((st, i) => tl.to(st, { '--fill': 1, duration: 1 }, i));
    });

    // Chat transcripts: messages arrive in order as the conversation scrolls into view.
    $$('[data-chat]').forEach((chat) => {
      const msgs = $$('.chat__msg', chat);
      const tl = gsap.timeline({ scrollTrigger: { trigger: chat, start: 'top 75%', end: 'bottom 70%', scrub: true } });
      msgs.forEach((m, i) => tl.to(m, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, i));
      const sum = $('.chat__sum', chat);
      if (sum) tl.from(sum, { opacity: 0, y: 14, duration: 1 }, msgs.length);
    });

    // Media inside split sections drifts a little against the text.
    if (desktop) {
      $$('.split__media').forEach((m) => {
        gsap.fromTo(m, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: m.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }
  }

  /* Solutions and Industries menus: hover or click on desktop, tap to expand inside the mobile panel. */
  function navMenus() {
    const groups = $$('.nav__group').map((g) => ({ g, btn: $('.nav__trigger', g), menu: $('.nav__menu', g) }));
    const set = (item, open) => { item.btn.setAttribute('aria-expanded', String(open)); item.menu.classList.toggle('open', open); };
    const closeAll = (except) => groups.forEach((it) => { if (it !== except) set(it, false); });
    const canHover = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
    groups.forEach((it) => {
      it.btn.addEventListener('click', () => { const open = it.btn.getAttribute('aria-expanded') !== 'true'; closeAll(it); set(it, open); });
      it.g.addEventListener('mouseenter', () => { if (canHover.matches) { closeAll(it); set(it, true); } });
      it.menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeAll(); });
    });
    $('.nav').addEventListener('mouseleave', () => { if (canHover.matches) closeAll(); });
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = groups.find((it) => it.btn.getAttribute('aria-expanded') === 'true');
      if (open) { closeAll(); open.btn.focus(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) closeAll(); });
  }

  /* Page load, seen once: the headline leads, supporting lines overlap it. */
  function heroIntro() {
    const h1 = $('#hero-title');
    SplitText.create(h1, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 0.9, ease: 'power3.out', stagger: { amount: 0.26, ease: 'power1.out' } }),
    });
    gsap.from('.hero__lead', { autoAlpha: 0, y: 14, duration: 0.7, ease: 'power3.out', delay: 0.32 });
    gsap.from('.hero__copy .btns', { autoAlpha: 0, y: 10, duration: 0.6, ease: 'power3.out', delay: 0.44 });
  }

  /* Video frame shrinks into a deck of five opaque cards. The active agent is always the front card;
     scrolling deals it off the right edge and the next one moves up. Copy has its own reserved area,
     and the deck is sized from what remains, so the two cannot collide at any viewport. */
  function heroScene(desktop) {
    const hero = $('.hero');
    const inner = $('.hero__inner');
    const stack = $('.stack');
    const frame = $('.frame');
    const field = $('.hero__field', frame);
    const nav = $('.nav');
    const panels = $$('.panel');
    const images = panels.map((p) => $('img', p));
    const stages = $$('.stage');
    const box = $('.stages');
    const intro = $('.stages__intro');
    const rail = $('.rail');
    const railSteps = $$('.rail__step');

    images.forEach((img) => { if (img.dataset.src) img.src = img.dataset.src; });

    const splits = stages.map((s) => SplitText.create($('h2', s), { type: 'lines', mask: 'lines', autoSplit: true }));
    gsap.set(stages, { autoAlpha: 0, y: 0 });
    gsap.set(frame, { z: 1 });

    const COUNT = stages.length;
    const MORPH_END = 0.21;
    const SEGMENT = (1 - MORPH_END) / COUNT;
    const DEAL = SEGMENT * 0.42;
    const COPY_GAP = 0.15; // old copy is gone before the new copy starts
    const MAX_DEPTH = 3;
    const SHRINK = 0.06;
    const IMAGE_LEVEL = [0.92, 0.42, 0.24, 0.14];
    // Panels sit in DOM order back to front, so agent i maps to panel 4 - i.
    const panelFor = (i) => panels[panels.length - 1 - i];

    // All offset* reads: layout boxes, unaffected by transforms or scroll position.
    function fit() {
      const W = inner.offsetWidth, H = inner.offsetHeight;
      const cardW = panels[0].offsetWidth, cardH = panels[0].offsetHeight;
      const peek = desktop ? Math.min(24, Math.max(14, H * 0.026)) : 11;
      const area = desktop
        ? { l: box.offsetLeft + box.offsetWidth + 24, r: W - stack.offsetLeft, t: stack.offsetTop + 8, b: H - 24 }
        : { l: stack.offsetLeft + 4, r: W - stack.offsetLeft - 4, t: stack.offsetTop + 4, b: box.offsetTop - 18 };
      const peeks = peek * MAX_DEPTH;
      const tiltMargin = desktop ? 0.93 : 1; // perspective makes the tilted card project slightly larger
      const cardSize = desktop ? 0.8 : 0.85; // share of the available area the deck fills; the one knob for card size
      const s = Math.min((area.r - area.l) / cardW, (area.b - area.t - peeks) / cardH) * tiltMargin * cardSize;
      return {
        s, cardH,
        x: (area.l + area.r) / 2 - (stack.offsetLeft + stack.offsetWidth / 2),
        y: (area.t + area.b + peeks) / 2 - (stack.offsetTop + stack.offsetHeight / 2),
        peek: peek / s,
        off: (W * 1.3) / s,
      };
    }
    const setTagScale = () => stack.style.setProperty('--k', (1 / fit().s).toFixed(3));
    setTagScale();

    // Where a card rests when it is d places behind the front card.
    const slot = (d) => ({
      y: () => { const f = fit(); return -(f.peek + (f.cardH * SHRINK) / 2) * d; },
      scale: 1 - SHRINK * d,
      z: -d * 6,
    });
    const depth = (agent, front) => Math.min(agent - front, MAX_DEPTH);

    let current = -2;
    function showStage(i) {
      if (i === current) return;
      const prev = stages[current];
      current = i;

      if (prev) gsap.to(prev, { autoAlpha: 0, y: -8, duration: COPY_GAP - 0.02, ease: 'power2.in', overwrite: true });
      panels.forEach((p) => p.classList.remove('is-active'));
      railSteps.forEach((s, n) => s.classList.toggle('is-on', n === i));
      gsap.to([intro, rail], { autoAlpha: i >= 0 ? 1 : 0, duration: 0.3, overwrite: true });
      if (i < 0) return;

      panelFor(i).classList.add('is-active');

      const el = stages[i];
      const lines = splits[i].lines;
      const start = prev ? COPY_GAP : 0;
      gsap.set(el, { autoAlpha: 1, y: 0, overwrite: true });
      gsap.fromTo($('.eyebrow', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, delay: start, overwrite: true });
      gsap.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07, delay: start + 0.06, overwrite: true });
      gsap.fromTo($('.stage__body', el), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: start + 0.14, overwrite: true });
      gsap.fromTo($('.takeover', el), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: start + 0.22, overwrite: true });
    }

    let playing = true;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero, start: 'top top', end: 'bottom 200%', scrub: true, invalidateOnRefresh: true,
        onRefresh: setTagScale,
        onUpdate(st) {
          const p = st.progress;
          showStage(p < MORPH_END ? -1 : Math.min(COUNT - 1, Math.floor((p - MORPH_END) / SEGMENT)));
          const shouldPlay = p < MORPH_END;
          if (shouldPlay !== playing) { playing = shouldPlay; const f = field && field._field; if (f) shouldPlay ? f.play() : f.pause(); }
          nav.dataset.tone = p < 0.08 ? 'light' : 'dark'; // white bar over the frame, black once the stage goes dark
        },
      },
    });

    tl.to('.hero__copy', { autoAlpha: 0, y: -48, duration: 0.07 }, 0)
      .to('.hero__dark', { opacity: 1, duration: 0.12 }, 0.02)
      .to(stack, {
        scale: () => fit().s, x: () => fit().x, y: () => fit().y,
        rotateY: desktop ? -12 : 0, rotateX: desktop ? 4 : 0,
        duration: 0.2, ease: 'power2.inOut',
      }, 0);
    // Phone cards are landscape inside a portrait frame, so the frame crops to the card as it shrinks.
    if (!desktop) tl.fromTo(frame, { clipPath: 'inset(0px 0px)' }, { clipPath: () => `inset(${panels[0].offsetTop}px 0px)`, duration: 0.2, ease: 'power2.inOut' }, 0);
    tl.to(frame, { autoAlpha: 0, duration: 0.05 }, 0.16);

    for (let a = 0; a < COUNT; a++) {
      const d = depth(a, 0);
      tl.fromTo(panelFor(a), { autoAlpha: 0, ...slot(d) }, { autoAlpha: 1, ...slot(d), duration: 0.1, ease: 'power2.out' }, 0.09 + d * 0.012);
      gsap.set($('img', panelFor(a)), { opacity: IMAGE_LEVEL[d] });
    }

    // Holds and deals: each boundary between agents is one deal, centred so the copy swaps mid-deal.
    for (let front = 0; front < COUNT - 1; front++) {
      const at = MORPH_END + (front + 1) * SEGMENT - DEAL / 2;
      const leaving = panelFor(front);
      tl.to(leaving, { x: () => fit().off, rotation: 5, duration: DEAL, ease: 'power2.in' }, at);
      tl.to(leaving, { autoAlpha: 0, duration: DEAL * 0.2 }, at + DEAL * 0.8);
      for (let a = front + 1; a < COUNT; a++) {
        const d = depth(a, front + 1);
        tl.to(panelFor(a), { ...slot(d), duration: DEAL, ease: 'power2.inOut' }, at);
        tl.to($('img', panelFor(a)), { opacity: IMAGE_LEVEL[d], duration: DEAL }, at);
      }
    }

    railSteps.forEach((s, n) => tl.fromTo($('.rail__fill', s), { scaleX: 0 }, { scaleX: 1, duration: SEGMENT }, MORPH_END + n * SEGMENT));
    if (desktop) tl.to(stack, { rotateY: -8, duration: 1 - MORPH_END }, MORPH_END);
    tl.to({}, { duration: 0.001 }, 0.999);
  }

  /* Green record card: rises in, then the record fills in with scroll. */
  function proofScene() {
    const section = $('.proof');
    const enter = { trigger: section, start: 'top bottom', end: 'top top', scrub: true };
    gsap.fromTo('.proof__card', { yPercent: 25 }, { yPercent: 0, ease: 'power3.out', scrollTrigger: enter });
    gsap.fromTo('.proof__media', { yPercent: 67 }, { yPercent: 0, ease: 'power2.out', scrollTrigger: { ...enter } });

    const words = SplitText.create('.proof__title', { type: 'words' }).words;
    const rows = $$('.record__rows li');
    const media = $$('.proof__media img');
    gsap.set(rows, { opacity: 0.16 });
    gsap.set('.record__head .pill', { opacity: 0 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top 30%', end: 'bottom 200%', scrub: true },
    });
    tl.fromTo(words, { opacity: 0.2 }, { opacity: 1, duration: 0.3, stagger: { amount: 0.3 } }, 0);
    rows.forEach((row, i) => {
      const at = 0.42 + i * 0.13;
      tl.to(row, { opacity: 1, duration: 0.09 }, at);
      if (media[i] && i > 0) tl.to(media[i], { opacity: 1, duration: 0.09 }, at);
    });
    tl.to('.record__head .pill', { opacity: 1, duration: 0.05 }, 0.86);
    tl.to({}, { duration: 0.001 }, 0.999);
  }

  /* Industries: twelve photos orbit the headline on a timer, independent of scroll. The path is a tilted
     ellipse with tiles spaced evenly along its length, so neighbours keep the same gap all the way round. */
  function industryScene(isDesktop) {
    const section = $('.ind');
    const stage = $('.ind__stage');
    const tiles = $$('.tile');
    const words = $$('.rotor__w');
    const job = $('.ind__job');
    const jobs = JSON.parse(job.dataset.jobs);
    const eventLine = $('.ind__event');
    const events = JSON.parse(job.dataset.events);

    const PERIOD = 27.5; // seconds per revolution
    const SEMI_MAJOR = 525.2, SEMI_MINOR = 255.5, TILT = (163.84 * Math.PI) / 180;
    const REACH_Y = 285.6; // furthest the path gets from its centre vertically
    const CENTRE_SHIFT = -20.5; // the heavier left side sits the ring slightly left of the headline
    const MAX_TILE = 140;
    const path = buildPath(720);

    let fadeFrom = 0.3, progress = 0, scaleX = 1, scaleY = 1, tileSize = MAX_TILE, visible = false, hovering = false, active = -1;

    // Lookup table of points at equal distances along the ellipse; progress 0 is the large end of the ring.
    function buildPath(samples) {
      const FINE = samples * 12;
      const c = Math.cos(TILT), s = Math.sin(TILT);
      const fine = [];
      for (let i = 0; i <= FINE; i++) {
        const t = (i / FINE) * Math.PI * 2;
        const u = SEMI_MAJOR * Math.cos(t), v = SEMI_MINOR * Math.sin(t);
        fine.push([u * c - v * s, u * s + v * c]);
      }
      const lengths = [0];
      for (let i = 1; i <= FINE; i++) lengths.push(lengths[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
      const total = lengths[FINE];
      const out = [];
      for (let i = 0, j = 0; i < samples; i++) {
        const target = (i / samples) * total;
        while (lengths[j + 1] < target) j++;
        out.push(fine[j]);
      }
      return out;
    }

    function pointAt(p) {
      const f = ((p % 1) + 1) % 1 * path.length;
      const i = Math.floor(f), a = path[i], b = path[(i + 1) % path.length], t = f - i;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    // Tile size around the ring, in pixels at full size: largest at progress 0, smallest opposite.
    function sizeAt(p) {
      const a = p * Math.PI * 2;
      return 96.97 + 47.38 * Math.cos(a) - 6.17 * Math.cos(2 * a) + 2.89 * Math.cos(3 * a);
    }

    function measure() {
      const W = stage.clientWidth, H = stage.clientHeight, head = $('.nav__bar').offsetHeight;
      tileSize = isDesktop ? Math.min(MAX_TILE, W * 0.097, H * 0.155) : Math.min(W * 0.22, H * 0.105);
      stage.style.setProperty('--tile', `${tileSize.toFixed(1)}px`);
      const roomY = (H - head) / 2 - tileSize * 0.4 - 14;
      scaleX = isDesktop ? Math.min(1, W / 1440) : W / 2 - tileSize * 0.52; // phones: radius in px
      scaleY = isDesktop ? Math.min(1, roomY / REACH_Y) : roomY;
      // Phones: a tile may only show once it has cleared the height of the headline block.
      fadeFrom = Math.min(0.9, ($('.ind__center').offsetHeight / 2 + tileSize * 0.5) / roomY);
    }

    function setWord(i) {
      if (i === active) return;
      const prev = words[active];
      if (prev) gsap.to(prev, { yPercent: -110, duration: 0.6, ease: 'power3.inOut', overwrite: true, onComplete: () => gsap.set(prev, { autoAlpha: 0 }) });
      active = i;
      gsap.fromTo(words[i], { yPercent: 110, autoAlpha: 1 }, { yPercent: 0, duration: 0.6, ease: 'power3.inOut', overwrite: true });
      job.textContent = jobs[i];
      eventLine.textContent = events[i];
      gsap.fromTo(eventLine, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, overwrite: true });
      gsap.fromTo(job, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, overwrite: true });
    }

    function render() {
      const n = tiles.length;
      const shift = isDesktop ? CENTRE_SHIFT * scaleX : 0;
      tiles.forEach((t, i) => {
        const p = progress + i / n;
        const k = sizeAt(((p % 1) + 1) % 1) / MAX_TILE;
        let x, y;
        if (isDesktop) {
          const [px, py] = pointAt(p);
          x = px * scaleX + shift; y = py * scaleY;
        } else {
          // Portrait has no room for the tilt: a plain tall ring, with tiles fading out past the sides of the headline.
          const a = (p * Math.PI * 2) + Math.PI;
          x = Math.cos(a) * scaleX; y = Math.sin(a) * scaleY;
          t.style.opacity = Math.min(1, Math.max(0, (Math.abs(Math.sin(a)) - fadeFrom) / 0.1)).toFixed(2);
        }
        t.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${k.toFixed(3)})`;
      });
      setWord(((Math.round(-progress * n) % n) + n) % n);
    }

    function tick(_, deltaMs) {
      if (!visible || hovering) return;
      progress = (progress + Math.min(deltaMs, 50) / 1000 / PERIOD) % 1;
      render();
    }

    const hover = (on) => () => { hovering = on; };
    tiles.forEach((t) => {
      t.addEventListener('pointerenter', hover(true));
      t.addEventListener('pointerleave', hover(false));
      t.addEventListener('focus', hover(true));
      t.addEventListener('blur', hover(false));
    });
    const onResize = () => { measure(); render(); };
    addEventListener('resize', onResize);
    const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    seen.observe(section);

    measure();
    render();
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      removeEventListener('resize', onResize);
      seen.disconnect();
      tiles.forEach((t) => { t.style.transform = ''; t.style.opacity = ''; });
    };
  }

  function bandScene() {
    gsap.fromTo('.band__img', { yPercent: -8, scale: 1.08 }, {
      yPercent: 8, scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  }

  /* While the next sheet rides up, the pinned one recedes or dims. */
  function exits() {
    const over = (next) => ({ trigger: next, start: 'top bottom', end: 'top top', scrub: true });
    gsap.to('.hero__inner', { yPercent: -10, ease: 'none', scrollTrigger: over('.band') });
    gsap.to('.proof__inner', { scale: 0.9, yPercent: -20, opacity: 0, ease: 'none', scrollTrigger: over('.ind') });
    gsap.to('.ind .dim', { opacity: 0.55, ease: 'none', scrollTrigger: over('.flow') });
    gsap.to('.band .dim', { opacity: 0.6, ease: 'none', scrollTrigger: over('.proof') });
  }

  function navTone() {
    const nav = $('.nav');
    $$('[data-nav]').forEach((s) => {
      ScrollTrigger.create({
        trigger: s, start: 'top 44px', end: 'bottom 44px',
        onToggle: (st) => { if (st.isActive) nav.dataset.tone = s.dataset.nav; },
      });
    });
  }

  function reveals() {
    $$('[data-split]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 110, duration: 0.9, ease: 'power3.out', stagger: { amount: 0.2, ease: 'power1.out' },
          scrollTrigger: { trigger: el, start: 'top 84%', once: true },
        }),
      });
    });

    const rise = $$('[data-rise]');
    gsap.set(rise, { autoAlpha: 0, y: 18 });
    ScrollTrigger.batch(rise, {
      start: 'top 88%', once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: { amount: Math.min(0.26, batch.length * 0.05), ease: 'power1.out' }, overwrite: true }),
    });

    $$('[data-settle]').forEach((img) => {
      gsap.fromTo(img, { scale: 1.08 }, {
        scale: 1, ease: 'none',
        scrollTrigger: {
          trigger: img.parentElement, start: 'top bottom', end: 'center center', scrub: true,
          onToggle: (st) => { img.style.willChange = st.isActive ? 'transform' : 'auto'; },
        },
      });
    });

    $$('[data-widen]').forEach((el) => {
      gsap.fromTo(el, { scale: 0.965 }, {
        scale: 1, transformOrigin: 'center top', ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 45%', scrub: true },
      });
    });
  }

  /* Decorative circuitry for the agent panels, drawn in the frame's own coordinates. */
  function drawRoutes() {
    const NS = 'http://www.w3.org/2000/svg';
    $$('.routes').forEach((svg, n) => {
      const W = 1400, H = 800;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      let seed = 41 + n * 17;
      const r = (a, b) => { seed = (seed * 9301 + 49297) % 233280; return a + (seed / 233280) * (b - a); };
      for (let k = 0; k < 7; k++) {
        const y0 = 130 + k * 88 + r(-20, 20), y1 = 110 + r(0, 600), x0 = 90 + r(0, 200), x1 = 1040 + r(0, 240);
        const path = document.createElementNS(NS, 'path');
        const mx = (x0 + x1) / 2 + r(-120, 120);
        path.setAttribute('d', `M${x0} ${y0} C${mx} ${y0},${mx} ${y1},${x1} ${y1}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgb(243 238 229 / .62)');
        path.setAttribute('stroke-width', '3');
        svg.appendChild(path);
        const node = document.createElementNS(NS, 'rect');
        node.setAttribute('x', x1 - 11); node.setAttribute('y', y1 - 11); node.setAttribute('width', 22); node.setAttribute('height', 22);
        node.setAttribute('transform', `rotate(45 ${x1} ${y1})`);
        node.setAttribute('fill', 'none'); node.setAttribute('stroke', 'rgb(243 238 229 / .85)'); node.setAttribute('stroke-width', '3');
        svg.appendChild(node);
      }
    });
  }

  /* Scroll-aware nav chrome. Runs with or without GSAP so the bar reacts even under reduced motion.
     Scrolling past the top defines the translucent bar (border + shadow); the section in the viewport's
     middle band lights its matching link, like a docs header tracking the current page. */
  function navChrome() {
    const nav = $('.nav');
    const setScrolled = () => nav.toggleAttribute('data-scrolled', (window.scrollY || 0) > 8);
    setScrolled();
    addEventListener('scroll', setScrolled, { passive: true });

    const spy = $$('#nav-links > a[href^="#"]')
      .map((a) => { const el = document.querySelector(a.getAttribute('href') || ''); return el ? { a, el } : null; })
      .filter(Boolean);
    if (!spy.length || !('IntersectionObserver' in window)) return;

    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target));
      let current = null, top = Infinity;
      seen.forEach((el) => { const t = el.getBoundingClientRect().top; if (t < top) { top = t; current = el; } });
      spy.forEach(({ a, el }) => el === current ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    }, { rootMargin: '-45% 0px -50% 0px' });
    spy.forEach(({ el }) => io.observe(el));
  }

  /* Hero background: a routing-signal field. Inbound channels on the edges feed curved wires
     into a central hub; pulses of light travel the wires and the hub flares as each one lands,
     then routes back out to the agents below. Pure canvas, brand palette, self-pacing. */
  function heroField() {
    const canvas = $('.hero__field');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const INK = [11, 11, 12];
    const AGENT = [125, 214, 195];   // --agent-on-dark
    const HUMAN = [242, 178, 102];   // --human-on-dark
    const DONE = [201, 198, 255];    // --done-on-dark
    const HUB = [150, 232, 212];
    const palette = [AGENT, AGENT, HUMAN, HUMAN, DONE];

    // Normalised graph. Inbound channels converge on the hub; a few agents receive the handoff.
    const inbound = [
      [0.05, 0.24], [0.02, 0.5], [0.07, 0.8], [0.3, 0.08],
      [0.7, 0.07], [0.95, 0.28], [0.98, 0.58], [0.93, 0.84],
    ];
    const agents = [[0.33, 0.92], [0.5, 0.97], [0.67, 0.92]];
    const HUB_AT = [0.5, 0.5];

    let w = 0, h = 0, dpr = 1, edges = [], hub = { x: 0, y: 0 }, energy = 0;
    const pulses = [];
    let raf = 0, running = false, last = 0, spawnIn = 0;
    let intersecting = true, scenePaused = false;

    const px = (p) => [p[0] * w, p[1] * h];
    const bez = (e, t) => {
      const m = 1 - t, a = m * m, b = 2 * m * t, c = t * t;
      return [a * e.x0 + b * e.cx + c * e.x1, a * e.y0 + b * e.cy + c * e.y1];
    };

    function layout() {
      [hub.x, hub.y] = px(HUB_AT);
      edges = [];
      const build = (pt, dir, sign) => {
        const [x0, y0] = dir === 'in' ? px(pt) : [hub.x, hub.y];
        const [x1, y1] = dir === 'in' ? [hub.x, hub.y] : px(pt);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
        const bow = len * 0.17 * sign;
        edges.push({ x0, y0, x1, y1, cx: mx + (-dy / len) * bow, cy: my + (dx / len) * bow, dir });
      };
      inbound.forEach((p, i) => build(p, 'in', i % 2 ? 1 : -1));
      agents.forEach((p, i) => build(p, 'out', i === 1 ? 0.6 : (i ? 1 : -1)));
    }

    function spawn() {
      if (pulses.length > 26) return;
      const outward = Math.random() < 0.32;
      const pool = edges.filter((e) => (outward ? e.dir === 'out' : e.dir === 'in'));
      const e = pool[(Math.random() * pool.length) | 0];
      if (!e) return;
      const col = outward ? HUB : palette[(Math.random() * palette.length) | 0];
      pulses.push({ e, t: 0, speed: 0.34 + Math.random() * 0.3, col, r: 1.8 + Math.random() * 1.2 });
    }

    function glow(x, y, r, col, a) {
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a * 0.14})`;
      ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a * 0.4})`;
      ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, 7); ctx.fill();
    }

    function wires() {
      ctx.lineWidth = 1;
      edges.forEach((e) => {
        ctx.strokeStyle = e.dir === 'out' ? 'rgba(201,198,255,.07)' : 'rgba(170,200,195,.08)';
        ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.quadraticCurveTo(e.cx, e.cy, e.x1, e.y1); ctx.stroke();
      });
      // node dots
      ctx.globalCompositeOperation = 'lighter';
      inbound.forEach((p) => { const [x, y] = px(p); glow(x, y, 1.2, AGENT, 0.5); });
      agents.forEach((p) => { const [x, y] = px(p); glow(x, y, 1.3, DONE, 0.55); });
      ctx.globalCompositeOperation = 'source-over';
    }

    function hubGlow() {
      const r = 20 + energy * 34;
      const g = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, r);
      g.addColorStop(0, `rgba(${HUB[0]},${HUB[1]},${HUB[2]},${0.5 + energy * 0.4})`);
      g.addColorStop(0.4, `rgba(${HUB[0]},${HUB[1]},${HUB[2]},${0.12 + energy * 0.2})`);
      g.addColorStop(1, 'rgba(31,127,109,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hub.x, hub.y, r, 0, 7); ctx.fill();
      glow(hub.x, hub.y, 2.6 + energy * 2, HUB, 0.9);
      ctx.globalCompositeOperation = 'source-over';
    }

    function render(dt) {
      // Trailing fade toward ink gives the pulses their comet tails and keeps the field soft.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${Math.min(1, dt * 7 + 0.14)})`;
      ctx.fillRect(0, 0, w, h);

      wires();
      energy = Math.max(0, energy - dt * 1.6);
      hubGlow();

      ctx.globalCompositeOperation = 'lighter';
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += p.speed * dt;
        if (p.t >= 1) {
          if (p.e.dir === 'in') energy = Math.min(1, energy + 0.5);
          pulses.splice(i, 1); continue;
        }
        const [x, y] = bez(p.e, p.t);
        const fade = Math.sin(Math.min(1, p.t) * Math.PI);
        glow(x, y, p.r, p.col, 0.35 + 0.6 * fade);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
      last = now;
      spawnIn -= dt;
      if (spawnIn <= 0) { spawn(); spawnIn = 0.28 + Math.random() * 0.22; }
      render(dt);
      raf = requestAnimationFrame(frame);
    }

    function paintStatic() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgb(${INK[0]},${INK[1]},${INK[2]})`;
      ctx.fillRect(0, 0, w, h);
      wires();
      energy = 0.5; hubGlow();
      ctx.globalCompositeOperation = 'lighter';
      edges.forEach((e, i) => { if (i % 2) { const [x, y] = bez(e, 0.45); glow(x, y, 2, e.dir === 'out' ? HUB : palette[i % palette.length], 0.7); } });
      ctx.globalCompositeOperation = 'source-over';
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      if (reduce || !running) paintStatic();
    }

    function sync() {
      const go = intersecting && !document.hidden && !scenePaused;
      if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!go && running) { running = false; cancelAnimationFrame(raf); }
    }

    canvas._field = { play() { scenePaused = false; sync(); }, pause() { scenePaused = true; sync(); } };

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { intersecting = e.isIntersecting; sync(); }, { threshold: 0 })
        .observe($('.hero') || canvas);
    }

    resize();
    if (reduce) { paintStatic(); return; }
    sync();
  }

  function wireUI() {
    const toggle = $('.nav__toggle');
    const links = $('#nav-links');
    const setOpen = (open) => { links.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });

    navChrome();
    heroField();

    $$('form.form, form.sform').forEach((form) => form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = $('.form__msg', form);
      if (msg) msg.textContent = form.checkValidity() ? 'Prototype only: nothing was sent.' : 'Please fill in the required fields.';
    }));
  }
})();
