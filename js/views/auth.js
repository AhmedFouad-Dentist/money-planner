// Lock screen, one-screen setup, and the "opened in Safari" bridge.

import { h, clear, toast, field, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';
import { t, setLang, getLang, money, fmtDate } from '../i18n.js';
import * as vault from '../vault.js';
import { createInitialState, KNOWN_CURRENCIES, APPROX_PER_USD, guessMainCurrency } from '../model.js';
import { formatBridgeLine } from '../sms/parser.js';
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
  const length = vault.pinLengthOf(meta);
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
    length,
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

// ---------------------------------------------------------------- setup
// One screen: main currency (guessed from the phone) + Start. No PIN by
// default — it can be turned on later in Settings.
// Goals, other currencies, Siri etc. are offered later on the Home screen.
export function renderOnboarding(onDone) {
  let restored = null;
  let currency = guessMainCurrency();

  function draw() {
    const options = [...new Set([currency, ...KNOWN_CURRENCIES, ...Object.keys(APPROX_PER_USD)])];
    const ccy = h('select', { class: 'big-select', 'aria-label': t('setup.currency'), onchange: () => (currency = ccy.value) },
      options.map((c) => h('option', { value: c, selected: c === currency }, ccyLabel(c))));
    const start = h('button', { class: 'btn primary block huge', type: 'button' }, t('setup.start'));
    start.addEventListener('click', async () => {
      start.disabled = true;
      start.textContent = t('onb.creating');
      const state = restored ?? createInitialState({
        lang: getLang(),
        currencies: [...new Set([currency, ...KNOWN_CURRENCIES])],
        reportCurrency: currency,
        defaultCurrency: currency,
      });
      if (restored) setLang(state.settings.lang);
      state.settings.lang = getLang();
      // no PIN: the data is still encrypted on the phone; a PIN can be added in Settings
      await vault.createVault(null, state, { lang: getLang(), theme: state.settings.theme ?? 'system' });
      onDone(state);
    });

    screen(
      langToggle(() => draw()),
      h('div', { class: 'welcome' }, logo(), h('h1', { text: t('app.name') }), h('p', { class: 'lead', text: t('setup.tagline') })),
      restored
        ? h('p', { class: 'pos center', text: t('onb.restoredReady', { tx: restored.transactions.length }) })
        : field(t('setup.currency'), ccy),
      start,
      !restored && h('button', {
        class: 'link-btn center-block', type: 'button',
        onclick: () => pickBackupFile((st) => {
          restored = st;
          draw();
        }),
      }, t('onb.restore')),
      h('p', { class: 'muted small center', text: t('setup.privacy') }),
    );
    if (!restored) ccy.blur();
  }
  draw();
}

// ---------------------------------------------------------------- Safari bridge
// The Shortcut opened the app in Safari, which (on iPhone) has separate storage
// from the Home Screen app. Show what was understood and let the user copy it
// to paste into the installed app ("Add from copied message").
export function renderBridge(pending, { onSetupHere }) {
  const { kind, result } = pending;
  const row = (label, value) => h('div', { class: 'row between' }, h('span', { class: 'muted', text: label }), h('span', { text: value }));
  let summary = null;
  let copyText = null;
  if (result.ok && result.kind === 'loan') {
    summary = [row(t('loans.person'), result.person), row(t('entry.amount'), money(result.amount, result.currency ?? 'XXX')), row(t('common.type'), t(`quick.loan.${result.action}`))];
    copyText = pending.text;
  } else if (result.ok) {
    summary = [
      row(t('entry.amount'), money(result.amount, result.currency ?? 'XXX')),
      row(t('entry.merchant'), (kind === 'sms' ? result.merchant : result.item) ?? '—'),
      row(t('entry.date'), fmtDate(result.date, { year: true })),
      row(t('common.type'), t(`entry.${result.type}`)),
    ];
    // bank messages are never copied as is — only the cleaned fields
    copyText = kind === 'sms' ? formatBridgeLine(result) : pending.text;
  }
  screen(
    langToggle(() => renderBridge(pending, { onSetupHere })),
    h('div', { class: 'welcome' }, logo(), h('h1', { text: t(kind === 'sms' ? 'bridge.title' : 'bridge.titleSay') })),
    summary
      ? [
        h('div', { class: 'card' }, summary),
        h('p', { class: 'muted', text: t('bridge.explain') }),
        h('button', {
          class: 'btn primary block', type: 'button',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(copyText);
              toast(t('bridge.copied'), { kind: 'ok', ms: 6000 });
            } catch {
              toast(t('sms.pasteFailed'), { kind: 'warn' });
            }
          },
        }, t('bridge.copy')),
      ]
      : h('div', { class: `notice ${result.reason === 'otp' ? 'danger' : ''}` }, h('p', { text: result.reason === 'otp' ? t('sms.otpBody') : t(kind === 'sms' ? 'sms.noAmount' : 'quick.noAmount') })),
    h('p', { class: 'muted small', text: t('bridge.discarded') }),
    h('button', { class: 'btn ghost block', type: 'button', onclick: onSetupHere }, t('bridge.setupHere')),
  );
}
