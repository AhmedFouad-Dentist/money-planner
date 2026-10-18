// App frame (top bar, content, tab bar, add button) and the router.

import { h, clear } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { store, setRenderer } from '../store.js';
import { homeView } from './home.js';
import { txView } from './transactions.js';
import { goalsView } from './goals.js';
import { investView, holdingView } from './invest.js';
import { moreView, budgetsView, recurringView, netWorthView, categoriesView, ratesView, backupView, settingsView, aboutView } from './more.js';
import { reportView } from './report.js';
import { openEntry } from './entry.js';

const TABS = [
  { id: 'home', icon: 'home' },
  { id: 'tx', icon: 'list' },
  { id: 'goals', icon: 'target' },
  { id: 'invest', icon: 'trend' },
  { id: 'more', icon: 'more' },
];

const ROUTES = {
  home: { view: homeView },
  tx: { view: txView },
  goals: { view: goalsView },
  invest: { view: investView },
  more: { view: moreView },
  holding: { view: holdingView, parent: 'invest' },
  report: { view: reportView, parent: 'more' },
  budgets: { view: budgetsView, parent: 'more' },
  recurring: { view: recurringView, parent: 'more' },
  networth: { view: netWorthView, parent: 'more' },
  categories: { view: categoriesView, parent: 'more' },
  rates: { view: ratesView, parent: 'more' },
  backup: { view: backupView, parent: 'more' },
  settings: { view: settingsView, parent: 'more' },
  about: { view: aboutView, parent: 'more' },
};

const nav = { route: 'home', params: {}, from: null };
let frame = null;
let onLock = () => {};

export function go(route, params = {}) {
  if (!ROUTES[route]) route = 'home';
  const same = nav.route === route && JSON.stringify(nav.params) === JSON.stringify(params);
  // remember which main screen a sub-screen was opened from, for "back"
  if (!ROUTES[route].parent) nav.from = null;
  else if (!ROUTES[nav.route].parent) nav.from = nav.route;
  nav.route = route;
  nav.params = params;
  render();
  if (!same) window.scrollTo(0, 0);
}

export function mountShell({ lock }) {
  onLock = lock;
  const app = document.getElementById('app');
  frame = {
    title: h('h1', { class: 'topbar-title' }),
    back: h('button', { class: 'icon-btn back-btn', type: 'button', 'aria-label': t('common.back'), onclick: () => go(nav.from ?? ROUTES[nav.route].parent) }, icon('back')),
    actions: h('div', { class: 'topbar-actions' }),
    main: h('main', { id: 'main', class: 'main', tabindex: -1 }),
    tabs: h('nav', { class: 'tabbar', 'aria-label': t('common.sections') }),
    fab: h('button', { class: 'fab', type: 'button', 'aria-label': t('entry.add'), onclick: () => openEntry({}) }, icon('plus', { size: 28 })),
  };
  clear(app,
    h('header', { class: 'topbar' }, frame.back, frame.title, frame.actions),
    frame.main,
    frame.fab,
    frame.tabs,
  );
  app.className = 'shell';
  setRenderer(render);
  nav.route = 'home';
  nav.params = {};
  nav.from = null;
  render();
}

export function render() {
  if (!frame || !store.state) return;
  const route = ROUTES[nav.route] ?? ROUTES.home;
  let v;
  try {
    v = route.view(nav.params);
  } catch (e) {
    console.error(e);
    nav.route = 'home';
    v = homeView();
  }
  if (!v) return go(route.parent ?? 'home');
  frame.title.textContent = v.title;
  frame.back.hidden = !route.parent;
  clear(frame.actions, v.actions ?? [],
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('lock.lockNow'), onclick: () => onLock() }, icon('lock', { size: 22 })));
  clear(frame.main, v.body);
  frame.fab.hidden = v.fab === false;
  const tab = route.parent ? nav.from ?? route.parent : nav.route;
  clear(frame.tabs, TABS.map((tb) =>
    h('button', { type: 'button', class: `tab${tb.id === tab ? ' on' : ''}`, 'aria-current': tb.id === tab ? 'page' : null, onclick: () => go(tb.id) },
      icon(tb.icon, { size: 24 }), h('span', { text: t(`tab.${tb.id}`) }))));
}

export function unmountShell() {
  frame = null;
  setRenderer(() => {});
}
