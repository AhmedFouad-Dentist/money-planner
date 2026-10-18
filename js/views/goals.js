import { h, card, progress, openSheet, field, segmented, select, numberInput, readNumber, toast, confirmDialog, emptyState } from '../ui.js';
import { t, money, pct, fmtDate, nameOf } from '../i18n.js';
import { update } from '../store.js';
import { newGoal } from '../model.js';
import { goalBreakdown, goalPlan, goalMonthlyRate, goalSources } from '../finance.js';
import { S, today } from './common.js';

export function goalsView() {
  const st = S();
  const cards = st.goals.map((g) => goalCard(g, st));
  return {
    title: t('tab.goals'),
    body: [
      cards.length ? cards : emptyState(t('goals.empty')),
      h('button', { class: `btn ${cards.length ? 'ghost' : 'primary'} block`, type: 'button', onclick: () => openGoalEditor() }, t('goals.add')),
      h('p', { class: 'muted small disclaimer', text: t('about.disclaimerShort') }),
    ],
  };
}

const stat = (label, value, cls = '') => h('div', { class: 'row between stat-row' }, h('span', { class: 'muted', text: label }), h('strong', { class: cls, text: value }));

function goalCard(g, st) {
  const parts = goalBreakdown(g, st);
  const current = parts.total;
  const rate = goalMonthlyRate(g, st);
  const plan = goalPlan(g, current, rate.avg);
  const src = goalSources(g, st);
  const fmt = (v) => money(v, g.currency, { decimals: 0 });
  const rows = [];

  if (!src.accounts.length && !src.holdings.length && !parts.receivables) {
    rows.push(h('p', { class: 'small warn-text', text: t(`goals.noSources.${g.funding}`) }));
  }
  if (g.targetDate && !plan.reached) {
    rows.push(stat(t('goals.targetDate'), fmtDate(g.targetDate, { year: true })));
    rows.push(stat(plan.overdue ? t('goals.overdue') : t('goals.requiredMonthly'), fmt(plan.requiredMonthly), plan.overdue ? 'neg' : ''));
    if (rate.avg != null && plan.requiredMonthly > 0) {
      const ok = rate.avg >= plan.requiredMonthly;
      rows.push(h('p', { class: `small ${ok ? 'pos' : 'warn-text'}`, text: ok ? t('goals.onTrack') : t('goals.behind', { gap: fmt(plan.requiredMonthly - rate.avg) }) }));
    }
  }
  if (!plan.reached) {
    rows.push(stat(t(`goals.rate.${rate.basis ?? 'none'}`), rate.avg == null ? '—' : fmt(rate.avg), rate.avg < 0 ? 'neg' : ''));
    rows.push(stat(t('goals.projected'), plan.projectedDate ? fmtDate(plan.projectedDate, { year: true }) : t('goals.projectedNone')));
    if (rate.avg != null) rows.push(h('p', { class: 'muted small', text: rate.partial ? t('goals.avgPartial') : t('goals.avgBasis', { n: rate.months }) }));
  }

  return h('section', { class: 'card goal-card' },
    h('div', { class: 'row between' },
      h('h2', { class: 'goal-name', text: g.name }),
      h('button', { class: 'link-btn', type: 'button', onclick: () => openGoalEditor(g) }, t('common.edit'))),
    h('div', { class: 'goal-amounts' },
      h('span', { class: 'big', text: fmt(current) }),
      h('span', { class: 'muted', text: ` / ${fmt(plan.target)}` })),
    progress(plan.pct, plan.reached ? 'good' : 'ok', g.name),
    h('div', { class: 'row between small' },
      h('span', { text: pct(plan.pct, 1) }),
      h('span', { class: 'muted', text: plan.reached ? t('goals.reached') : `${t('goals.remaining')} ${fmt(plan.remaining)}` })),
    h('p', { class: 'muted small', text: t(`goals.funding.${g.funding}`) }),
    (parts.receivables > 0 || parts.payables > 0 || (g.excludeReceivables && st.loans.length > 0)) && h('div', { class: 'goal-parts small' },
      stat(t(`goals.part.${g.funding}`), fmt(parts.sources)),
      g.excludeReceivables
        ? h('p', { class: 'muted small', text: t('goals.receivablesExcluded') })
        : parts.receivables > 0 && stat(t('goals.part.receivables'), `+${fmt(parts.receivables)}`, 'pos'),
      parts.payables > 0 && stat(t('goals.part.payables'), `−${fmt(parts.payables)}`, 'neg')),
    rows,
  );
}

// All currencies the user can pick for a goal: enabled ones plus any with a rate.
export function goalCurrencyOptions(st, selected) {
  return [...new Set([...st.settings.currencies, ...Object.keys(st.rates), selected].filter(Boolean))].map((c) => ({ value: c, label: c }));
}

/**
 * Goal form, used by the goal editor and by onboarding.
 * @returns { el, read } — read() returns the goal or null (after a warning)
 */
export function goalForm(goal, { currencyOptions, defaultCurrency, accounts = [], holdings = [], typeName = () => '' }) {
  const d = newGoal(goal ?? { currency: defaultCurrency });
  const name = h('input', { type: 'text', value: d.name, maxlength: 40, placeholder: t('goals.namePh') });
  const target = numberInput(d.target ? String(d.target) : '', { placeholder: '0' });
  const ccy = select(currencyOptions, d.currency, (v) => (d.currency = v));
  const date = h('input', { type: 'date', value: d.targetDate ?? '', min: today() });

  // which accounts / holdings count: "all" (also future ones) or a selection
  const picker = (kind, items, label) => {
    const all = h('input', { type: 'checkbox', checked: !Array.isArray(d[kind]) });
    const boxes = items.map((it) => ({ id: it.id, cb: h('input', { type: 'checkbox', checked: Array.isArray(d[kind]) ? d[kind].includes(it.id) : true }), label: it.label }));
    const list = h('div', { class: 'checklist indent', hidden: all.checked }, boxes.map((b) => h('label', { class: 'check-row' }, b.cb, h('span', { text: b.label }))));
    all.addEventListener('change', () => (list.hidden = all.checked));
    const wrap = h('div', { class: 'source-picker' },
      h('span', { class: 'field-label', text: label }),
      h('label', { class: 'check-row' }, all, h('span', { text: t(`goals.all.${kind}`) })),
      items.length ? list : null);
    return { wrap, read: () => (all.checked ? 'all' : boxes.filter((b) => b.cb.checked).map((b) => b.id)) };
  };
  const accPicker = picker('accounts', accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.currency})` })), t('goals.countAccounts'));
  const holPicker = picker('holdings', holdings.map((x) => ({ id: x.id, label: `${x.name} · ${typeName(x)}` })), t('goals.countHoldings'));
  const showPickers = () => {
    accPicker.wrap.hidden = d.funding === 'investments';
    holPicker.wrap.hidden = d.funding === 'savings';
  };
  showPickers();
  const countReceivables = h('input', { type: 'checkbox', checked: !d.excludeReceivables });

  const el = h('div', { class: 'stack' },
    field(t('goals.name'), name),
    h('div', { class: 'row gap' }, field(t('goals.target'), target), field(t('entry.currency'), ccy)),
    field(t('goals.targetDate'), date, t('goals.targetDateHint')),
    h('span', { class: 'field-label', text: t('goals.fundedBy') }),
    segmented(['savings', 'investments', 'both'].map((m) => ({ value: m, label: t(`goals.fundingShort.${m}`) })), d.funding, (v) => { d.funding = v; showPickers(); }),
    h('p', { class: 'muted small', text: t('goals.fundingHint') }),
    accPicker.wrap,
    holPicker.wrap,
    h('label', { class: 'check-row' }, countReceivables, h('span', { text: t('goals.countReceivables') })),
    h('p', { class: 'muted small', text: t('goals.loansHint') }),
  );

  const read = () => {
    const amount = readNumber(target.value);
    if (!name.value.trim()) {
      toast(t('goals.needName'), { kind: 'warn' });
      name.focus();
      return null;
    }
    if (!(amount > 0)) {
      toast(t('goals.needTarget'), { kind: 'warn' });
      target.focus();
      return null;
    }
    return newGoal({ ...d, name: name.value.trim(), target: amount, targetDate: date.value || null, accounts: accPicker.read(), holdings: holPicker.read(), excludeReceivables: !countReceivables.checked });
  };
  return { el, read, focus: () => name.focus() };
}

export function openGoalEditor(goal) {
  const st = S();
  const form = goalForm(goal, {
    currencyOptions: goalCurrencyOptions(st, goal?.currency),
    defaultCurrency: st.settings.reportCurrency,
    accounts: st.accounts,
    holdings: st.holdings,
    typeName: (x) => nameOf(st.invTypes.find((tp) => tp.id === x.typeId)),
  });
  const sheet = openSheet({
    title: goal ? t('goals.edit') : t('goals.add'),
    body: [
      form.el,
      h('div', { class: 'sheet-footer' },
        goal && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: async () => {
            if (!(await confirmDialog({ title: t('goals.deleteTitle'), message: t('goals.deleteMsg', { name: goal.name }), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
            update((s) => (s.goals = s.goals.filter((x) => x.id !== goal.id)));
            sheet.close();
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const g = form.read();
            if (!g) return;
            update((s) => {
              const i = s.goals.findIndex((x) => x.id === g.id);
              if (i >= 0) s.goals[i] = g;
              else s.goals.push(g);
            });
            sheet.close();
          },
        }, t('common.save')),
      ),
    ],
  });
  if (!goal) form.focus();
}
