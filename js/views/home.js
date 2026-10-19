// Home: one input, this month's spending, the goal bar and the last 5 entries.
// Everything else lives under "More".

import { h, progress, swipeToDelete, toast } from '../ui.js';
import { t, money, pct } from '../i18n.js';
import { goalCurrent, goalPlan, monthSummary, monthKey, fromBase } from '../finance.js';
import { update } from '../store.js';
import { S, txRow } from './common.js';
import { go } from './shell.js';
import { openEntry } from './entry.js';
import { quickBox } from './quick.js';
import { openGoalEditor } from './goals.js';

export function deleteTx(tx) {
  update((s) => (s.transactions = s.transactions.filter((x) => x.id !== tx.id)));
  toast(t('home.deleted'), { actions: [{ label: t('common.undo'), run: () => update((s) => { s.transactions.push(tx); s.transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); }) }], ms: 6000 });
}

export function entryRow(tx) {
  return swipeToDelete(txRow(tx, () => openEntry({ tx })), () => deleteTx(tx), t('home.swipeHint'));
}

function optionalCard(id, title, text, action, onAction) {
  return h('section', { class: 'card offer' },
    h('div', { class: 'offer-main' }, h('strong', { text: title }), h('span', { class: 'muted small', text })),
    h('div', { class: 'offer-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: onAction }, action),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('home.dismiss'), onclick: () => update((s) => (s.settings.dismissed = { ...s.settings.dismissed, [id]: true })) }, '✕')));
}

export function homeView() {
  const st = S();
  const rc = st.settings.reportCurrency;
  const month = monthSummary(st.transactions, st.rates, monthKey(new Date()));
  const goal = st.goals[0];
  const dismissed = st.settings.dismissed ?? {};

  const spent = h('button', { class: 'spent', type: 'button', onclick: () => go('report') },
    h('span', { class: 'spent-label', text: t('home.spentMonth') }),
    h('span', { class: 'spent-value', text: money(fromBase(month.expense, rc, st.rates), rc, { decimals: 0 }) }));

  let goalBar = null;
  if (goal) {
    const current = goalCurrent(goal, st);
    const plan = goalPlan(goal, current, null);
    goalBar = h('button', { class: 'goal-bar', type: 'button', onclick: () => go('goals') },
      h('div', { class: 'row between' }, h('strong', { text: goal.name }), h('span', { class: 'muted', text: pct(plan.pct) })),
      progress(plan.pct, plan.reached ? 'good' : 'ok', goal.name),
      h('span', { class: 'muted small', text: plan.reached ? t('goals.reached') : t('home.goalLeft', { left: money(plan.remaining, goal.currency, { decimals: 0 }) }) }));
  }

  const recent = [...st.transactions].reverse().slice(0, 5);
  const list = recent.length
    ? h('section', { class: 'card recent' },
      h('div', { class: 'section-title' }, h('h2', { text: t('home.recent') }), st.transactions.length > 5 && h('button', { class: 'link-btn', type: 'button', onclick: () => go('tx') }, t('home.seeAll'))),
      h('div', { class: 'list' }, recent.map(entryRow)))
    : h('p', { class: 'muted center first-hint', text: t('home.firstHint') });

  const offers = [];
  if (!goal && !dismissed.goal) offers.push(optionalCard('goal', t('home.offerGoal'), t('home.offerGoalText'), t('home.offerGoalBtn'), () => openGoalEditor()));
  else if (!dismissed.siri && st.transactions.length >= 3) offers.push(optionalCard('siri', t('home.offerSiri'), t('home.offerSiriText'), t('home.offerSiriBtn'), () => go('connect')));

  return { title: t('app.name'), body: [quickBox(), spent, goalBar, list, offers] };
}
