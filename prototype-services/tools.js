/* Interactive pieces of the inner pages: clip playback, the pilot fit check, the approach finder,
   the sensor demo and demo-form prefill. Each one only runs if its markup is on the page. */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOK = document.documentElement.classList.contains('motion');

  // Clips play only while on screen, and never under reduced motion.
  const vids = $$('video[data-autoplay]');
  if (vids.length) {
    if (!motionOK) vids.forEach((v) => { v.preload = 'metadata'; v.controls = true; });
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
      }), { threshold: 0.25 });
      vids.forEach((v) => io.observe(v));
    }
  }

  // Demo form: ?service= picks the chip, ?fit= fills the message.
  const demoForm = $('form.form');
  if (demoForm) {
    const q = new URLSearchParams(location.search);
    const map = { 'physical-ai': 'Physical AI', 'video-ai': 'Video AI', 'ai-agents': 'AI Agents', 'ot-security': 'OT Security', 'ai-development': 'AI Development' };
    const svc = map[q.get('service')];
    if (svc) { const r = $(`input[name=service][value="${svc}"]`, demoForm); if (r) r.checked = true; }
    const fit = q.get('fit');
    const ta = $('textarea', demoForm);
    if (fit && ta) ta.value = fit.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  }

  const answers = (form) => Object.fromEntries($$('fieldset[data-q]', form).map((f) => {
    const c = $('input:checked', f); return [f.dataset.q, c ? c.value : undefined];
  }));
  const setProgress = (box, done, total) => { const i = $('.tool__progress i', box); if (i) i.style.transform = `scaleX(${done / total})`; };
  const list = (ul, items) => { ul.innerHTML = ''; items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); };

  /* Pilot fit check: the live site's scoring, unchanged. */
  const pilot = $('[data-pilot]');
  if (pilot) {
    const NAMES = { capture: 'Capture', qualify: 'Qualify', engage: 'Follow up', book: 'Book', sync: 'Sync' };
    const ORDER = ['capture', 'qualify', 'engage', 'book', 'sync'];
    const score = (e) => {
      const pts = Object.fromEntries(ORDER.map((k) => [k, 0]));
      const n = [];
      if (e.speed === 'day') n.push({ stage: 'engage', pts: 2, why: 'First replies take up to a day, so following up faster is the clearest gain.' });
      if (e.speed === 'slow') n.push({ stage: 'engage', pts: 3, why: 'First replies are slow or uneven, so following up faster is the clearest gain.' });
      if (e.speed === 'slow') n.push({ stage: 'capture', pts: 1, why: 'Leads may be waiting unseen, so capturing every one comes first.' });
      if (e.volume === 'high' || e.volume === 'vhigh') n.push({ stage: 'qualify', pts: 2, why: 'At this volume, sorting leads against your rules saves the most rep time.' });
      if (e.volume === 'low') n.push({ stage: 'book', pts: 1, why: 'At a lower volume, every lead counts, so getting each one booked matters.' });
      if (e.channels === 'multi') n.push({ stage: 'capture', pts: 2, why: 'Leads arrive on several channels, so one history per lead is worth setting up first.' });
      if (e.channels === 'email') n.push({ stage: 'capture', pts: 1, why: 'Leads arrive by form and email, so one record per lead is a good base.' });
      if (e.crm === 'yes') n.push({ stage: 'sync', pts: 1, why: 'A CRM is in place for the agents to read and write to.' });
      if (e.owner === 'reps') n.push({ stage: 'engage', pts: 2, why: 'Reps follow up between other work, so agents can take the first touch.' }, { stage: 'book', pts: 2, why: 'Reps spend time on scheduling that agents can handle.' });
      if (e.owner === 'sdr') n.push({ stage: 'qualify', pts: 2, why: 'Your SDRs can work from leads the agents have already sorted.' });
      if (e.owner === 'marketing') n.push({ stage: 'qualify', pts: 2, why: 'Marketing hands leads over unsorted, so qualification is the missing step.' }, { stage: 'capture', pts: 1, why: 'A single record per lead makes the hand-over cleaner.' });
      if (e.owner === 'nobody') n.push({ stage: 'engage', pts: 3, why: 'No one follows up consistently, so agents can give every lead a reply.' });
      if (e.rules === 'yes') n.push({ stage: 'qualify', pts: 1, why: 'Written rules mean agents can start on a clear brief.' });
      n.forEach((x) => { pts[x.stage] += x.pts; });
      if (e.crm === 'no') pts.sync = 0;
      const sorted = ORDER.filter((k) => k !== 'sync' || e.crm !== 'no').sort((a, b) => pts[b] - pts[a] || ORDER.indexOf(a) - ORDER.indexOf(b));
      const top = pts[sorted[0]] === 0 ? ['capture', 'qualify'] : sorted.slice(0, 2);
      const start = ORDER.filter((k) => top.includes(k));
      const reasons = n.filter((x) => start.includes(x.stage)).sort((a, b) => b.pts - a.pts).map((x) => x.why).slice(0, 3);
      const notes = [];
      if (e.crm === 'no') notes.push('Without a CRM, the Sync stage waits. We can talk through options in the demo.');
      if (e.rules !== 'yes') notes.push('Your pricing and contract hand-off rules are not fully written down. Writing them is the first step of a pilot, and we do it with you.');
      const summary = `Pilot fit check. Start with: ${start.map((k) => NAMES[k]).join(' + ')}. Volume: ${e.volume}. First reply: ${e.speed}. Channels: ${e.channels}. CRM: ${e.crm}. Follow-up today: ${e.owner}. Rules written: ${e.rules}.`.slice(0, 400);
      return { start, reasons, notes, summary };
    };
    const form = $('form', pilot), out = $('.tool__result', pilot);
    const update = () => {
      const a = answers(form);
      const done = Object.values(a).filter(Boolean).length, total = Object.keys(a).length;
      setProgress(out, done, total);
      const ready = done === total;
      $('[data-empty]', out).hidden = ready;
      $('[data-go]', out).hidden = !ready;
      if (!ready) {
        $('[data-title]', out).textContent = total - done === 1 ? 'One question to go' : `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][total - done]} questions to go`;
        $$('[data-stage]', out).forEach((s) => s.classList.remove('is-on'));
        list($('[data-reasons]', out), []); list($('[data-notes]', out), []);
        return;
      }
      const r = score(a);
      $('[data-title]', out).textContent = `Start with ${r.start.map((k) => NAMES[k]).join(' + ')}`;
      $$('[data-stage]', out).forEach((s) => s.classList.toggle('is-on', r.start.includes(s.dataset.stage)));
      list($('[data-reasons]', out), r.reasons);
      list($('[data-notes]', out), r.notes);
      $('[data-go]', out).href = `demo.html?service=ai-agents&fit=${encodeURIComponent(r.summary)}`;
      if (motionOK && window.gsap) gsap.from([$('[data-title]', out), ...$$('[data-reasons] li, [data-notes] li', out)], { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.06, ease: 'power3.out' });
    };
    form.addEventListener('change', update);
  }

  /* Approach finder (AI consulting): the live site's decision rules. */
  const finder = $('[data-finder]');
  if (finder) {
    const form = $('form', finder), out = $('.tool__result', finder);
    const decide = (p) => {
      const m = [];
      if (p.data) m.push('Retrieval over your documents, so answers come from your facts');
      if (p.examples) m.push('Fine-tuning later, once prompting and retrieval stop improving results');
      if (p.act) return { title: 'An AI agent', pattern: 'Tool-calling agent with human approval', why: 'It has to do things, not just answer. An agent plans, calls your systems with scoped permissions and stops for a person on risky actions.', slug: 'agent-development', also: p.talk ? ['A chat front end so people can hand it tasks', ...m] : m };
      if (p.talk) return { title: 'An AI assistant', pattern: 'Guarded conversation router with hand-over', why: 'People will talk to it. You need intent routing, lookups as the signed-in user and a clean hand-over to your team.', slug: 'chatbots', also: m };
      if (p.create) return { title: 'A generative AI pipeline', pattern: 'Grounded generation with automatic checks and editor review', why: 'The output is content, so the value is in grounding it in your facts and brand rules and checking it before anyone publishes.', slug: 'generative-ai', also: m };
      if (p.data) return { title: 'LLM integration with RAG', pattern: 'Retrieval-augmented generation with hybrid search', why: 'It needs to answer from your documents. Retrieval finds the right passages and the model answers from them with citations.', slug: 'llm-integration', also: m.filter((x) => !x.startsWith('Retrieval')) };
      return { title: 'Start with a use-case workshop', pattern: 'Assess, prove, scale', why: 'None of the common patterns stands out yet. A short consulting phase finds the use case worth building and how to measure it.', slug: 'consulting', also: p.examples ? m : [] };
    };
    const update = () => {
      const a = answers(form);
      const done = Object.values(a).filter(Boolean).length, total = Object.keys(a).length;
      setProgress(out, done, total);
      const go = $('[data-go]', out);
      if (done < total) {
        $('[data-title]', out).textContent = 'Your suggestion';
        $('[data-why]', out).textContent = `Answer all five questions to see the approach that usually fits first. ${done} of ${total} answered.`;
        $('[data-pattern]', out).textContent = '';
        list($('[data-also]', out), []); go.hidden = true; return;
      }
      const p = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === 'yes']));
      const r = decide(p);
      $('[data-title]', out).textContent = r.title;
      $('[data-why]', out).textContent = r.why;
      $('[data-pattern]', out).textContent = `Pattern: ${r.pattern}`;
      list($('[data-also]', out), r.also);
      go.href = `ai-${r.slug}.html`; go.hidden = false;
      if (motionOK && window.gsap) gsap.from($$('[data-title], [data-why], [data-pattern], [data-also] li', out), { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.05, ease: 'power3.out' });
    };
    form.addEventListener('change', update);
    form.addEventListener('reset', () => setTimeout(update, 0));
  }

  /* Sensor demo (Physical AI): the live site's signal model, drawn on canvas. */
  const sensor = $('[data-sensor]');
  if (sensor) {
    const u = (label, unit, base, delta) => ({ label, unit, base, delta });
    const ASSETS = {
      pump: { title: 'P-204 · Process pump', signals: [u('Vibration', 'mm/s', 2.4, 4.6), u('Motor current', 'A', 16, 3), u('Discharge pressure', 'bar', 4.2, -0.3)], diagnosis: 'Possible developing bearing deterioration.', copy: 'The combined pattern warrants investigation of bearing condition and other possible mechanical causes.', evidence: ['Increasing vibration relative to the operating baseline', 'Electrical behaviour changing alongside vibration', 'Process measurements provide operating context'] },
      compressor: { title: 'C-102 · Process compressor', signals: [u('Discharge temperature', '°C', 84, 25), u('Vibration', 'mm/s', 2.2, 3.4), u('Discharge pressure', 'bar', 6.8, -0.6)], diagnosis: 'Possible compression performance issue.', copy: 'Review the changing thermal and pressure behaviour alongside mechanical measurements and operating load.', evidence: ['Discharge temperature increasing', 'Vibration diverging from its baseline', 'Pressure behaviour changing at comparable conditions'] },
      exchanger: { title: 'HX-204 · Process heat exchanger', signals: [u('Cooling flow', 'm³/h', 42, 14), u('Pressure drop', 'bar', 0.8, 0.5), u('Process outlet temperature', '°C', 45, 0.2)], diagnosis: 'Possible developing fouling.', copy: 'Higher cooling demand and pressure drop while outlet temperature remains steady can warrant a thermal-performance investigation.', evidence: ['Increasing cooling demand for a similar duty', 'Rising pressure drop', 'Outlet temperature remains approximately steady'], settle: { signal: 2, factor: 0.12 } },
      motor: { title: 'M-306 · Drive motor', signals: [u('Motor current', 'A', 22, 5), u('Vibration', 'mm/s', 2.1, 3.8), u('Winding temperature', '°C', 62, 18)], diagnosis: 'Possible mechanical or load-related issue.', copy: 'Assess alignment, mechanical condition and operating load using the supporting electrical, vibration and thermal observations.', evidence: ['Current increasing relative to expected load', 'Vibration departing from baseline', 'Winding temperature trending upward'] },
    };
    const NORMAL = { state: 'Normal operating pattern', diag: 'Measurements follow the baseline.', copy: 'Run a developing-fault example to see how the signals change together.', evidence: ['Observed against comparable operating conditions', 'Multiple signals provide context'] };
    const DETECTED = { state: 'Anomaly detected', diag: 'A correlated change in equipment behaviour.', copy: 'Reviewing the supporting sensor pattern in this illustrative example.' };
    let asset = ASSETS.pump, tick = 20, faultStart = null, paused = !motionOK, phase = 'normal', last = 0, acc = 0, visible = false;
    const box = $('[data-signals]', sensor);
    const series = (i) => {
      const s = asset.signals[i], k = asset.settle && asset.settle.signal === i ? asset.settle.factor : 1;
      return Array.from({ length: 70 }, (_, x) => {
        const o = tick - (69 - x) * 0.1;
        const fault = faultStart === null ? 0 : Math.min(Math.max(o - faultStart, 0) / 5, 1);
        return s.base + (2 * Math.sin(5 * o + i) + 0.8 * Math.sin(13 * o) + 45 * fault * k) / 45 * s.delta;
      });
    };
    let rows = [];
    const build = () => {
      box.innerHTML = '';
      rows = asset.signals.map((s) => {
        const d = document.createElement('div'); d.className = 'sig';
        d.innerHTML = `<div class="sig__row"><span>${s.label}</span><b></b></div><canvas></canvas>`;
        box.appendChild(d); return { b: $('b', d), c: $('canvas', d), s };
      });
      $('[data-title]', sensor).textContent = asset.title;
    };
    const css = getComputedStyle(document.documentElement);
    const colOk = css.getPropertyValue('--agent-on-dark').trim() || '#7dd6c3';
    const colBad = css.getPropertyValue('--human-on-dark').trim() || '#f2b266';
    const draw = () => {
      const flagged = phase === 'detected' || phase === 'insight';
      rows.forEach((r, i) => {
        const data = series(i), c = r.c, dpr = Math.min(2, devicePixelRatio || 1);
        const w = c.clientWidth, h = c.clientHeight;
        if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        const span = Math.abs(r.s.delta) * 1.25, lo = Math.min(r.s.base, r.s.base + r.s.delta) - span * 0.25, hi = Math.max(r.s.base, r.s.base + r.s.delta) + span * 0.25;
        const Y = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12);
        g.setLineDash([4, 5]); g.strokeStyle = 'rgba(243,238,229,.3)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, Y(r.s.base)); g.lineTo(w, Y(r.s.base)); g.stroke(); g.setLineDash([]);
        g.strokeStyle = flagged ? colBad : colOk; g.lineWidth = 1.6; g.beginPath();
        data.forEach((v, x) => { const px = (x / 69) * w; x ? g.lineTo(px, Y(v)) : g.moveTo(px, Y(v)); });
        g.stroke();
        const lastV = data[data.length - 1];
        g.fillStyle = flagged ? colBad : colOk; g.beginPath(); g.arc(w - 3, Y(lastV), 3, 0, 7); g.fill();
        r.b.textContent = `${lastV.toFixed(1)} ${r.s.unit}`;
      });
    };
    const text = () => {
      const p = faultStart === null ? 'normal' : (tick - faultStart >= 4.1 ? 'insight' : tick - faultStart >= 3.2 ? 'detected' : 'developing');
      if (p === phase && rows.length && $('[data-diag]', sensor).dataset.asset === asset.title) return;
      phase = p;
      const flagged = p === 'detected' || p === 'insight';
      const state = $('[data-state]', sensor);
      state.textContent = p === 'insight' ? 'Illustrative diagnostic insight' : flagged ? DETECTED.state : NORMAL.state;
      state.classList.toggle('is-alert', flagged);
      const diag = $('[data-diag]', sensor); diag.dataset.asset = asset.title;
      diag.textContent = p === 'insight' ? asset.diagnosis : flagged ? DETECTED.diag : NORMAL.diag;
      $('[data-copy]', sensor).textContent = p === 'insight' ? asset.copy : flagged ? DETECTED.copy : NORMAL.copy;
      list($('[data-evidence]', sensor), p === 'insight' ? asset.evidence : NORMAL.evidence);
      const via = ($('input[name=notify]:checked', sensor) || {}).value || 'Email';
      $('[data-sent]', sensor).textContent = p === 'insight' ? `Maintenance notified through ${via}, with the supporting pattern attached. Simulated.` : 'No alert in this example.';
      if (motionOK && window.gsap && p !== 'developing') gsap.from([diag, $('[data-copy]', sensor)], { autoAlpha: 0, y: 8, duration: 0.45, stagger: 0.05, ease: 'power3.out' });
    };
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (!visible || paused || document.hidden) { last = now; return; }
      acc += Math.min(100, now - last); last = now;
      if (acc < 100) return;
      while (acc >= 100) { tick = Math.round((tick + 0.1) * 10) / 10; acc -= 100; }
      draw(); text();
    };
    $$('[data-asset]', sensor).forEach((b) => b.addEventListener('click', () => {
      $$('[data-asset]', sensor).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      asset = ASSETS[b.dataset.asset]; faultStart = null; build(); draw(); text();
    }));
    $('[data-fault]', sensor).addEventListener('click', () => { faultStart = tick; if (paused) { paused = false; syncPause(); } text(); });
    $('[data-reset]', sensor).addEventListener('click', () => { faultStart = null; draw(); text(); });
    const pauseBtn = $('[data-pause]', sensor);
    const syncPause = () => { pauseBtn.textContent = paused ? 'Play' : 'Pause'; $('[data-stream]', sensor).textContent = paused ? 'Sensor stream paused' : 'Sensor stream running'; };
    pauseBtn.addEventListener('click', () => { paused = !paused; syncPause(); });
    $$('input[name=notify]', sensor).forEach((r) => r.addEventListener('change', () => { if (phase === 'insight') { phase = ''; text(); } }));
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sensor);
    addEventListener('resize', draw);
    build(); syncPause(); draw(); text();
    requestAnimationFrame(frame);
  }

  window.__tools = { $, $$, motionOK };
})();
