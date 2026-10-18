// Hand-made SVG charts (no library). Colours come from CSS classes / the
// category's fixed colour so they follow light and dark mode.
import { h, s } from './ui.js';

function topRoundedBar(x, y, w, hgt, r = 4) {
  if (hgt <= 0) return '';
  const rr = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hgt}Z`;
}

/**
 * Grouped bar chart. Tap a month to see its numbers in the caption.
 * @param data    [{ key, label, values: { income, expense } }]
 * @param series  [{ key, label, cls }]
 * @param format  value formatter
 */
export function barChart({ data, series, format, caption, title }) {
  const W = 320, H = 150, top = 14, bottom = 22, left = 4, right = 4;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...data.flatMap((d) => series.map((sr) => d.values[sr.key] || 0)));
  const groupW = (W - left - right) / data.length;
  const barW = Math.min(18, (groupW * 0.7 - 2) / series.length);
  const cap = h('p', { class: 'chart-caption', 'aria-live': 'polite' }, caption ?? '');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart bar-chart', role: 'img', 'aria-label': title });
  svg.append(
    s('line', { x1: left, x2: W - right, y1: top, y2: top, class: 'grid' }),
    s('line', { x1: left, x2: W - right, y1: top + plotH / 2, y2: top + plotH / 2, class: 'grid' }),
    s('text', { x: left, y: top - 4, class: 'axis-label' }, format(max)),
  );
  data.forEach((d, i) => {
    const gx = left + i * groupW;
    const total = series.length * barW + (series.length - 1) * 2;
    let x = gx + (groupW - total) / 2;
    const g = s('g', { class: 'bar-group', tabindex: 0, role: 'button', 'aria-label': `${d.label}: ${series.map((sr) => `${sr.label} ${format(d.values[sr.key] || 0)}`).join(', ')}` });
    g.append(s('rect', { x: gx, y: 0, width: groupW, height: H, class: 'hit' }));
    for (const sr of series) {
      const v = d.values[sr.key] || 0;
      const bh = (v / max) * plotH;
      g.append(s('path', { d: topRoundedBar(x, top + plotH - bh, barW, bh), class: `bar ${sr.cls}` }));
      x += barW + 2;
    }
    g.append(s('text', { x: gx + groupW / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, d.label));
    const show = () => {
      svg.querySelectorAll('.bar-group.on').forEach((n) => n.classList.remove('on'));
      g.classList.add('on');
      cap.textContent = g.getAttribute('aria-label');
    };
    g.addEventListener('click', show);
    g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && show());
    svg.append(g);
  });
  svg.append(s('line', { x1: left, x2: W - right, y1: top + plotH, y2: top + plotH, class: 'baseline' }));
  const legend = h('div', { class: 'legend' }, series.map((sr) => h('span', { class: 'legend-item' }, h('span', { class: `swatch ${sr.cls}` }), sr.label)));
  return h('figure', { class: 'chart-wrap' }, legend, svg, cap);
}

/**
 * Donut chart with a legend table.
 * @param items [{ label, value, color, icon }]
 */
export function donutChart({ items, format, centerLabel, centerValue, title }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const R = 52, C = 2 * Math.PI * R, SW = 18;
  const svg = s('svg', { viewBox: '0 0 140 140', class: 'chart donut', role: 'img', 'aria-label': title });
  svg.append(s('circle', { cx: 70, cy: 70, r: R, class: 'donut-track', 'stroke-width': SW, fill: 'none' }));
  let offset = 0;
  const gap = items.length > 1 ? 2 : 0;
  for (const it of items) {
    const len = total > 0 ? (it.value / total) * C : 0;
    if (len <= 0) continue;
    svg.append(s('circle', {
      cx: 70, cy: 70, r: R, fill: 'none', stroke: it.color, 'stroke-width': SW,
      'stroke-dasharray': `${Math.max(0, len - gap)} ${C}`, 'stroke-dashoffset': -offset, transform: 'rotate(-90 70 70)',
    }, s('title', {}, `${it.label}: ${format(it.value)}`)));
    offset += len;
  }
  svg.append(
    s('text', { x: 70, y: 66, 'text-anchor': 'middle', class: 'donut-label' }, centerLabel ?? ''),
    s('text', { x: 70, y: 84, 'text-anchor': 'middle', class: 'donut-value' }, centerValue ?? ''),
  );
  const table = h('div', { class: 'donut-legend', role: 'table' },
    items.map((it) => h('div', { class: 'donut-row', role: 'row' },
      h('span', { class: 'swatch', style: { background: it.color }, 'aria-hidden': 'true' }),
      h('span', { class: 'grow', role: 'cell' }, `${it.icon ? `${it.icon} ` : ''}${it.label}`),
      h('span', { class: 'num', role: 'cell' }, format(it.value)),
      h('span', { class: 'muted num small', role: 'cell' }, total > 0 ? `${Math.round((it.value / total) * 100)}%` : ''),
    )));
  return h('figure', { class: 'chart-wrap donut-wrap' }, svg, table);
}

export function sparkline(values, { title } = {}) {
  const W = 300, H = 60, pad = 6;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - 2 * pad), H - pad - ((v - min) / span) * (H - 2 * pad)]);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart sparkline', role: 'img', 'aria-label': title });
  svg.append(
    s('path', { d: `M${pts.map((p) => p.join(',')).join('L')}`, class: 'spark-line', fill: 'none' }),
    s('circle', { cx: pts.at(-1)[0], cy: pts.at(-1)[1], r: 4, class: 'spark-dot' }),
  );
  return svg;
}
