// Lock screen, first-run onboarding, and the "opened in Safari" SMS bridge.

import { h, clear, toast, field, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';
import { t, setLang, getLang, money, fmtDate } from '../i18n.js';
import * as vault from '../vault.js';
import { createInitialState, KNOWN_CURRENCIES } from '../model.js';
import { formatBridgeLine } from '../sms/parser.js';
import { goalForm } from './goals.js';
import { pickBackupFile } from './more.js';

const app = () => document.getElementById('app');

function screen(...children) {
  const el = app();
  el.className = 'fullscreen';
  clear(el, h('div', { class: 'screen' }, ...children));
  window.scrollTo(0, 0);
}

const ccyLabel = (c) => {
  const name = t(`ccy.${c}`);
  return name === `ccy.${c}` ? c : `${c} · ${name}`;
};

const logo = () => h('img', { class: 'logo', src: 'icons/icon-192.png', alt: '', width: 72, height: 72 });

function langToggle(onChange) {
  return h('div', { class: 'lang-toggle' },
    ['ar', 'en'].map((l) => h('button', {
      type: 'button', class: `chip${getLang() === l ? ' on' : ''}`, lang: l,
      onclick: () => { setLang(l); onChange(l); },
    }, l === 'ar' ? 'العربية' : 'English')));
}

// ---------------------------------------------------------------- PIN pad
function pinPad({ onComplete, length = vault.PIN_LENGTH }) {
  let pin = '';
  let busy = false;
  const dots = h('div', { class: 'pin-dots', 'aria-hidden': 'true' });
  const live = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  const drawDots = () => {
    dots.replaceChildren(...Array.from({ length }, (_, i) => h('span', { class: `dot${i < pin.length ? ' on' : ''}` })));
    live.textContent = `${pin.length} / ${length}`;
  };
  const press = async (k) => {
    if (busy) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < length) pin += k;
    drawDots();
    if (pin.length === length) {
      busy = true;
      const value = pin;
      pin = '';
      try {
        await onComplete(value);
      } finally {
        busy = false;
        drawDots();
      }
    }
  };
  const key = (k, label) => h('button', { type: 'button', class: `key${k === 'del' ? ' key-del' : ''}`, 'aria-label': k === 'del' ? t('lock.delete') : k, onclick: () => press(k) }, label ?? k);
  const pad = h('div', { class: 'keypad', dir: 'ltr' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => key(k)), h('span'), key('0'), key('del', icon('backspace', { size: 26 })));
  const onKey = (e) => {
    if (!document.contains(pad)) return document.removeEventListener('keydown', onKey);
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);
  drawDots();
  return {
    el: h('div', { class: 'pin-pad' }, dots, live, pad),
    shake: () => {
      dots.classList.remove('shake');
      void dots.offsetWidth;
      dots.classList.add('shake');
    },
  };
}

// ---------------------------------------------------------------- lock
export async function renderLock(onUnlocked) {
  const meta = await vault.getMeta();
  const msg = h('p', { class: 'lock-msg', role: 'status' });
  let timer = null;
  const showWait = () => {
    clearInterval(timer);
    const tick = async () => {
      const wait = vault.waitSeconds(await vault.getMeta());
      msg.textContent = wait > 0 ? t('lock.wait', { s: wait }) : '';
      if (wait <= 0) clearInterval(timer);
    };
    tick();
    timer = setInterval(tick, 1000);
  };
  const pad = pinPad({
    onComplete: async (pin) => {
      const m = await vault.getMeta();
      if (vault.waitSeconds(m) > 0) return showWait();
      msg.textContent = t('lock.unlocking');
      const state = await vault.unlock(pin);
      if (!state) {
        pad.shake();
        const m2 = await vault.getMeta();
        msg.textContent = t('lock.wrong');
        if (vault.waitSeconds(m2) > 0) showWait();
        return;
      }
      clearInterval(timer);
      onUnlocked(state);
    },
  });
  screen(
    h('div', { class: 'lock-top' }, logo(), h('h1', { text: t('app.name') }), h('p', { class: 'muted', text: t('lock.enterPin') })),
    pad.el,
    msg,
    h('button', { class: 'link-btn', type: 'button', onclick: forgotPin }, t('lock.forgot')),
  );
  if (vault.waitSeconds(meta) > 0) showWait();
}

async function forgotPin() {
  const ok = await confirmDialog({ title: t('lock.forgotTitle'), message: t('lock.forgotMsg'), ok: t('lock.eraseAndStart'), cancel: t('common.cancel'), danger: true });
  if (!ok) return;
  const sure = await confirmDialog({ title: t('settings.erase'), message: t('lock.eraseSure'), ok: t('settings.erase'), cancel: t('common.cancel'), danger: true });
  if (!sure) return;
  await vault.eraseAll();
  location.reload();
}

// ---------------------------------------------------------------- onboarding
export function renderOnboarding(onDone) {
  const draft = { lang: getLang(), currencies: [...KNOWN_CURRENCIES], reportCurrency: null, defaultCurrency: null, goals: [], restored: null };

  const steps = { welcome, currencies, goals, pin };
  const progressDots = (n) => h('div', { class: 'steps', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h('span', { class: i <= n ? 'on' : '' })));

  function welcome() {
    screen(
      langToggle(() => welcome()),
      h('div', { class: 'welcome' }, logo(), h('h1', { text: t('app.name') }), h('p', { class: 'lead', text: t('onb.tagline') })),
      h('ul', { class: 'bullets' }, ['onb.p1', 'onb.p2', 'onb.p3', 'onb.p4'].map((k) => h('li', { text: t(k) }))),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => steps.currencies() }, t('onb.start')),
      h('button', {
        class: 'btn ghost block', type: 'button',
        onclick: () => pickBackupFile((state) => {
          draft.restored = state;
          steps.pin();
        }),
      }, t('onb.restore')),
      h('p', { class: 'muted small center', text: t('about.disclaimerShort') }),
    );
  }

  function currencies() {
    const extra = draft.currencies.filter((c) => !KNOWN_CURRENCIES.includes(c));
    const boxes = [...KNOWN_CURRENCIES, ...extra].map((c) => ({ c, cb: h('input', { type: 'checkbox', checked: draft.currencies.includes(c) }) }));
    const reportSel = h('select', { 'aria-label': t('onb.reportCurrency') });
    const defaultSel = h('select', { 'aria-label': t('onb.spendCurrency') });
    const chosen = () => boxes.filter((b) => b.cb.checked).map((b) => b.c);
    const refill = () => {
      const list = chosen();
      for (const [sel, key] of [[reportSel, 'reportCurrency'], [defaultSel, 'defaultCurrency']]) {
        const keep = list.includes(sel.value) ? sel.value : list.includes(draft[key]) ? draft[key] : list[0];
        sel.replaceChildren(...list.map((c) => h('option', { value: c, selected: c === keep }, c)));
      }
    };
    boxes.forEach((b) => b.cb.addEventListener('change', refill));
    const code = h('input', { type: 'text', maxlength: 3, placeholder: 'EUR', class: 'code-input', autocapitalize: 'characters', 'aria-label': t('rates.code') });
    screen(
      progressDots(1),
      h('h1', { text: t('onb.currenciesTitle') }),
      h('p', { class: 'muted', text: t('onb.currenciesIntro') }),
      h('div', { class: 'checklist grid2' }, boxes.map((b) => h('label', { class: 'check-row' }, b.cb, h('span', { text: ccyLabel(b.c) })))),
      h('div', { class: 'row gap' }, code, h('button', {
        class: 'btn ghost', type: 'button',
        onclick: () => {
          const c = code.value.trim().toUpperCase();
          if (!/^[A-Z]{3}$/.test(c)) return toast(t('rates.badCode'), { kind: 'warn' });
          draft.currencies = [...new Set([...chosen(), c])];
          currencies();
        },
      }, t('onb.addCurrency'))),
      field(t('onb.reportCurrency'), reportSel, t('onb.reportHint')),
      field(t('onb.spendCurrency'), defaultSel, t('onb.spendHint')),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => steps.welcome() }, t('common.back')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const list = chosen();
            if (!list.length) return toast(t('onb.needCurrency'), { kind: 'warn' });
            draft.currencies = list;
            draft.reportCurrency = reportSel.value;
            draft.defaultCurrency = defaultSel.value;
            steps.goals();
          },
        }, t('common.next'))),
    );
    refill();
  }

  function goals() {
    const form = goalForm(null, {
      currencyOptions: draft.currencies.map((c) => ({ value: c, label: c })),
      defaultCurrency: draft.reportCurrency,
    });
    const added = draft.goals.length
      ? h('div', { class: 'card' }, h('p', { class: 'muted small', text: t('onb.goalsAdded') }),
        draft.goals.map((g) => h('div', { class: 'row between' },
          h('span', { text: `🎯 ${g.name}` }),
          h('span', { class: 'muted', text: `${money(g.target, g.currency, { decimals: 0 })}${g.targetDate ? ` · ${fmtDate(g.targetDate, { year: true })}` : ''}` }))))
      : null;
    screen(
      progressDots(2),
      h('h1', { text: t('onb.goalsTitle') }),
      h('p', { class: 'muted', text: t('onb.goalsIntro') }),
      added,
      h('div', { class: 'card' }, form.el,
        h('button', {
          class: 'btn ghost block', type: 'button',
          onclick: () => {
            const g = form.read();
            if (!g) return;
            draft.goals.push(g);
            goals();
          },
        }, t('onb.addAnother'))),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => steps.currencies() }, t('common.back')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const g = form.read();
            if (!g) return;
            draft.goals.push(g);
            steps.pin();
          },
        }, t('onb.saveGoal'))),
      h('button', { class: 'link-btn center-block', type: 'button', onclick: () => steps.pin() }, draft.goals.length ? t('onb.continueGoals') : t('onb.skipGoals')),
    );
  }

  function pin() {
    let first = null;
    const title = h('h1', { text: t('onb.pinTitle') });
    const sub = h('p', { class: 'muted', text: t('onb.pinHint', { n: vault.PIN_LENGTH }) });
    const msg = h('p', { class: 'lock-msg', role: 'status' });
    const pad = pinPad({
      onComplete: async (value) => {
        if (!first) {
          first = value;
          title.textContent = t('onb.pinAgain');
          msg.textContent = '';
          return;
        }
        if (value !== first) {
          first = null;
          pad.shake();
          title.textContent = t('onb.pinTitle');
          msg.textContent = t('onb.pinMismatch');
          return;
        }
        msg.textContent = t('onb.creating');
        const state = draft.restored ?? createInitialState({
          lang: getLang(),
          currencies: draft.currencies,
          reportCurrency: draft.reportCurrency,
          defaultCurrency: draft.defaultCurrency,
          goals: draft.goals,
        });
        if (draft.restored) setLang(state.settings.lang);
        state.settings.lang = getLang();
        await vault.createVault(value, state, { lang: getLang(), theme: state.settings.theme ?? 'system' });
        onDone(state);
      },
    });
    screen(
      progressDots(3),
      h('div', { class: 'lock-top' }, title, sub),
      draft.restored && h('p', { class: 'pos small center', text: t('onb.restoredReady', { tx: draft.restored.transactions.length }) }),
      pad.el,
      msg,
      h('p', { class: 'muted small center', text: t('onb.pinWarning') }),
      h('button', { class: 'link-btn center-block', type: 'button', onclick: () => (draft.restored ? steps.welcome() : steps.goals()) }, t('common.back')),
    );
  }

  welcome();
}

// ---------------------------------------------------------------- Safari bridge
// The Shortcut opened the app in Safari, which (on iPhone) has separate storage
// from the Home Screen app. Show the extracted fields and let the user copy a
// cleaned one-line summary to paste into the installed app.
export function renderBridge(result, { onSetupHere }) {
  const line = result.ok ? formatBridgeLine(result) : null;
  screen(
    langToggle(() => renderBridge(result, { onSetupHere })),
    h('div', { class: 'welcome' }, logo(), h('h1', { text: t('bridge.title') })),
    result.ok
      ? [
        h('div', { class: 'card' },
          h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('entry.amount') }), h('strong', { text: money(result.amount, result.currency ?? 'XXX') })),
          h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('entry.merchant') }), h('span', { text: result.merchant ?? '—' })),
          h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('entry.date') }), h('span', { text: fmtDate(result.date, { year: true }) })),
          h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('entry.type') }), h('span', { text: t(`entry.${result.type}`) }))),
        h('p', { class: 'muted', text: t('bridge.explain') }),
        h('button', {
          class: 'btn primary block', type: 'button',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(line);
              toast(t('bridge.copied'), { kind: 'ok', ms: 6000 });
            } catch {
              toast(t('sms.pasteFailed'), { kind: 'warn' });
            }
          },
        }, t('bridge.copy')),
      ]
      : h('div', { class: `notice ${result.reason === 'otp' ? 'danger' : ''}` }, h('p', { text: result.reason === 'otp' ? t('sms.otpBody') : t('sms.noAmount') })),
    h('p', { class: 'muted small', text: t('bridge.discarded') }),
    h('button', { class: 'btn ghost block', type: 'button', onclick: onSetupHere }, t('bridge.setupHere')),
  );
}

