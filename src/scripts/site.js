// Interface behaviour that needs no animation library: header state, route meter, mobile menu, language memory, sections
// rising into view and photographs opening from a slot, the clock in Erbil, and the form that hands off to WhatsApp.
const root = document.documentElement;

const header = document.querySelector('[data-header]'), route = document.querySelector('[data-route]');
const metres = route.querySelector('[data-route-m]'), ROUTE_LENGTH = 1200; // the page, read as a route of this many metres
let lastY = scrollY;
function onScroll() {
  const y = scrollY, share = Math.min(1, y / (root.scrollHeight - innerHeight));
  header.classList.toggle('is-scrolled', y > 24);
  header.classList.toggle('is-hidden', y > lastY && y > 400 && !header.querySelector('.lang[open]'));
  lastY = y;
  route.style.setProperty('--along', share);
  metres.textContent = String(Math.round(share * ROUTE_LENGTH)).padStart(4, '0');
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

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

// Each section's parts rise into place once as it arrives, and photographs open from a narrow slot, the way the road
// does; without script or with reduced motion they are simply there.
if (!still) {
  root.classList.add('reveal-ready');
  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); seen.unobserve(entry.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal], [data-cut]').forEach(el => seen.observe(el));
}

const clock = document.querySelector('[data-erbil-time]');
if (clock) {
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' }); // Erbil keeps Baghdad time
  const tick = () => { clock.textContent = time.format(new Date()); };
  tick();
  setInterval(tick, 20000);
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
