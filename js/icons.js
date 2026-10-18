// Stroke icons (24×24), drawn as inline SVG.
import { s } from './ui.js';

const PATHS = {
  home: ['M3 11.5 12 4l9 7.5', 'M5.5 10v10h5v-6h3v6h5V10'],
  list: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  target: [{ c: [12, 12, 9] }, { c: [12, 12, 5] }, { c: [12, 12, 1.2] }],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  more: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  plus: ['M12 5v14', 'M5 12h14'],
  lock: [{ r: [5, 11, 14, 10, 2] }, 'M8 11V7.5a4 4 0 0 1 8 0V11'],
  back: ['M15 18l-6-6 6-6'],
  chevron: ['M9 18l6-6-6-6'],
  sms: ['M20 15.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 12.5h5'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  backspace: ['M21 5H9l-6 7 6 7h12z', 'M13 9.5l5 5', 'M18 9.5l-5 5'],
};

export function icon(name, { size = 24, label } = {}) {
  const svg = s('svg', { viewBox: '0 0 24 24', width: size, height: size, class: `icon icon-${name}`, 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label ?? null, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  for (const p of PATHS[name] ?? []) {
    if (typeof p === 'string') svg.append(s('path', { d: p }));
    else if (p.c) svg.append(s('circle', { cx: p.c[0], cy: p.c[1], r: p.c[2] }));
    else if (p.r) svg.append(s('rect', { x: p.r[0], y: p.r[1], width: p.r[2], height: p.r[3], rx: p.r[4] }));
  }
  return svg;
}
