// In the field: the crews' photographs lie in a pile, and pressing it cuts the top one open. A hot line runs through
// the point pressed, throwing sparks and dust, the two halves fly apart and the next photograph comes up. With reduced
// motion the next photograph simply takes over. Over the pile the pointer becomes a saw blade and the pile leans to it.
import { gsap } from 'gsap';

// Splits the w by h card along the line through (px, py) with normal (nx, ny): the polygon on each side, and where
// the line leaves the card.
function slice(w, h, px, py, nx, ny) {
  const corners = [[0, 0], [w, 0], [w, h], [0, h]], plus = [], minus = [], ends = [];
  const side = ([x, y]) => (x - px) * nx + (y - py) * ny;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4], sa = side(a), sb = side(b);
    (sa >= 0 ? plus : minus).push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb), cross = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      plus.push(cross);
      minus.push(cross);
      ends.push(cross);
    }
  });
  return { plus, minus, ends };
}

const pile = document.querySelector('[data-field]');
if (pile) {
  const wrap = pile.parentElement, blade = wrap.querySelector('.field-blade'), fx = pile.querySelector('canvas');
  const cards = [...pile.querySelectorAll('img')], cap = document.querySelector('[data-field-cap]');
  const count = document.querySelector('[data-field-n]'), ticks = [...document.querySelectorAll('[data-field-tick]')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shown = 0, busy = false;

  const next = () => {
    cards.push(cards.shift());
    cards.forEach((card, i) => card.style.setProperty('--i', i)); // the rest move up a place
    shown = (shown + 1) % cards.length;
    cap.textContent = cards[0].dataset.caption;
    count.textContent = shown + 1;
    ticks.forEach((tick, i) => tick.classList.toggle('is-on', i === shown));
    if (!still) gsap.fromTo(cap, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  };

  // The hot line, the sparks and the dust are drawn on a canvas that reaches past the card on every side.
  const ctx = fx.getContext('2d'), bits = [];
  const REACH = 0.3; // how far past the card, as a share of its size
  let line = null, raf = 0, then = 0;
  function frame(now) {
    const dt = Math.min(0.04, (now - then) / 1000), w = pile.offsetWidth, h = pile.offsetHeight;
    then = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, fx.width, fx.height);
    ctx.setTransform(fx.width / (w * (1 + 2 * REACH)), 0, 0, fx.height / (h * (1 + 2 * REACH)), 0, 0);
    ctx.translate(w * REACH, h * REACH);
    ctx.lineCap = 'round';
    if (line) {
      const x = line.from[0] + (line.to[0] - line.from[0]) * line.t, y = line.from[1] + (line.to[1] - line.from[1]) * line.t;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = line.glow;
      for (const [width, colour] of [[16, 'rgba(225, 10, 23, 0.22)'], [7, 'rgba(247, 35, 47, 0.55)'], [2.2, '#fff1e2']]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.moveTo(...line.from);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt * b.fade;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      b.vy += (b.dust ? 60 : 1300) * dt;
      b.vx *= b.dust ? 0.94 : 0.985;
      b.vy *= b.dust ? 0.94 : 0.985;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.dust) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(214, 203, 182, ${0.13 * b.life})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + (1 - b.life) * 34, 0, 7);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = b.life > 0.62 ? '#fff1cf' : b.life > 0.3 ? '#ff9a3c' : '#e10a17';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
        ctx.stroke();
      }
    }
    raf = bits.length || line ? requestAnimationFrame(frame) : 0;
    if (!raf) ctx.clearRect(-w, -h, w * 3, h * 3);
  }
  const play = () => {
    if (raf) return;
    const r = Math.min(devicePixelRatio, 2);
    fx.width = pile.offsetWidth * (1 + 2 * REACH) * r;
    fx.height = pile.offsetHeight * (1 + 2 * REACH) * r;
    then = performance.now();
    raf = requestAnimationFrame(frame);
  };
  function spray(x, y, ux, uy) { // sparks thrown back from the blade, a little dust with them
    for (let i = 0; i < 6; i++) {
      const a = (Math.random() - 0.5) * 1.3, speed = 220 + Math.random() * 640, c = Math.cos(a), s = Math.sin(a);
      bits.push({ x, y, vx: (ux * c - uy * s) * speed, vy: (ux * s + uy * c) * speed, life: 1, fade: 1.5 + Math.random() * 1.7 });
    }
    bits.push({ x, y, dust: true, r: 6 + Math.random() * 12, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 120, life: 1, fade: 0.9 + Math.random() * 0.6 });
  }

  function cut(px, py) {
    busy = true;
    wrap.classList.add('is-cutting');
    const top = cards[0], w = pile.offsetWidth, h = pile.offsetHeight;
    const lean = (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.32); // off the vertical, a different cut each time
    const nx = Math.cos(lean), ny = Math.sin(lean);
    const { plus, minus, ends } = slice(w, h, px, py, nx, ny);
    const [from, to] = ends.sort((a, b) => a[1] - b[1]); // the blade comes down from the top
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]), ux = (from[0] - to[0]) / len, uy = (from[1] - to[1]) / len;
    const halves = [plus, minus].map(polygon => {
      const half = top.cloneNode();
      half.alt = '';
      half.className = 'field-half';
      half.style.clipPath = `polygon(${polygon.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;
      pile.append(half);
      return half;
    });
    line = { from, to, t: 0, glow: 1 };
    play();
    const fly = (half, dir) => ({ x: nx * w * 0.66 * dir, y: ny * w * 0.66 * dir + h * 0.06, z: 70, rotation: 8 * dir, rotationY: 30 * dir, duration: 1, ease: 'power3.out' });
    gsap.timeline({
      onComplete() {
        halves.forEach(half => half.remove());
        top.style.visibility = '';
        wrap.classList.remove('is-cutting');
        busy = false;
      },
    })
      .to(line, {
        t: 1, duration: 0.26, ease: 'power1.in',
        onUpdate() { spray(line.from[0] + (to[0] - from[0]) * line.t, line.from[1] + (to[1] - from[1]) * line.t, ux, uy); },
      })
      .add(() => {
        halves.forEach(half => { half.style.visibility = 'visible'; });
        top.style.visibility = 'hidden';
        next();
      })
      .to(halves[0], fly(halves[0], 1), '<')
      .to(halves[1], fly(halves[1], -1), '<')
      .to(halves, { opacity: 0, duration: 0.42, ease: 'power1.in' }, '<0.32')
      .to(line, { glow: 0, duration: 0.3, onComplete() { line = null; } }, '<-0.32');
  }

  pile.addEventListener('click', e => {
    if (busy) return;
    if (still) return next();
    const r = pile.getBoundingClientRect(), w = pile.offsetWidth, h = pile.offsetHeight;
    const keyboard = e.detail === 0; // Enter or Space has no pointer, so the cut goes through the middle
    cut(keyboard ? w / 2 : gsap.utils.clamp(16, w - 16, e.clientX - r.left), keyboard ? h / 2 : gsap.utils.clamp(16, h - 16, e.clientY - r.top));
  });

  if (!still && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    gsap.set(pile, { transformPerspective: 1500 });
    const lean = { x: gsap.quickTo(pile, 'rotationX', { duration: 0.7, ease: 'power3' }), y: gsap.quickTo(pile, 'rotationY', { duration: 0.7, ease: 'power3' }) };
    const follow = { x: gsap.quickTo(blade, 'x', { duration: 0.18, ease: 'power3' }), y: gsap.quickTo(blade, 'y', { duration: 0.18, ease: 'power3' }) };
    const aim = (e, snap) => {
      const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (snap) { follow.x(x, x); follow.y(y, y); } else { follow.x(x); follow.y(y); }
      lean.x((0.5 - y / r.height) * 11);
      lean.y((x / r.width - 0.5) * 14);
      pile.style.setProperty('--mx', `${x}px`);
      pile.style.setProperty('--my', `${y}px`);
    };
    pile.addEventListener('pointerenter', e => { wrap.classList.add('is-hot'); aim(e, true); });
    pile.addEventListener('pointermove', e => aim(e, false));
    pile.addEventListener('pointerleave', () => { wrap.classList.remove('is-hot'); lean.x(0); lean.y(0); });
  }
}
