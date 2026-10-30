// Interface behaviour that needs no animation library: header state, mobile menu, language memory,
// sections rising into view, the pile of field photographs, and the contact form that hands the message to WhatsApp.
const root = document.documentElement;

const header = document.querySelector('[data-header]');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  header.classList.toggle('is-scrolled', y > 24);
  header.classList.toggle('is-hidden', y > lastY && y > 400 && !header.querySelector('.lang[open]'));
  lastY = y;
}, { passive: true });

const menu = document.querySelector('[data-menu]'), openBtn = document.querySelector('[data-menu-open]');
function setMenu(open, returnFocus = true) {
  menu.hidden = !open;
  openBtn.setAttribute('aria-expanded', String(open));
  root.style.overflow = open ? 'hidden' : '';
  if (open) menu.querySelector('a')?.focus();
  else if (returnFocus) openBtn.focus();
}
openBtn.addEventListener('click', () => setMenu(true));
menu.querySelector('[data-menu-close]').addEventListener('click', () => setMenu(false));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false, false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

document.addEventListener('click', e => {
  const choice = e.target.closest('[data-lang]');
  if (choice) try { localStorage.setItem('rl-lang', choice.dataset.lang); } catch {} // the bare domain reads this
  for (const d of document.querySelectorAll('.lang[open]')) if (!d.contains(e.target)) d.open = false;
});

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Each section's parts rise into place once as it arrives; without script or with reduced motion they are simply there.
if (!still) {
  root.classList.add('reveal-ready');
  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); seen.unobserve(entry.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => seen.observe(el));
}

// In the field: the crews' photographs lie in a pile. Pressing it sends the top card away to the bottom of the pile
// and the one beneath comes up, its caption read out.
const pile = document.querySelector('[data-field]');
if (pile) {
  const cards = [...pile.querySelectorAll('img')], cap = document.querySelector('[data-field-cap]');
  const layout = () => cards.forEach((card, i) => card.style.setProperty('--i', i));
  let busy = false;
  pile.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    const top = cards.shift();
    top.classList.add('is-leaving');
    layout(); // the rest move up a place while the top card flies off
    cap.textContent = cards[0].dataset.caption;
    setTimeout(() => { top.classList.remove('is-leaving'); cards.push(top); layout(); busy = false; }, still ? 0 : 450);
  });
}

const form = document.querySelector('[data-whatsapp-form]');
form?.addEventListener('submit', e => {
  e.preventDefault();
  const data = new FormData(form), [nameLabel, phoneLabel, serviceLabel] = JSON.parse(form.dataset.labels);
  const value = key => String(data.get(key) || '').trim();
  const lines = [form.dataset.greeting, '', `${nameLabel}: ${value('name')}`];
  if (value('phone')) lines.push(`${phoneLabel}: ${value('phone')}`);
  if (value('service')) lines.push(`${serviceLabel}: ${value('service')}`);
  lines.push('', value('message'));
  window.open(`https://wa.me/${form.dataset.number}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
});
