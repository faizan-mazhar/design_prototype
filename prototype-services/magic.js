/* Vanilla ports of Magic UI components (https://magicui.design, MIT).
   React and Motion are replaced by CSS and the GSAP already on the page. */
(function () {
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOK = document.documentElement.classList.contains('motion') && window.gsap;
  const NS = 'http://www.w3.org/2000/svg';

  // Shimmer Button
  $$('[data-shimmer]').forEach((btn) => {
    const spark = document.createElement('span');
    spark.className = 'spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.appendChild(document.createElement('i'));
    btn.prepend(spark);
  });

  // Border Beam: runs only while its card is on screen
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-on', e.isIntersecting)));
  $$('[data-beam]').forEach((host) => {
    const bb = document.createElement('div');
    bb.className = 'bb';
    bb.setAttribute('aria-hidden', 'true');
    bb.appendChild(document.createElement('i'));
    host.appendChild(bb);
    io.observe(bb);
  });

  // Magic Card: pointer spotlight
  $$('.spot').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // Marquee: one duplicate set per loop, hidden from assistive tech and the tab order
  $$('.mq').forEach((mq) => {
    const set = mq.querySelector('.mq__set');
    const copy = set.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    $$('a', copy).forEach((a) => a.setAttribute('tabindex', '-1'));
    mq.appendChild(copy);
  });

  // Animated Beam
  const beams = $$('.beams');
  beams.forEach(setupBeams);

  function setupBeams(box) {
    const svg = box.querySelector('.beams__svg');
    const hub = box.querySelector('.hub__box');
    const links = [
      ...$$('[data-in] .node__box', box).map((el) => ({ from: el, to: hub })),
      ...$$('[data-out] .node__box', box).map((el) => ({ from: hub, to: el })),
    ];
    const inbound = links.filter((l) => l.to === hub);
    const outbound = links.filter((l) => l.from === hub);

    links.forEach((link) => {
      link.base = pathEl('var(--beam-base, rgb(11 11 12 / .2))', 1.5);
      const toPerson = link.to.closest('.node--human');
      link.beam = pathEl(toPerson ? 'var(--human)' : 'var(--agent)', 2);
      link.beam.setAttribute('pathLength', '1');
      link.beam.setAttribute('stroke-linecap', 'butt');
      link.beam.setAttribute('stroke-dasharray', '0.16 1.2');
      link.beam.setAttribute('stroke-dashoffset', '0.16');
      svg.append(link.base, link.beam);
      if (!motionOK) link.beam.remove();
    });

    // One conversation at a time: a message comes in, lands on the record, then goes out.
    const touches = [...box.querySelectorAll('[data-touches] li')];
    const log = JSON.parse(box.querySelector('[data-touches]').dataset.touches);
    let shown = [2, 1, 0];
    const light = (l, on) => (l.to === hub ? l.from : l.to).closest('.node').classList.toggle('is-active', on);
    function addTouch(n) {
      shown = [n, shown[0], shown[1]];
      touches.forEach((row, i) => {
        const [channel, note] = log[shown[i]];
        row.children[0].textContent = channel;
        row.children[1].textContent = note;
      });
      gsap.fromTo(touches[0], { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
    }

    const timelines = [];
    if (motionOK) {
      const run = gsap.timeline({ repeat: -1, paused: true });
      const send = (l, at, duration) => {
        run.call(light, [l, true], at);
        run.fromTo(l.beam, { attr: { 'stroke-dashoffset': 0.16 } }, { attr: { 'stroke-dashoffset': -1 }, duration, ease: 'power1.inOut' }, at);
        run.call(light, [l, false], at + duration + 0.25);
      };
      let t = 0;
      inbound.forEach((l, n) => {
        send(l, t, 0.95);
        run.call(addTouch, [n], t + 0.85);
        send(outbound[n % outbound.length], t + 1.05, 0.85);
        t += 2.2;
      });
      run.to({}, { duration: 0.01 }, t);
      timelines.push(run);
    }

    function layout() {
      const c = box.getBoundingClientRect();
      const vertical = getComputedStyle(box).flexDirection === 'column';
      links.forEach((l) => {
        const a = l.from.getBoundingClientRect();
        const b = l.to.getBoundingClientRect();
        let x1, y1, x2, y2, control;
        if (vertical) {
          // Stacked layout: labels sit under the icons, so inbound lines start below the label.
          const start = l.from === hub ? a : l.from.closest('.node').getBoundingClientRect();
          x1 = a.left - c.left + a.width / 2; y1 = start.bottom - c.top + 3;
          x2 = b.left - c.left + b.width / 2; y2 = b.top - c.top;
          control = `${x1},${(y1 + y2) / 2}`;
        } else {
          x1 = a.right - c.left; y1 = a.top - c.top + a.height / 2;
          x2 = b.left - c.left; y2 = b.top - c.top + b.height / 2;
          control = `${(x1 + x2) / 2},${y1}`;
        }
        const d = `M ${x1},${y1} Q ${control} ${x2},${y2}`;
        l.base.setAttribute('d', d);
        l.beam.setAttribute('d', d);
      });
    }
    new ResizeObserver(layout).observe(box);
    layout();
    box.__beamTimelines = timelines;
  }

  function pathEl(stroke, width) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', width);
    p.setAttribute('stroke-linecap', 'square');
    return p;
  }

  if (!motionOK) return;

  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    // Beams run only while in view
    beams.forEach((box) => {
      ScrollTrigger.create({
        trigger: box, start: 'top bottom', end: 'bottom top',
        onToggle: (st) => box.__beamTimelines.forEach((t) => t.paused(!st.isActive)),
      });
    });

    // Text Reveal: words light up with scroll
    $$('.treveal').forEach((section) => {
      const words = SplitText.create(section.querySelector('p'), { type: 'words' }).words;
      gsap.fromTo(words, { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 1,
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
      });
    });

    ScrollTrigger.refresh();
  });
})();
