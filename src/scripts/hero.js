// Live fiber hero: strands fan out of a bundle, light pulses run up some of them, lit tips glow, bloom on top.
// The geometry follows concepts/fiber-bloom.png, so the still image and the live scene match.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FOV = 40, CAM_Z = 12, SEG = 40;
const STOPS = [[0, '#ff1f2e'], [0.38, '#ff2f97'], [0.72, '#b7a1ff'], [1, '#4f6dff']].map(([p, c]) => [p, new THREE.Color(c)]);
function brand(u, out) {
  u = Math.min(1, Math.max(0, u));
  let i = 1;
  while (i < STOPS.length - 1 && u > STOPS[i][0]) i++;
  const [p0, c0] = STOPS[i - 1], [p1, c1] = STOPS[i];
  return out.copy(c0).lerp(c1, (u - p0) / (p1 - p0));
}

const SWAY = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  vec3 sway(vec3 p, float t, float seed) {
    float k = t * t;
    p.x += sin(uTime * 0.55 + seed * 6.2831 + t * 2.3) * 0.18 * k;
    p.y += cos(uTime * 0.45 + seed * 4.0 + t * 1.9) * 0.14 * k;
    p.z += sin(uTime * 0.35 + seed * 9.0) * 0.25 * k;
    p.xy += uPointer * 0.5 * k;
    return p;
  }`;

function materials(uniforms) {
  const additive = { uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const lines = new THREE.ShaderMaterial({
    ...additive,
    vertexShader: /* glsl */ `${SWAY}
      attribute float aT; attribute float aSeed; attribute vec3 aCol;
      varying float vT; varying float vSeed; varying vec3 vCol; varying float vFog;
      void main() {
        vec4 mv = modelViewMatrix * vec4(sway(position, aT, aSeed), 1.0);
        vT = aT; vSeed = aSeed; vCol = aCol;
        vFog = clamp(1.0 - (-mv.z - 9.0) / 12.0, 0.3, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLevel;
      varying float vT; varying float vSeed; varying vec3 vCol; varying float vFog;
      void main() {
        float glow = 0.05 + 0.45 * vT * vT;              // side glow, brighter toward the lit tip
        float head = fract(uTime * (0.12 + 0.18 * fract(vSeed * 7.31)) + vSeed * 13.7);
        float d = head - vT;
        float pulse = d >= 0.0 ? exp(-d * 18.0) : exp(-d * d * 4000.0);
        pulse *= step(0.6, fract(vSeed * 3.97));         // only some strands carry pulses
        gl_FragColor = vec4(vCol * (glow + pulse * 1.8) * vFog * uLevel, 1.0);
      }`,
  });
  const tips = new THREE.ShaderMaterial({
    ...additive,
    vertexShader: /* glsl */ `${SWAY}
      uniform float uPixel;
      attribute float aSeed; attribute vec3 aCol; attribute float aSize;
      varying vec3 vCol; varying float vSeed;
      void main() {
        vec4 mv = modelViewMatrix * vec4(sway(position, 1.0, aSeed), 1.0);
        vCol = aCol; vSeed = aSeed;
        gl_PointSize = aSize * uPixel * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLevel;
      varying vec3 vCol; varying float vSeed;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float core = exp(-r * r * 18.0), halo = exp(-r * r * 3.5) * 0.35;
        float twinkle = 0.75 + 0.25 * sin(uTime * 2.2 + vSeed * 40.0);
        gl_FragColor = vec4(mix(vCol, vec3(1.0), core * 0.6) * (core * 2.2 + halo) * twinkle * uLevel, 1.0);
      }`,
  });
  const dust = new THREE.ShaderMaterial({
    ...additive,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPixel;
      attribute vec3 aCol; attribute float aSeed; attribute float aSize;
      varying vec3 vCol; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.08 + 0.12 * aSeed) + 6.0, 12.0) - 6.0;
        p.x += sin(uTime * 0.2 + aSeed * 6.2831) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vCol = aCol; vA = 0.25 + 0.35 * aSeed;
        gl_PointSize = aSize * uPixel * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel;
      varying vec3 vCol; varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float disc = smoothstep(1.0, 0.82, r) * (0.6 + 0.4 * smoothstep(0.5, 0.95, r)); // bokeh: flat, brighter rim
        gl_FragColor = vec4(vCol * disc * vA * 0.18 * uLevel, 1.0);
      }`,
  });
  return { lines, tips, dust };
}

// The canvas is ACES tone mapped, which crushes dark colours. Run the page navy backwards through three's
// ACESFilmicToneMapping (constants from its tonemapping shader) so the background comes out as the page's own.
function untoned(hex) {
  const c = new THREE.Color(hex), v = new THREE.Vector3(c.r, c.g, c.b);
  v.applyMatrix3(new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602).invert());
  for (const k of ['x', 'y', 'z']) { // RRTAndODTFit is a ratio of quadratics, so each channel inverts with the quadratic formula
    const u = v[k], A = 1 - 0.983729 * u, B = 0.0245786 - 0.432951 * u, C = -(0.000090537 + 0.238081 * u);
    v[k] = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  }
  v.applyMatrix3(new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777).invert()).multiplyScalar(0.6);
  return new THREE.Color(v.x, v.y, v.z);
}

function attr(geometry, name, array, size) {
  geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
}

// Strands are thrown out of a bundle below the frame and arc under a little gravity, like a fiber lamp.
function buildFiber(aspect, count, mats) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z, halfW = halfH * aspect;
  const portrait = aspect < 1;
  const ox0 = portrait ? halfW * 0.25 : halfW * 0.86, oy0 = -halfH - (portrait ? 0.6 : 1);
  const [lean0, lean1] = portrait ? [-28, 42] : [-6, 76];
  const verts = count * (SEG + 1);
  const pos = new Float32Array(verts * 3), col = new Float32Array(verts * 3), aT = new Float32Array(verts), aSeed = new Float32Array(verts);
  const index = new Uint32Array(count * SEG * 2);
  const tipPos = new Float32Array(count * 3), tipCol = new Float32Array(count * 3), tipSeed = new Float32Array(count), tipSize = new Float32Array(count);
  const c = new THREE.Color();
  let k = 0;
  for (let i = 0; i < count; i++) {
    const u = Math.random(), phi = THREE.MathUtils.degToRad(lean0 + (lean1 - lean0) * u);
    const speed = halfH * (1.7 + 0.7 * Math.random()), grav = halfH * (0.4 + 0.9 * Math.random()), T = 0.55 + 0.55 * Math.random();
    const vx = -Math.sin(phi) * speed, vy = Math.cos(phi) * speed, vz = (Math.random() - 0.5) * halfH * 1.1;
    const ox = ox0 + (Math.random() - 0.5) * 0.5, oy = oy0 + (Math.random() - 0.5) * 0.3, oz = (Math.random() - 0.5) * 0.6;
    const seed = Math.random();
    brand(u + (Math.random() - 0.5) * 0.16, c);
    for (let s = 0; s <= SEG; s++) {
      const t = (T * s) / SEG, v = i * (SEG + 1) + s;
      pos[v * 3] = ox + vx * t;
      pos[v * 3 + 1] = oy + vy * t - 0.5 * grav * t * t;
      pos[v * 3 + 2] = oz + vz * t;
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
      aT[v] = s / SEG;
      aSeed[v] = seed;
      if (s < SEG) { index[k++] = v; index[k++] = v + 1; }
    }
    const last = (i * (SEG + 1) + SEG) * 3;
    tipPos.set(pos.subarray(last, last + 3), i * 3);
    tipCol.set([c.r, c.g, c.b], i * 3);
    tipSeed[i] = seed;
    tipSize[i] = 2 + 5 * Math.random() ** 2;
  }
  const lines = new THREE.BufferGeometry();
  attr(lines, 'position', pos, 3); attr(lines, 'aCol', col, 3); attr(lines, 'aT', aT, 1); attr(lines, 'aSeed', aSeed, 1);
  lines.setIndex(new THREE.BufferAttribute(index, 1));
  const tips = new THREE.BufferGeometry();
  attr(tips, 'position', tipPos, 3); attr(tips, 'aCol', tipCol, 3); attr(tips, 'aSeed', tipSeed, 1); attr(tips, 'aSize', tipSize, 1);

  const D = 140, dPos = new Float32Array(D * 3), dCol = new Float32Array(D * 3), dSeed = new Float32Array(D), dSize = new Float32Array(D);
  for (let i = 0; i < D; i++) {
    dPos.set([(Math.random() * 2 - 0.6) * halfW, (Math.random() * 2 - 1) * halfH, -2 - Math.random() * 8], i * 3);
    dCol.set(brand(Math.random(), c).toArray(), i * 3);
    dSeed[i] = Math.random();
    dSize[i] = 12 + 26 * Math.random();
  }
  const dust = new THREE.BufferGeometry();
  attr(dust, 'position', dPos, 3); attr(dust, 'aCol', dCol, 3); attr(dust, 'aSeed', dSeed, 1); attr(dust, 'aSize', dSize, 1);

  // the vertex shaders move everything, so skip culling against the static bounds
  return [new THREE.LineSegments(lines, mats.lines), new THREE.Points(tips, mats.tips), new THREE.Points(dust, mats.dust)].map(m => Object.assign(m, { frustumCulled: false }));
}

export function startHero(hero, canvas) {
  const rtl = document.documentElement.dir === 'rtl';
  const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = untoned('#060a1e');
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  const group = new THREE.Group();
  if (rtl) group.scale.x = -1; // the bundle sits on the far side from where the text starts
  scene.add(group);

  const uniforms = { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uLevel: { value: 1 }, uPixel: { value: renderer.getPixelRatio() } };
  const mats = materials(uniforms);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.55, 0.02)); // the threshold keeps the background itself from blooming
  composer.addPass(new OutputPass());

  let meshes = [], layout = '';
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const next = w < h ? 'portrait' : 'landscape';
    if (next === layout) return;
    layout = next;
    for (const m of meshes) { group.remove(m); m.geometry.dispose(); }
    meshes = buildFiber(w / h, small ? 520 : 1300, mats);
    group.add(...meshes);
  }

  const pointer = new THREE.Vector2(), target = new THREE.Vector2();
  addEventListener('pointermove', e => target.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });

  let visible = true, raf = 0, last = performance.now(), shown = false;
  const wake = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  addEventListener('resize', () => requestAnimationFrame(resize));

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return; // paused off screen; wake() restarts it
    uniforms.uTime.value += Math.min(0.05, (now - last) / 1000);
    last = now;
    pointer.lerp(target, 0.04);
    uniforms.uPointer.value.set(rtl ? -pointer.x : pointer.x, pointer.y);
    const p = Math.min(1, scrollY / hero.clientHeight); // scrolling away dives into the strands and dims them
    camera.position.set(pointer.x * 0.6, pointer.y * 0.4, CAM_Z - p * 3.5);
    camera.lookAt(0, 0, 0);
    group.rotation.z = (rtl ? 1 : -1) * p * 0.18;
    uniforms.uLevel.value = 1 - p * 0.55;
    composer.render();
    if (!shown) { shown = true; hero.classList.add('is-live'); }
    raf = requestAnimationFrame(frame);
  }

  resize();
  wake();
}
