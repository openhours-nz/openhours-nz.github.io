/* Openhours — main.js
   Three small jobs: reveal things as they arrive; count the stats up; let cards notice the cursor.
   (Day→night is pure CSS — see styles.css §8.) The <html class="js"> flag is set inline in each page's <head>;
   without JS nothing is ever hidden. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Arrivals — direct children of each section (or of its .container), and children of any [data-stagger] group.
  const targets = [];
  document.querySelectorAll('main section').forEach(section => {
    let kids = [...section.children];
    kids = kids.flatMap(k => k.classList.contains('container') ? [...k.children] : [k]);
    kids = kids.flatMap(k => k.hasAttribute('data-stagger') ? [...k.children] : [k]);
    kids.forEach((el, i) => { el.style.setProperty('--i', i); targets.push(el); });
  });

  // 2. Count-up for .stat numbers, fired when their tile arrives.
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count); if (Number.isNaN(target)) return;
    const fmt = new Intl.NumberFormat('en-NZ'); const t0 = performance.now(); const dur = 900;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur); const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt.format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (reduce) {
    document.querySelectorAll('.stat[data-count]').forEach(el => el.textContent = new Intl.NumberFormat('en-NZ').format(el.dataset.count));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        e.target.querySelectorAll('.stat[data-count]').forEach(countUp);
        if (e.target.matches('.stat[data-count]')) countUp(e.target);
        io.unobserve(e.target);           // once — never on the way back up
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(el => io.observe(el));
  }

  // 3. Cards: a lamp-coloured spotlight follows the cursor (CSS draws it from --mx/--my).
  if (!reduce && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('pointermove', (ev) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((ev.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((ev.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      }, { passive: true });
    });
  }
})();
