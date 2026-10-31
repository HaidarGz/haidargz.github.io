// The cable in 3D. A fiber cable in its duct, first seen end on like concepts/cable-core.png, opens layer by layer as
// the page scrolls: the duct, jacket, strength yarn and tubes slide back and the glass fans out, carrying the light.
// motion.js scrubs the numbers in `state`; this file only draws them.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { brand, materials, untoned } from './hero.js';
import { FIBER_COLOURS } from '../data/site.js';

const LENGTH = 44; // every layer runs out of frame behind its cut end
const TWIST = 0.16; // radians per unit along the cable: how tightly the tubes wind around the rod
const ORBIT = 1.3, TUBE = 0.6, BORE = 0.5, ROD = 0.46; // tube centres, tube walls, the centre rod
const BACK = { duct: 8.4, jacket: 6.6, yarn: 5, tubes: 3.2, rod: 1.5 }; // how far each layer slides back
const FIBER_START = 6.5; // the glass only needs to reach this far back inside the tubes

function sleeve(radius, material) {
  const geometry = new THREE.CylinderGeometry(radius, radius, LENGTH, 128, 1, true);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(-LENGTH / 2, 0, 0); // runs from x = -LENGTH to the cut end at x = 0
  const { position, uv } = geometry.attributes, around = 2 * Math.PI * radius;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / around, uv.getX(i)); // textures run along the cable
  return new THREE.Mesh(geometry, material);
}

// A pipe with a rounded lip at its cut end, so the edge catches the light like real plastic.
function pipe(outer, inner, material) {
  const lip = 0.045, points = [new THREE.Vector2(outer, -LENGTH), new THREE.Vector2(outer, -0.4)];
  const arc = (cx, from, to) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + ((to - from) * i) / 6;
      points.push(new THREE.Vector2(cx + lip * Math.cos(a), -lip + lip * Math.sin(a)));
    }
  };
  arc(outer - lip, 0, Math.PI / 2);
  arc(inner + lip, Math.PI / 2, Math.PI);
  points.push(new THREE.Vector2(inner, -0.4), new THREE.Vector2(inner, -LENGTH));
  const geometry = new THREE.LatheGeometry(points, 128);
  geometry.rotateZ(-Math.PI / 2); // the lathe's axis becomes the cable's, cut end at x = 0
  const { position, uv } = geometry.attributes, around = 2 * Math.PI * outer;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / around, 1 - uv.getX(i));
  return new THREE.Mesh(geometry, material);
}

function ring(inner, outer, material) {
  const geometry = inner ? new THREE.RingGeometry(inner, outer, 128) : new THREE.CircleGeometry(outer, 96);
  geometry.rotateY(Math.PI / 2); // faces the cut end
  return new THREE.Mesh(geometry, material);
}

const at = (object, x, y, z) => (object.position.set(x, y, z), object);
const canvasOf = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
function texture(canvas, repeatV = 1, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, repeatV);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

// The print on a real cable jacket: words and a metre count, in one line along its length.
function jacketPrint(words, ground, shift, upturned) {
  const c = canvasOf(1536, 512), x = c.getContext('2d'), metres = '0125 m', start = 48, gap = 56;
  x.fillStyle = ground;
  x.fillRect(0, 0, c.width, c.height);
  x.font = "600 34px 'Archivo Variable', Arial, sans-serif";
  x.textBaseline = 'middle';
  const wordsWide = x.measureText(words).width;
  if (upturned) { // the cable points the other way for right-to-left readers; the print turns in place to stay upright
    x.translate(2 * start + wordsWide + gap + x.measureText(metres).width, c.height);
    x.rotate(Math.PI);
  }
  x.fillStyle = 'rgba(238, 241, 251, 0.78)';
  x.fillText(words, start, c.height / 2);
  x.fillStyle = '#ff5b65';
  x.fillText(metres, start + wordsWide + gap, c.height / 2);
  const t = texture(c, 3);
  t.offset.x = shift; // slides the words onto the stretch of pipe that stays in view
  return t;
}

function yarnTexture() {
  const c = canvasOf(512, 512), x = c.getContext('2d'), tones = ['#c9a94e', '#e7d48b', '#5e4a1b', '#a5873a'];
  x.fillStyle = '#7a6226';
  x.fillRect(0, 0, 512, 512);
  x.globalAlpha = 0.55;
  for (let i = 0; i < 3200; i++) {
    const px = Math.random() * 512, py = Math.random() * 512, len = 40 + Math.random() * 170;
    x.strokeStyle = tones[i % 4];
    x.lineWidth = 0.7 + Math.random() * 1.3;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + len, py + (Math.random() - 0.5) * 16);
    x.stroke();
  }
  return texture(c, 2);
}

function speckle() {
  const c = canvasOf(256, 256), x = c.getContext('2d'), tones = ['#d9bf6a', '#8a6d2a', '#f0e0a0', '#5e4a1b'];
  x.fillStyle = '#a5873a';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = tones[i % 4];
    x.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const t = texture(c);
  t.repeat.set(2.5, 2.5);
  return t;
}

class Helix extends THREE.Curve {
  constructor(angle) { super(); this.angle = angle; }
  getPoint(t, out = new THREE.Vector3()) {
    const x = -LENGTH * (1 - t), a = this.angle + TWIST * x;
    return out.set(x, ORBIT * Math.cos(a), ORBIT * Math.sin(a));
  }
}

// Seventy-two fibers, twelve in each tube: three in the middle and nine around them, wound along with the tube, each
// knowing where it goes when the cable fans out. Colours follow the fiber code. Everything lives in one geometry.
function buildFibers(segments) {
  const SIDES = 5, RADIUS = 0.034, count = 6 * 12, rings = segments + 1, verts = count * rings * SIDES;
  const position = new Float32Array(verts * 3), normal = new Float32Array(verts * 3), fan = new Float32Array(verts * 3);
  const colour = new Float32Array(verts * 3), light = new Float32Array(verts * 3), along = new Float32Array(verts), seedOf = new Float32Array(verts);
  const index = new Uint32Array(count * segments * SIDES * 6);
  const tipPos = new Float32Array(count * 3), tipFan = new Float32Array(count * 3), tipCol = new Float32Array(count * 3), tipSeed = new Float32Array(count);
  const end = 1 - BACK.tubes / FIBER_START; // where along the fiber the tube's mouth ends up
  const c = new THREE.Color(), g = new THREE.Color();
  let v = 0, k = 0;
  for (let tube = 0; tube < 6; tube++) {
    const a0 = (tube * Math.PI) / 3;
    for (let f = 0; f < 12; f++) {
      const inner = f < 3, spot = (f / (inner ? 3 : 9)) * Math.PI * 2 + tube, r = inner ? 0.12 : 0.33;
      const oy = r * Math.cos(spot), oz = r * Math.sin(spot), seed = Math.random();
      const reach = 6.5 + Math.random() * 6, spread = 1.2 + 6.6 * Math.random() ** 1.25, droop = 0.6 + Math.random() * 2.2;
      const dir = a0 + TWIST * -BACK.tubes + (Math.random() - 0.5) * 1.9;
      const dy = Math.cos(dir), dz = Math.sin(dir);
      c.set(FIBER_COLOURS[f]);
      brand(Math.random(), g);
      const point = s => {
        const x = -FIBER_START * (1 - s), a = a0 + TWIST * x, ca = Math.cos(a), sa = Math.sin(a);
        return [x, (ORBIT + oy) * ca - oz * sa, (ORBIT + oy) * sa + oz * ca];
      };
      const mouth = point(end);
      for (let i = 0; i < rings; i++) {
        const s = i / segments, [x, y, z] = point(s), o = Math.max(0, (s - end) / (1 - end));
        const fx = s > end ? mouth[0] + reach * o - x : 0;
        const fy = s > end ? mouth[1] + spread * o ** 1.7 * dy - droop * o * o - y : 0;
        const fz = s > end ? mouth[2] + spread * o ** 1.7 * dz - z : 0;
        for (let side = 0; side < SIDES; side++, v++) {
          const b = (side / SIDES) * Math.PI * 2, ny = Math.cos(b), nz = Math.sin(b);
          position.set([x, y + ny * RADIUS, z + nz * RADIUS], v * 3);
          normal.set([0, ny, nz], v * 3);
          fan.set([fx, fy, fz], v * 3);
          colour.set([c.r, c.g, c.b], v * 3);
          light.set([g.r, g.g, g.b], v * 3);
          along[v] = s;
          seedOf[v] = seed;
          if (i < segments) {
            const a = v, b2 = v - side + ((side + 1) % SIDES), d = a + SIDES, e = b2 + SIDES;
            index.set([a, d, b2, b2, d, e], k);
            k += 6;
          }
        }
        if (i === segments) {
          const n = tube * 12 + f;
          tipPos.set([x, y, z], n * 3);
          tipFan.set([fx, fy, fz], n * 3);
          tipCol.set([c.r, c.g, c.b], n * 3);
          tipSeed[n] = seed;
        }
      }
    }
  }
  const lines = new THREE.BufferGeometry();
  const set = (geometry, name, array, size) => geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
  set(lines, 'position', position, 3); set(lines, 'normal', normal, 3); set(lines, 'aFan', fan, 3);
  set(lines, 'aCol', colour, 3); set(lines, 'aLight', light, 3); set(lines, 'aS', along, 1); set(lines, 'aSeed', seedOf, 1);
  lines.setIndex(new THREE.BufferAttribute(index, 1));
  const tips = new THREE.BufferGeometry();
  set(tips, 'position', tipPos, 3); set(tips, 'aFan', tipFan, 3); set(tips, 'aCol', tipCol, 3); set(tips, 'aSeed', tipSeed, 1);
  return { lines, tips };
}

function fiberMaterials(uniforms) {
  const glass = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uFan;
      attribute vec3 aFan; attribute vec3 aCol; attribute vec3 aLight; attribute float aS; attribute float aSeed;
      varying vec3 vCol; varying vec3 vLight; varying vec3 vN; varying float vS; varying float vSeed;
      void main() {
        vCol = aCol; vLight = aLight; vS = aS; vSeed = aSeed;
        vN = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + aFan * uFan, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uFan;
      varying vec3 vCol; varying vec3 vLight; varying vec3 vN; varying float vS; varying float vSeed;
      void main() {
        float lit = 0.3 + 0.7 * max(dot(normalize(vN), normalize(vec3(0.2, 0.8, 0.55))), 0.0);
        float head = fract(uTime * (0.14 + 0.2 * fract(vSeed * 7.31)) + vSeed * 13.7);
        float d = head * 1.15 - vS;
        float pulse = d >= 0.0 ? exp(-d * 14.0) : exp(-d * d * 2600.0);
        float side = uFan * (0.25 + 1.5 * vS * vS * vS);                  // the glass itself glows once it is out
        vec3 base = mix(vCol * lit * 0.8, vLight, smoothstep(0.55, 1.0, vS) * uFan * 0.7);
        gl_FragColor = vec4(base + vLight * (pulse * 3.4 * (0.35 + 0.65 * uFan) + side), 1.0);
      }`,
  });
  const tips = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uFan; uniform float uPixel;
      attribute vec3 aFan; attribute vec3 aCol; attribute float aSeed;
      varying vec3 vCol; varying float vSeed;
      void main() {
        vCol = aCol; vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(position + aFan * uFan, 1.0);
        gl_PointSize = mix(21.0, 14.0, uFan) * uPixel * (17.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vCol; varying float vSeed;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float core = exp(-r * r * 34.0), coat = smoothstep(0.7, 0.52, r), halo = exp(-r * r * 3.6) * 0.12;
        float twinkle = 0.8 + 0.2 * sin(uTime * 2.4 + vSeed * 40.0);
        gl_FragColor = vec4((vCol * (coat * 1.2 + halo) + vec3(1.0) * core * 2.2) * twinkle, 1.0);
      }`,
  });
  return { glass, tips };
}

// The same slow bokeh as the hero, floating around the cable.
function buildDust(material) {
  const count = 40, position = new Float32Array(count * 3), colour = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    position.set([-16 + Math.random() * 26, (Math.random() - 0.5) * 18, -16 + Math.random() * 22], i * 3);
    colour.set(brand(Math.random(), c).toArray(), i * 3);
    seed[i] = Math.random();
    size[i] = 26 + 62 * Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, array, n] of [['position', position, 3], ['aCol', colour, 3], ['aSeed', seed, 1], ['aSize', size, 1]]) geometry.setAttribute(name, new THREE.BufferAttribute(array, n));
  return Object.assign(new THREE.Points(geometry, material), { frustumCulled: false });
}

export function startCable(stage, canvas, state) {
  const rtl = document.documentElement.dir === 'rtl', side = rtl ? -1 : 1;
  const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const ground = untoned('#060a1e');
  const scene = new THREE.Scene();
  scene.background = ground;
  scene.fog = new THREE.Fog(ground, 30, 62); // the cable fades into the page as it runs away from the camera
  const environment = new THREE.PMREMGenerator(renderer);
  scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  environment.dispose();

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 140);
  const bloomLight = at(new THREE.PointLight('#ff4f9a', 0, 0, 2), 6, 0, 1); // the fanned glass lights the layers behind it
  scene.add(
    at(new THREE.DirectionalLight('#dfe6ff', 1.5), 5, 10, 9),
    at(new THREE.PointLight('#ff2f55', 220, 0, 2), 5, -7, 7),
    at(new THREE.PointLight('#b9a4ff', 190, 0, 2), -7, 8, -9),
    bloomLight,
  );

  const root = new THREE.Group();
  scene.add(root);
  const plastic = { roughness: 0.42, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.42 };

  const layer = () => root.add(new THREE.Group()) && root.children.at(-1);
  const duct = layer(), jacket = layer(), yarn = layer(), tubes = layer(), rod = layer();
  duct.add(pipe(3, 2.76, new THREE.MeshPhysicalMaterial({ map: jacketPrint('RED LAVENDER     HDPE DUCT', '#090b12', -0.485, rtl), ...plastic })));
  jacket.add(pipe(2.6, 2.34, new THREE.MeshPhysicalMaterial({ map: jacketPrint('RED LAVENDER     FIBER OPTIC', '#0e1019', -0.485, rtl), ...plastic, roughness: 0.55 })));
  const yarnMap = yarnTexture(), faceMap = speckle();
  yarn.add(
    sleeve(2.34, new THREE.MeshStandardMaterial({ map: yarnMap, bumpMap: yarnMap, bumpScale: 1.4, roughness: 0.74, metalness: 0.15 })),
    ring(2.18, 2.34, new THREE.MeshStandardMaterial({ map: faceMap, bumpMap: faceMap, bumpScale: 0.8, roughness: 0.7, metalness: 0.2 })),
    at(ring(0, 2.18, new THREE.MeshStandardMaterial({ color: '#020307', roughness: 0.95, envMapIntensity: 0 })), -0.03, 0, 0),
  );

  const tubeGeometry = new THREE.TubeGeometry(new Helix(0), small ? 110 : 220, TUBE, small ? 20 : 36, false);
  FIBER_COLOURS.slice(0, 6).map(hex => (hex === '#f1f1ee' ? '#c9c9c4' : hex)).forEach((hex, i) => { // white plastic would blow out under the lights
    const material = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.7 });
    const a = (i * Math.PI) / 3, y = ORBIT * Math.cos(a), z = ORBIT * Math.sin(a);
    const mesh = new THREE.Mesh(tubeGeometry, material);
    mesh.rotation.x = a;
    tubes.add(mesh, at(ring(BORE, TUBE, material), 0, y, z), at(ring(0, BORE, new THREE.MeshStandardMaterial({ color: '#12030a', roughness: 0.7, envMapIntensity: 0 })), -0.02, y, z));
  });
  const rodMaterial = new THREE.MeshPhysicalMaterial({ color: '#c4c1b6', roughness: 0.66, clearcoat: 0.15 });
  rod.add(sleeve(ROD, rodMaterial), ring(0, ROD, rodMaterial));

  const uniforms = { uTime: { value: 0 }, uFan: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } };
  const mats = fiberMaterials(uniforms), fibers = buildFibers(small ? 40 : 72);
  const glass = new THREE.Mesh(fibers.lines, mats.glass), tips = new THREE.Points(fibers.tips, mats.tips);
  glass.frustumCulled = tips.frustumCulled = false; // the vertex shader moves them
  root.add(glass, tips);
  scene.add(buildDust(materials({ uTime: uniforms.uTime, uPixel: uniforms.uPixel, uLevel: { value: 1 } }).dust));

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.6, 1)); // only light brighter than white blooms
  composer.addPass(new OutputPass());

  let wide = true, near = 22, far = 31;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    wide = w > h * 1.1;
    // beside the words on wide screens, centred on tall ones; a thin screen needs the camera further back
    near = wide ? 16.2 : 16.2 * Math.max(1, 0.95 / camera.aspect);
    far = wide ? 31 : 31 * Math.max(1, 1.25 / camera.aspect);
    scene.fog.near = far - 1; // the fade moves back with the camera, or a thin screen loses the cable to it
    scene.fog.far = far * 2;
    if (wide) camera.setViewOffset(w, h, -0.165 * w * side, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  const pointer = new THREE.Vector2(), target = new THREE.Vector2();
  addEventListener('pointermove', e => target.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });

  const { lerp } = THREE.MathUtils;
  let visible = true, raf = 0, last = performance.now(), shown = false;
  const wake = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  addEventListener('resize', () => requestAnimationFrame(resize));

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    uniforms.uTime.value += dt;
    uniforms.uFan.value = state.fan;
    pointer.lerp(target, 0.05);
    root.rotation.x += dt * 0.05; // the cable turns slowly, so it reads as a solid thing before anyone scrolls

    duct.position.x = -BACK.duct * state.duct;
    jacket.position.x = -BACK.jacket * state.jacket;
    yarn.position.x = -BACK.yarn * state.yarn;
    const pull = BACK.tubes * state.tubes;
    tubes.position.x = -pull;
    tubes.rotation.x = -TWIST * pull; // screws back along its own twist, so the fibers stay inside
    rod.position.x = -BACK.rod * state.tubes;
    bloomLight.intensity = 130 * state.fan;

    const az = (lerp(0.02, 1.08, state.orbit) + pointer.x * 0.05) * side, el = lerp(0, 0.3, state.orbit) - pointer.y * 0.04;
    const distance = lerp(near, far, state.orbit), x = lerp(0, 0.4, state.orbit);
    camera.position.set(x + distance * Math.cos(el) * Math.cos(az), distance * Math.sin(el), distance * Math.cos(el) * Math.sin(az));
    camera.lookAt(x, 0, 0);

    composer.render();
    if (!shown) { shown = true; stage.classList.add('is-live'); }
    raf = requestAnimationFrame(frame);
  }

  resize();
  wake();
}
