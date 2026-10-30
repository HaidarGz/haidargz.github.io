// Scroll-driven motion: smooth scrolling, the hero's opening, the micro trenching story and the city's network
// settling in. With reduced motion the page stays still and shows the finished pictures.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('[data-step]').forEach(s => s.classList.add('is-active')); // every step readable at once
} else {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    const target = link && link.hash.length > 1 && document.querySelector(link.hash);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: target.id === 'top' ? 0 : -60 });
  });

  heroIntro();
  process();
  networkZoom();
  document.fonts.ready.then(() => ScrollTrigger.refresh()); // web fonts change heights, and pins depend on them
}

// The one orchestrated entrance: the headline arrives word by word over the live fiber, then the lead and buttons.
function heroIntro() {
  const h1 = document.querySelector('.hero h1');
  if (!h1) return;
  const words = h1.textContent.trim().split(/\s+/);
  h1.textContent = '';
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = word;
    h1.append(span, i < words.length - 1 ? ' ' : '');
  });
  h1.style.opacity = '1'; // the CSS keeps it hidden until now; the words fade in instead
  gsap.fromTo(h1.children, { yPercent: 60, opacity: 0, filter: 'blur(8px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.07, ease: 'expo.out', delay: 0.15 });
  gsap.fromTo('[data-hero-fade]', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'expo.out', delay: 0.6 });
}

// The street, scrubbed by the scroll: the crew paints the route, the Alpin drives in, lowers its wheel saw, cuts the
// slot and drives off; the duct goes in from the house end, and the slot is closed while the light runs to the house.
// Everything starts from the finished picture in the markup, rewound here.
function process() {
  const stage = document.querySelector('[data-process]');
  if (!stage) return;
  const $ = selector => stage.querySelector(selector), $$ = selector => stage.querySelectorAll(selector);
  const svg = $('[data-scene]'), steps = [...$$('[data-step]')];
  const rig = $('[data-p=rig]'), painter = $('[data-p=painter]'), car = $('[data-p=car]'), dust = $('[data-p=dust]');
  const saw = $$('[data-p=blade], [data-p=motor]'), tires = $$('[data-p=tire]'), legs = $$('[data-p=leg]');
  const lead = $('[data-p=lead]'), windows = $$('[data-p=win]');
  const route = $('#pr-route rect'), slot = $('#pr-slot rect'), lay = $('#pr-lay rect'), run = $('#pr-run rect'), fill = $('#pr-fill rect');
  const narrow = matchMedia('(max-width: 700px)'), W = 480; // on phones the picture is a 480-wide window that follows the work

  gsap.set(tires, { transformOrigin: '50% 50%' });
  gsap.set(legs, { transformOrigin: '50% 0%' });
  gsap.set([route, slot, run, fill], { attr: { width: 0 } });
  gsap.set(lay, { attr: { x: 1200, width: 0 } });
  gsap.set(painter, { x: -22 });
  gsap.set(rig, { x: -340 });
  gsap.set(car, { x: -400, opacity: 1 });
  gsap.set(lead, { attr: { y: 330, height: 0 } });
  gsap.set(windows, { opacity: 0.12 });

  const tl = gsap.timeline({ defaults: { ease: 'none' } })
    .to(painter, { x: 1270, duration: 3 }, 0)
    .to(route, { attr: { width: 1292 }, duration: 3 }, 0) // the paint follows the can in his hand
    .addLabel('cut', 3.1)
    .to(rig, { x: 74, duration: 1, ease: 'power2.out' }, 'cut')
    .to(saw, { y: 36, duration: 0.4, ease: 'power1.inOut' }, 'cut+=1') // the wheel sinks to trench depth
    .to(slot, { attr: { width: 118 }, duration: 0.4 }, '<')
    .to(dust, { opacity: 1, duration: 0.2 }, '<')
    .to(rig, { x: 1120, duration: 4 }, 'cut+=1.4')
    .to(slot, { attr: { width: 1164 }, duration: 4 }, '<') // the slot ends where the wheel's front edge is
    .to(saw, { y: 0, duration: 0.4, ease: 'power1.inOut' }, 'cut+=5.4')
    .to(dust, { opacity: 0, duration: 0.3 }, '<')
    .to(rig, { x: 1660, duration: 1.1, ease: 'power2.in' }, 'cut+=5.8') // drives off, leaving the street clear
    .addLabel('lay', 'cut+=7')
    .to(lay, { attr: { x: 0, width: 1200 }, duration: 2.2 }, 'lay')
    .addLabel('fill', 'lay+=2.5')
    .to(run, { attr: { width: 1200 }, duration: 2.4 }, 'fill-=0.2')
    .to(fill, { attr: { width: 1200 }, duration: 2.4 }, 'fill')
    .to(lead, { attr: { y: 286, height: 44 }, duration: 0.3 }, 'fill+=2.2') // the riser lights up into the house
    .to(windows, { opacity: 1, duration: 0.4, stagger: 0.03 }, 'fill+=2.4')
    .to(car, { x: 1500, duration: 1.6 }, 'fill+=2.6')
    .to({}, { duration: 0.4 }); // a moment on the finished street before the page moves on

  const marks = ['cut', 'lay', 'fill'].map(label => tl.labels[label]);
  const render = () => {
    gsap.set(tires, { rotation: gsap.getProperty(rig, 'x') * 1.91 }); // a 30-unit wheel rolling along the road
    const stride = Math.sin(gsap.getProperty(painter, 'x') / 14) * 18;
    legs.forEach((leg, i) => gsap.set(leg, { rotation: i ? -stride : stride }));
    const active = marks.filter(m => tl.time() >= m).length;
    // the phone's window centres on whatever is working: the painter, the machine, then the front of the duct or the fill
    const focus = [gsap.getProperty(painter, 'x'), gsap.getProperty(rig, 'x') - 128, +lay.getAttribute('x'), +fill.getAttribute('width')][active];
    svg.setAttribute('viewBox', narrow.matches ? `${gsap.utils.clamp(0, 1200 - W, focus - W / 2)} 0 ${W} 460` : '0 0 1200 460');
    steps.forEach((s, i) => s.classList.toggle('is-active', i === active));
  };
  tl.eventCallback('onUpdate', render);
  render(); // sets the phone framing before the pin measures the stage
  narrow.addEventListener('change', () => { render(); ScrollTrigger.refresh(); });
  ScrollTrigger.create({ trigger: stage, start: 'top top', end: '+=400%', pin: true, scrub: 0.6, animation: tl });
}

// The city's network at night settles into place as the contact section scrolls in.
function networkZoom() {
  const art = document.querySelector('[data-network-art]');
  if (art) gsap.fromTo(art, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: art.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
}
