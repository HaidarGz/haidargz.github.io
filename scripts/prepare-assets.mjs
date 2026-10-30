// Turns the raw material in images/ and concepts/ into site assets: cleaned job photos,
// the logo's wordmark and tagline as vectors, favicons and the social share image.
// Run `npm run assets` again after changing anything in images/ or concepts/.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import potrace from 'potrace';
import opentype from 'opentype.js';
import { markSVG } from '../src/assets/logo/mark.js';

const PHOTOS = {
  'trench-curb': ['7.jpeg'],
  'street-cut': ['5.jpeg'],
  'main-road': ['6.jpeg'],
  'two-machines': ['8.jpeg'],
  'duct-coil': ['9.jpeg'],
  'backfill-truck': ['10.jpeg'],
  'market-street': ['2.jpeg'],
  'fence-line': ['3.jpeg'],
  // GPS stamp, map inset and logo watermark on this one: keep the band between them
  'kirkuk-ducts': ['4.jpeg', { top: 0.125, bottom: 0.77 }],
};

await fs.mkdir('src/assets/photos', { recursive: true });
for (const [name, [file, crop]] of Object.entries(PHOTOS)) {
  let img = sharp(`images/${file}`).rotate();
  if (crop) {
    const { width, height } = await sharp(`images/${file}`).metadata();
    const top = Math.round(height * crop.top);
    img = img.extract({ left: 0, top, width, height: Math.round(height * crop.bottom) - top });
  }
  await img.jpeg({ quality: 90, mozjpeg: true }).toFile(`src/assets/photos/${name}.jpg`);
}

// ---------- Logo ----------
// The mark is geometry (src/assets/logo/mark.js). The wordmark is traced from the logo image: a soft ink map
// upscaled 8x, barely blurred and cut at half ink, so edges stay straight and the counters stay open
// (they need fill-rule="evenodd"). The tagline is Montserrat SemiBold set as paths, sized to the image.
const LOGO = 'images/1.jpeg';
const { data: src, info } = await sharp(LOGO).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const inkAt = (x, y) => { const i = (y * info.width + x) * 3; return 255 - (src[i] + src[i + 1] + src[i + 2]) / 3; };
const inkedRow = y => { for (let x = 0; x < info.width; x++) if (inkAt(x, y) > 90) return true; return false; };
const bands = [];
for (let y = 0, start = -1, gap = 0; y < info.height; y++) {
  if (inkedRow(y)) { if (start < 0) start = y; gap = 0; }
  else if (start >= 0 && ++gap > 6) { bands.push([start, y - gap]); start = -1; gap = 0; }
}
if (bands.length !== 3) throw new Error(`expected mark, wordmark and tagline in the logo image, found ${bands.length} bands of ink`);
const box = ([ya, yb]) => {
  let x0 = info.width, x1 = 0;
  for (let y = ya; y <= yb; y++) for (let x = 0; x < info.width; x++) if (inkAt(x, y) > 90) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  return [x0, ya, x1 + 1, yb + 1];
};
const [markBox, wordBox, tagBox] = bands.map(box);

// wordmark
const K = 8, P = 6, wx = wordBox[0] - P, wy = wordBox[1] - P, ww = wordBox[2] - wordBox[0] + 2 * P, wh = wordBox[3] - wordBox[1] + 2 * P;
const ink = Buffer.alloc(ww * wh);
for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) ink[y * ww + x] = Math.max(0, Math.min(255, inkAt(wx + x, wy + y)));
let gapA = 0, gapB = 0; // RED and LAVENDER split at the widest run of empty columns
for (let x = 0, run = 0; x < ww; x++) {
  let col = 0;
  for (let y = 0; y < wh; y++) col = Math.max(col, ink[y * ww + x]);
  if (col < 60) { if (++run > gapB - gapA) { gapA = x - run + 1; gapB = x + 1; } } else run = 0;
}
const big = await sharp(ink, { raw: { width: ww, height: wh, channels: 1 } }).resize(ww * K, wh * K, { kernel: 'lanczos3' }).blur(1.3).extractChannel(0).raw().toBuffer();
async function trace(from, to) {
  const W = ww * K, H = wh * K, bw = Buffer.alloc(W * H, 255);
  for (let y = 0; y < H; y++) for (let x = from; x < Math.min(W, to); x++) if (big[y * W + x] > 96) bw[y * W + x] = 0;
  const png = await sharp(bw, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const svg = await new Promise((ok, no) => potrace.trace(png, { turdSize: 400, alphaMax: 1, optCurve: true, optTolerance: 0.15 }, (e, s) => (e ? no(e) : ok(s))));
  return svg.match(/ d="([^"]+)"/)[1];
}
const split = Math.round(((gapA + gapB) / 2) * K);
const word = { x: wx, y: wy, scale: 1 / K, red: await trace(0, split), navy: await trace(split, Infinity), box: wordBox };

// tagline: Montserrat SemiBold at the image's cap height, tracked to the image's width
const font = opentype.parse((await fs.readFile('node_modules/@fontsource/montserrat/files/montserrat-latin-600-normal.woff')).buffer);
const TAGLINE = 'FOR GENERAL TRADING';
function setLine(size, track) {
  const path = new opentype.Path(), glyphs = font.stringToGlyphs(TAGLINE);
  let x = 0;
  glyphs.forEach((gl, k) => {
    path.extend(gl.getPath(x, 0, size));
    if (k < glyphs.length - 1) x += ((gl.advanceWidth + font.getKerningValue(gl, glyphs[k + 1])) / font.unitsPerEm) * size + track;
  });
  return path;
}
const tagW = tagBox[2] - tagBox[0], size = (tagBox[3] - tagBox[1]) / (font.tables.os2.sCapHeight / font.unitsPerEm);
let lo = -2, hi = 20;
for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, b = setLine(size, mid).getBoundingBox(); if (b.x2 - b.x1 < tagW) lo = mid; else hi = mid; }
const tagPath = setLine(size, lo), tb = tagPath.getBoundingBox();
const tag = { x: +(tagBox[0] - tb.x1).toFixed(2), y: +(tagBox[1] - tb.y1).toFixed(2), d: tagPath.toPathData(2), box: tagBox };

// the ink box takes in the anti-aliased edge pixel on each side; the mark's real edge is half a pixel in
const logo = { mark: { x: markBox[0] + 0.5, y: markBox[1] + 0.5, size: Math.max(markBox[2] - markBox[0], markBox[3] - markBox[1]) - 1 }, word, tag };
await fs.mkdir('src/assets/logo', { recursive: true });
await fs.writeFile('src/assets/logo/paths.js', `// Generated by scripts/prepare-assets.mjs from images/1.jpeg. Coordinates are the image's pixels.\nexport default ${JSON.stringify(logo)};\n`);

// ---------- Favicons and the share image ----------
await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${markSVG('f')}</svg>`);
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -22 144 144"><rect x="-22" y="-22" width="144" height="144" fill="#fff"/>${markSVG('t')}</svg>`;
await sharp(Buffer.from(touch)).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// share image: the lockup in the logo's own layout, reversed out of navy, with the fiber light behind
const m = logo.mark, s = m.size / 100;
const ux = word.box[0], uy = m.y, uw = word.box[2] - ux, uh = tag.box[3] - uy;
const ogW = 1200, ogH = 630, lw = 560, k = lw / uw;
const lockup = `<g transform="translate(${(ogW - lw) / 2} ${(ogH - uh * k) / 2}) scale(${k}) translate(${-ux} ${-uy})">`
  + `<g transform="translate(${m.x} ${m.y}) scale(${s})">${markSVG('o')}</g>`
  + `<g transform="translate(${word.x} ${word.y}) scale(${word.scale})"><path fill="#f20000" fill-rule="evenodd" d="${word.red}"/><path fill="#f3f5fc" fill-rule="evenodd" d="${word.navy}"/></g>`
  + `<path transform="translate(${tag.x} ${tag.y})" fill="#aeb8d6" d="${tag.d}"/></g>`;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${ogW}" height="${ogH}"><rect width="${ogW}" height="${ogH}" fill="#060a1e" fill-opacity=".72"/>${lockup}</svg>`;
await sharp('concepts/fiber-bloom.png').resize(ogW, ogH, { fit: 'cover' }).modulate({ brightness: 0.55 })
  .composite([{ input: Buffer.from(og) }]).jpeg({ quality: 86, mozjpeg: true }).toFile('public/og.jpg');

console.log(`photos: ${Object.keys(PHOTOS).length}, logo: mark ${m.size}px, wordmark ${uw}px, tagline Montserrat ${size.toFixed(1)}px tracked ${lo.toFixed(2)}px`);
