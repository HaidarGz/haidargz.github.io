// The Red Lavender mark rebuilt as geometry: a rounded square cut into two red frame pieces and two blue
// leaves around a square opening. The numbers were fitted to images/1.jpeg (97% red, 99% blue overlap).
// The mark is 100 x 100 units; the logo's own colours are the gradients below.
const R = 20.4; // the big outer corners, top left and bottom right
const h = 22.6; // half the opening
const g = 3.92; // the white gap between pieces
const t = 31.4, a = 16.13; // top of the left leaf and its round corner
const bx = 24.75, by = 23.25; // the long curve where a leaf meets the red piece below it
const o = 50 - h, i = 50 + h;
const n = v => +v.toFixed(2);

const outer = `M${R} 0H100V${n(100 - R)}A${R} ${R} 0 0 1 ${n(100 - R)} 100H0V${R}A${R} ${R} 0 0 1 ${R} 0Z`;
const leafL = `M0 ${n(t + a)}A${a} ${a} 0 0 1 ${a} ${t}H${n(o)}V${n(100 - by)}A${bx} ${by} 0 0 1 ${n(o - bx)} 100H0Z`;
const leafR = `M100 ${n(100 - t - a)}A${a} ${a} 0 0 1 ${n(100 - a)} ${n(100 - t)}H${n(i)}V${by}A${bx} ${by} 0 0 1 ${n(i + bx)} 0H100Z`;

export const OPENING = { from: n(o), to: n(i) };
export const RED = [[0, '#a50a0d'], [0.3, '#d90303'], [0.6, '#ea0101'], [1, '#f20000']];
export const BLUE = [[0, '#20354f'], [0.45, '#233f68'], [1, '#244675']];

const stops = s => s.map(([p, c]) => `<stop offset="${p}" stop-color="${c}"/>`).join('');
const grad = (id, x1, x2, s) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="0" x2="${x2}" y2="0">${stops(s)}</linearGradient>`;

// The mark's SVG content (it draws in 0 0 100 100). `id` keeps the defs unique when a page shows several marks.
// Each piece is its own group so it can be animated on its own; the red pieces are the rounded square
// minus the opening and the leaves grown by the gap, which is what the mask does.
export function markSVG(id) {
  return `<defs>${grad(`${id}-rt`, 0, 84, RED)}${grad(`${id}-rb`, 16, 100, RED)}${grad(`${id}-bl`, 0, n(o), BLUE)}${grad(`${id}-br`, n(i), 100, BLUE)}`
    + `<mask id="${id}-cut" maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110"><rect x="-5" y="-5" width="110" height="110" fill="#fff"/>`
    + `<rect x="${n(o)}" y="${n(o)}" width="${n(2 * h)}" height="${n(2 * h)}"/><path d="${leafL}" stroke="#000" stroke-width="${n(2 * g)}"/><path d="${leafR}" stroke="#000" stroke-width="${n(2 * g)}"/></mask>`
    + `<clipPath id="${id}-t"><path d="M0 0H100V${n(o)}H${n(o)}V50H0Z"/></clipPath><clipPath id="${id}-b"><path d="M100 100H0V${n(i)}H${n(i)}V50H100Z"/></clipPath></defs>`
    + `<g data-piece="top"><g mask="url(#${id}-cut)"><path clip-path="url(#${id}-t)" fill="url(#${id}-rt)" d="${outer}"/></g></g>`
    + `<g data-piece="right"><path fill="url(#${id}-br)" d="${leafR}"/></g>`
    + `<g data-piece="bottom"><g mask="url(#${id}-cut)"><path clip-path="url(#${id}-b)" fill="url(#${id}-rb)" d="${outer}"/></g></g>`
    + `<g data-piece="left"><path fill="url(#${id}-bl)" d="${leafL}"/></g>`;
}
