// Personal loans (السلف): money I lent to people and money I borrowed, with
// partial repayments, due dates and a polite reminder message to share.
// Names are stored only on this device, inside the encrypted data.

import { h, card, openSheet, field, segmented, select, numberInput, readNumber, toast, confirmDialog, emptyState, listRow, progress } from '../ui.js';
import { t, money, fmtDate } from '../i18n.js';
import { update } from '../store.js';
import { uid } from '../model.js';
import { loanRemaining, loanRepaid, loanTotals, dueLoans, openLoansWith, convert } from '../finance.js';
import { S, today, fmtBase, currencyOptions, sectionTitle } from './common.js';
import { go } from './shell.js';

const dueText = (d) => (d.overdue ? t('loans.overdueBy', { n: -d.daysLeft }) : d.daysLeft === 0 ? t('loans.dueToday') : t('loans.dueIn', { n: d.daysLeft }));

function loanRow(loan) {
  const rem = loanRemaining(loan);
  const lent = loan.direction === 'lent';
  const sub = [t(lent ? 'loans.theyOwe' : 'loans.iOweThem'), loan.dueDate && rem > 0 ? `${t('loans.due')} ${fmtDate(loan.dueDate)}` : null, loan.settledAt ? t('loans.settled') : null].filter(Boolean).join(' · ');
  return listRow({
    icon: lent ? '↗' : '↙',
    title: loan.person,
    subtitle: sub,
    value: money(rem > 0 ? rem : loan.amount, loan.currency),
    valueClass: rem === 0 ? 'muted' : lent ? 'pos' : 'neg',
    onClick: () => go('loan', { id: loan.id }),
    chevron: true,
  });
}

export function loansView() {
  const st = S();
  const totals = loanTotals(st);
  const due = dueLoans(st);
  const open = st.loans.filter((l) => loanRemaining(l) > 0).sort((a, b) => ((a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1));
  const closed = st.loans.filter((l) => loanRemaining(l) === 0).sort((a, b) => (a.date < b.date ? 1 : -1));
  const people = totals.people.filter((p) => p.open > 0);

  return {
    title: t('loans.title'),
    body: [
      h('section', { class: 'card hero' },
        h('div', { class: 'tiles' },
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('loans.owedToMe') }), h('span', { class: 'tile-value pos', text: fmtBase(totals.owedToMe, { decimals: 0 }) })),
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('loans.iOwe') }), h('span', { class: 'tile-value neg', text: fmtBase(totals.iOwe, { decimals: 0 }) }))),
        h('p', { class: 'muted small', text: t('loans.intro') })),
      due.map((d) => h('button', { class: `banner ${d.overdue ? 'danger' : 'warn'}`, type: 'button', onclick: () => go('loan', { id: d.loan.id }) },
        h('strong', { text: `${d.loan.person} — ${dueText(d)}` }),
        h('span', { text: `${t(d.loan.direction === 'lent' ? 'loans.theyOwe' : 'loans.iOweThem')}: ${money(loanRemaining(d.loan), d.loan.currency)}` }))),
      people.length > 0 && card(sectionTitle(t('loans.byPerson')),
        h('div', { class: 'list' }, people.map((p) => listRow({
          icon: '👤',
          title: p.person,
          subtitle: t('loans.openCount', { n: p.open }),
          value: Math.abs(p.net) < 0.005 ? t('loans.even') : `${p.net > 0 ? t('loans.owesYou') : t('loans.youOwe')} ${fmtBase(Math.abs(p.net), { decimals: 0 })}`,
          valueClass: p.net > 0 ? 'pos' : p.net < 0 ? 'neg' : 'muted',
        })))),
      card(sectionTitle(t('loans.open')), open.length ? h('div', { class: 'list' }, open.map(loanRow)) : emptyState(t('loans.empty'))),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => openLoanEditor() }, t('loans.add')),
      closed.length > 0 && card(sectionTitle(t('loans.closed')), h('div', { class: 'list' }, closed.map(loanRow))),
    ],
  };
}

export function loanView({ id }) {
  const loan = S().loans.find((l) => l.id === id);
  if (!loan) return null;
  const rem = loanRemaining(loan);
  const repaid = loanRepaid(loan);
  const lent = loan.direction === 'lent';
  const reps = [...(loan.repayments ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const due = loan.dueDate && rem > 0 ? dueLoans({ loans: [loan] }, new Date(), 100000)[0] : null;

  return {
    title: loan.person,
    fab: false,
    body: [
      h('section', { class: 'card hero' },
        h('div', { class: 'muted', text: t(lent ? 'loans.theyOwe' : 'loans.iOweThem') }),
        h('div', { class: `hero-value ${rem === 0 ? '' : lent ? 'pos' : 'neg'}`, text: money(rem, loan.currency) }),
        progress(loan.amount > 0 ? Math.min(1, repaid / loan.amount) : 0, rem === 0 ? 'good' : 'ok', t('loans.repaid')),
        h('p', { class: 'muted small', text: t('loans.summary', { amount: money(loan.amount, loan.currency), date: fmtDate(loan.date, { year: true }), repaid: money(repaid, loan.currency) }) }),
        due && h('p', { class: `small ${due.overdue ? 'neg' : 'warn-text'}`, text: `${t('loans.due')} ${fmtDate(loan.dueDate, { year: true })} — ${dueText(due)}` }),
        loan.settledAt && h('p', { class: 'pos small', text: t('loans.settledOn', { date: fmtDate(loan.settledAt, { year: true }) }) }),
        loan.note && h('p', { class: 'pre-line small', text: loan.note })),
      rem > 0 && h('div', { class: 'row gap' },
        h('button', { class: 'btn primary grow', type: 'button', onclick: () => openRepayment(loan) }, t(lent ? 'loans.gotBack' : 'loans.paidBack')),
        h('button', {
          class: 'btn ghost grow', type: 'button',
          onclick: async () => {
            if (!(await confirmDialog({ title: t('loans.settleTitle'), message: t('loans.settleMsg', { amount: money(rem, loan.currency) }), ok: t('loans.markSettled'), cancel: t('common.cancel') }))) return;
            update((s) => (s.loans.find((l) => l.id === loan.id).settledAt = today()));
          },
        }, t('loans.markSettled'))),
      loan.settledAt && h('button', { class: 'btn ghost block', type: 'button', onclick: () => update((s) => (s.loans.find((l) => l.id === loan.id).settledAt = null)) }, t('loans.reopen')),
      lent && rem > 0 && h('button', { class: 'btn ghost block', type: 'button', onclick: () => shareReminder(loan) }, `💬 ${t('loans.shareReminder')}`),
      card(sectionTitle(t('loans.repayments')),
        reps.length
          ? h('div', { class: 'list' }, reps.map((r) => listRow({ title: fmtDate(r.date, { year: true }), subtitle: r.note, value: money(r.amount, loan.currency), onClick: () => openRepayment(loan, null, r) })))
          : h('p', { class: 'muted', text: t('loans.noRepayments') })),
      h('button', { class: 'btn ghost block', type: 'button', onclick: () => openLoanEditor(loan) }, t('loans.edit')),
    ],
  };
}

// ---------------------------------------------------------------- editors
export function openLoanEditor(loan, prefill = {}) {
  const st = S();
  const d = loan
    ? { ...loan }
    : { id: uid(), person: prefill.person ?? '', direction: prefill.direction ?? 'lent', amount: prefill.amount ?? '', currency: prefill.currency ?? st.settings.defaultCurrency, date: prefill.date ?? today(), dueDate: null, note: '', repayments: [], settledAt: null };
  const listId = `people-${uid()}`;
  const names = [...new Set(st.loans.map((l) => l.person))];
  const person = h('input', { type: 'text', value: d.person, maxlength: 40, list: listId, autocomplete: 'off', placeholder: t('loans.personPh') });
  const amount = numberInput(d.amount === '' ? '' : String(d.amount), { class: 'amount-input', placeholder: '0' });
  const ccy = select(currencyOptions(d.currency), d.currency, (v) => (d.currency = v));
  const date = h('input', { type: 'date', value: d.date, max: today() });
  const dueDate = h('input', { type: 'date', value: d.dueDate ?? '' });
  const note = h('input', { type: 'text', value: d.note ?? '', maxlength: 120 });
  const sheet = openSheet({
    title: loan ? t('loans.edit') : t('loans.add'),
    body: [
      prefill.fromText && h('div', { class: 'notice' }, t('quick.check')),
      segmented([{ value: 'lent', label: t('loans.iLent') }, { value: 'borrowed', label: t('loans.iBorrowed') }], d.direction, (v) => (d.direction = v)),
      field(t('loans.person'), person, t('loans.personHint')),
      h('datalist', { id: listId }, names.map((n) => h('option', { value: n }))),
      h('div', { class: 'amount-row' }, amount, ccy),
      h('div', { class: 'row gap' }, field(t('entry.date'), date), field(t('loans.dueDate'), dueDate)),
      field(t('entry.note'), note),
      h('div', { class: 'sheet-footer' },
        loan && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: async () => {
            if (!(await confirmDialog({ title: t('loans.deleteTitle'), message: t('loans.deleteMsg', { name: loan.person }), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
            update((s) => (s.loans = s.loans.filter((l) => l.id !== loan.id)), { render: false });
            sheet.close();
            go('loans');
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            d.person = person.value.trim().slice(0, 40);
            d.amount = readNumber(amount.value);
            if (!d.person) return toast(t('loans.needPerson'), { kind: 'warn' });
            if (!(d.amount > 0)) return toast(t('entry.needAmount'), { kind: 'warn' });
            d.date = date.value || today();
            d.dueDate = dueDate.value || null;
            d.note = note.value.trim() || null;
            update((s) => {
              const i = s.loans.findIndex((l) => l.id === d.id);
              if (i >= 0) s.loans[i] = d;
              else s.loans.push(d);
            }, { render: !!loan });
            sheet.close();
            if (!loan) go('loan', { id: d.id });
            toast(t('loans.saved'), { kind: 'ok' });
          },
        }, t('common.save'))),
    ],
  });
  if (!loan && !d.person) person.focus();
}

/**
 * Record a repayment on a loan.
 * @param candidates  other open loans with the same person (to choose from)
 */
export function openRepayment(loan, prefill = null, existing = null, candidates = null) {
  let target = loan;
  const st = S();
  const startAmount = existing?.amount ?? (prefill?.amount != null
    ? Math.round(convert(prefill.amount, prefill.currency ?? loan.currency, loan.currency, st.rates) * 100) / 100
    : loanRemaining(loan));
  const amount = numberInput(String(startAmount), { class: 'amount-input' });
  const ccyTag = h('span', { class: 'ccy-tag', text: loan.currency });
  const date = h('input', { type: 'date', value: existing?.date ?? prefill?.date ?? today(), max: today() });
  const note = h('input', { type: 'text', value: existing?.note ?? '', maxlength: 120 });
  const chooser = candidates && candidates.length > 1 && field(t('loans.whichLoan'), select(
    candidates.map((l) => ({ value: l.id, label: `${fmtDate(l.date, { year: true })} · ${money(loanRemaining(l), l.currency)}` })),
    loan.id,
    (v) => {
      target = candidates.find((l) => l.id === v);
      ccyTag.textContent = target.currency;
    },
  ));
  const converted = prefill?.currency && prefill.currency !== loan.currency && !prefill.currencyGuessed;
  const sheet = openSheet({
    title: existing ? t('loans.editRepayment') : t(loan.direction === 'lent' ? 'loans.gotBack' : 'loans.paidBack'),
    body: [
      prefill && h('div', { class: 'notice' }, t('loans.repayFor', { name: loan.person }), converted ? ` ${t('loans.converted', { from: money(prefill.amount, prefill.currency) })}` : ''),
      chooser,
      h('div', { class: 'amount-row' }, amount, ccyTag),
      h('div', { class: 'row gap' }, field(t('entry.date'), date), field(t('entry.note'), note)),
      h('div', { class: 'sheet-footer' },
        existing && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: () => {
            update((s) => {
              const l = s.loans.find((x) => x.id === loan.id);
              l.repayments = l.repayments.filter((r) => r.id !== existing.id);
              if (loanRemaining({ ...l, settledAt: null }) > 0) l.settledAt = null;
            });
            sheet.close();
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const v = readNumber(amount.value);
            if (!(v > 0)) return toast(t('entry.needAmount'), { kind: 'warn' });
            const rec = { id: existing?.id ?? uid(), amount: v, date: date.value || today(), note: note.value.trim() || null };
            let settled = false;
            update((s) => {
              const l = s.loans.find((x) => x.id === target.id);
              l.repayments ??= [];
              const i = l.repayments.findIndex((r) => r.id === rec.id);
              if (i >= 0) l.repayments[i] = rec;
              else l.repayments.push(rec);
              if (loanRemaining({ ...l, settledAt: null }) <= 0.004 && !l.settledAt) {
                l.settledAt = rec.date;
                settled = true;
              }
            }, { render: false });
            sheet.close();
            go('loan', { id: target.id });
            toast(settled ? t('loans.nowSettled') : t('loans.repaymentSaved'), { kind: 'ok' });
          },
        }, t('common.save'))),
    ],
  });
}

// From quick text / Siri: "سلفت أحمد 500", "محمد رجّعلي 200", ...
export function handleLoanResult(r) {
  const st = S();
  if (r.action === 'lend' || r.action === 'borrow') {
    openLoanEditor(null, { person: r.person, direction: r.action === 'lend' ? 'lent' : 'borrowed', amount: r.amount, currency: r.currency ?? st.settings.defaultCurrency, date: r.date, fromText: true });
    return;
  }
  const direction = r.action === 'repayIn' ? 'lent' : 'borrowed';
  const open = openLoansWith(st, r.person, direction);
  if (!open.length) {
    toast(t('loans.noOpenWith', { name: r.person }), { kind: 'warn', ms: 6000 });
    openLoanEditor(null, { person: r.person, direction, amount: r.amount, currency: r.currency ?? st.settings.defaultCurrency, date: r.date, fromText: true });
    return;
  }
  openRepayment(open[0], { amount: r.amount, currency: r.currencyGuessed ? open[0].currency : r.currency, currencyGuessed: r.currencyGuessed, date: r.date }, null, open);
}

// ---------------------------------------------------------------- reminder
// Opens the share sheet with a polite message; the app itself never sends anything.
async function shareReminder(loan) {
  const text = t('loans.reminderText', { name: loan.person, amount: money(loanRemaining(loan), loan.currency).replace(/[⁦-⁩]/g, ''), date: fmtDate(loan.date, { year: true }) });
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(t('loans.reminderCopied'), { kind: 'ok' });
  } catch {
    toast(text, { ms: 10000 });
  }
}
