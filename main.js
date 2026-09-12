/* Openhours — main.js
   One job: reveal things as they arrive. (Day→night is pure CSS — see styles.css §8.)
   The <html class="js"> flag is set inline in each page's <head>; without JS nothing is ever hidden. */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // What reveals: direct children of each section (or of its .container), and the children of any [data-stagger] group.
  const targets = [];
  document.querySelectorAll('main section').forEach(section => {
    let kids = [...section.children];
    kids = kids.flatMap(k => k.classList.contains('container') ? [...k.children] : [k]);
    kids = kids.flatMap(k => k.hasAttribute('data-stagger') ? [...k.children] : [k]);
    kids.forEach((el, i) => { el.style.setProperty('--i', i); targets.push(el); });
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);           // once — never on the way back up
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(el => io.observe(el));
})();
