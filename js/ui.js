// Tiny DOM helpers. Everything is built with createElement/textContent, never
// from HTML strings, so text from an SMS or user input can't inject markup.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'text') el.textContent = v;
      else if (['value', 'checked', 'selected', 'disabled', 'hidden', 'required', 'multiple'].includes(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// ---------------------------------------------------------------- sheets
// Keep bottom sheets above the on-screen keyboard (iOS overlays it on the page).
if (typeof window !== 'undefined' && window.visualViewport) {
  const vv = window.visualViewport;
  const sync = () => {
    const root = document.documentElement.style;
    root.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    root.setProperty('--vvh', `${vv.height}px`);
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

const sheetRoot = () => document.getElementById('sheets');

export function openSheet({ title, body, onClose, wide = false }) {
  const root = sheetRoot();
  const prevFocus = document.activeElement;
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const closeBtn = h('button', { class: 'icon-btn sheet-close', type: 'button', 'aria-label': 'Close', onclick: () => close() }, '✕');
  const sheet = h('section', { class: `sheet${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-grip' }),
    h('header', { class: 'sheet-head' }, h('h2', { text: title }), closeBtn),
    h('div', { class: 'sheet-body' }, body),
  );
  const wrap = h('div', { class: 'sheet-wrap' }, backdrop, sheet);
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 200);
    onClose?.();
    if (prevFocus?.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  }
  return { close, el: sheet, body: sheet.querySelector('.sheet-body') };
}

export function closeAllSheets() {
  sheetRoot()?.replaceChildren();
}

// ---------------------------------------------------------------- toast
export function toast(message, { kind = 'info', ms = 3200, action, actions } = {}) {
  const root = document.getElementById('toasts');
  const list = actions ?? (action ? [action] : []);
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    h('span', { class: 'toast-text', text: message }),
    list.length > 0 && h('span', { class: 'toast-actions' }, list.map((a) =>
      h('button', { class: 'toast-btn', type: 'button', onclick: () => { el.remove(); a.run(); } }, a.label))),
  );
  // only one toast with Undo/Edit at a time, so the buttons always mean the latest entry
  if (list.length) root.querySelectorAll('.toast.has-actions').forEach((x) => x.remove());
  if (list.length) el.classList.add('has-actions');
  root.append(el);
  // keep the screen readable: only the two newest toasts stay
  while (root.children.length > 2) root.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
  return el;
}

// Swipe a row sideways (either direction) to delete it.
export function swipeToDelete(row, onDelete, label) {
  let x0 = null;
  let y0 = 0;
  let dx = 0;
  row.classList.add('swipeable');
  row.addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    dx = 0;
  }, { passive: true });
  row.addEventListener('touchmove', (e) => {
    if (x0 == null) return;
    dx = e.touches[0].clientX - x0;
    if (Math.abs(e.touches[0].clientY - y0) > Math.abs(dx)) return;
    row.style.transform = `translateX(${dx}px)`;
    row.classList.toggle('swiping', Math.abs(dx) > 30);
  }, { passive: true });
  row.addEventListener('touchend', () => {
    const far = Math.abs(dx) > Math.min(140, row.offsetWidth * 0.35);
    row.style.transform = '';
    row.classList.remove('swiping');
    x0 = null;
    if (far) onDelete();
  });
  row.setAttribute('aria-description', label);
  return row;
}

// ---------------------------------------------------------------- confirm
export function confirmDialog({ title, message, ok, cancel, danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => {
      if (answered) return;
      answered = true;
      sheet.close();
      resolve(v);
    };
    const sheet = openSheet({
      title,
      onClose: () => !answered && (answered = true, resolve(false)),
      body: [
        h('p', { class: 'muted pre-line', text: message }),
        h('div', { class: 'row gap end' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => done(false) }, cancel),
          h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => done(true) }, ok),
        ),
      ],
    });
  });
}

// ---------------------------------------------------------------- form bits
export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label', text: label }),
    control,
    hint && h('span', { class: 'field-hint', text: hint }),
  );
}

export function segmented(options, value, onChange, { name = 'seg' } = {}) {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup' });
  for (const o of options) {
    const b = h('button', {
      type: 'button', role: 'radio', class: o.value === value ? 'on' : '', 'aria-checked': String(o.value === value), dataset: { v: o.value, name },
      onclick: () => {
        for (const x of wrap.children) {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        }
        onChange(o.value);
      },
    }, o.label);
    wrap.append(b);
  }
  return wrap;
}

export function select(options, value, onChange, attrs = {}) {
  const el = h('select', { ...attrs, onchange: () => onChange?.(el.value) },
    options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return el;
}

export function progress(pct, level = 'ok', label) {
  const v = Math.max(0, Math.min(1, pct || 0));
  return h('div', { class: `progress ${level}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v * 100), 'aria-label': label },
    h('div', { class: 'progress-fill', style: { width: `${v * 100}%` } }));
}

export function numberInput(value, attrs = {}) {
  return h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done', value: value ?? '', ...attrs });
}

// Accepts "1,234.5", "1234,5" (comma as decimal when it is the only separator) and Arabic digits.
export function readNumber(input) {
  let s = String(input ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0)
    .replace(/٫/g, '.')
    .replace(/[٬\s]/g, '');
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  s = s.replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

export function emptyState(text, action) {
  return h('div', { class: 'empty' }, h('p', { text }), action);
}

export function card(...children) {
  return h('section', { class: 'card' }, ...children);
}

export function listRow({ icon, title, subtitle, value, valueClass = '', onClick, chevron = false }) {
  const tag = onClick ? 'button' : 'div';
  return h(tag, { class: `list-row${onClick ? ' tappable' : ''}`, type: onClick ? 'button' : null, onclick: onClick },
    icon != null && h('span', { class: 'row-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'row-main' }, h('span', { class: 'row-title', text: title }), subtitle && h('span', { class: 'row-sub', text: subtitle })),
    value != null && h('span', { class: `row-value ${valueClass}`, text: value }),
    chevron && h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'),
  );
}
