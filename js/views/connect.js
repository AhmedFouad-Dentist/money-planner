// "Add money without typing": Siri shortcut + bank-message automation, with an
// illustrated step-by-step walkthrough. Shown once after the PIN step (skippable)
// and any time from More.

import { h, toast } from '../ui.js';
import { t } from '../i18n.js';
import { SHORTCUT_LINKS } from '../config.js';

// A simplified drawing of an iPhone screen. rows: [label, { hl, value, toggle }]
function phone(title, rows, { footer } = {}) {
  return h('div', { class: 'phone', 'aria-hidden': 'true' },
    h('div', { class: 'phone-notch' }),
    h('div', { class: 'phone-title', text: title }),
    h('div', { class: 'phone-list' }, rows.map(([label, o = {}]) =>
      h('div', { class: `phone-row${o.hl ? ' hl' : ''}` },
        h('span', { text: label }),
        o.value && h('span', { class: 'phone-value', text: o.value }),
        o.toggle && h('span', { class: 'phone-toggle' })))),
    footer && h('div', { class: 'phone-footer', text: footer }));
}

// A small carousel: one step at a time with the mock screen and its text.
function walkthrough(steps) {
  let i = 0;
  const holder = h('div', { class: 'walk-step' });
  const counter = h('span', { class: 'muted small' });
  const prev = h('button', { class: 'btn ghost', type: 'button', onclick: () => show(i - 1) }, t('common.back'));
  const next = h('button', { class: 'btn ghost', type: 'button', onclick: () => show(i + 1) }, t('common.next'));
  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[i];
    holder.replaceChildren(s.mock, h('div', { class: 'walk-text' }, h('strong', { text: `${i + 1}. ${s.title}` }), h('p', { class: 'small', text: s.text })));
    counter.textContent = `${i + 1} / ${steps.length}`;
    prev.disabled = i === 0;
    next.disabled = i === steps.length - 1;
  }
  show(0);
  return h('div', { class: 'walk' }, holder, h('div', { class: 'row between' }, prev, counter, next));
}

function installButton(link, label) {
  if (link) return h('a', { class: 'btn primary block', href: link, target: '_blank', rel: 'noopener noreferrer' }, label);
  return h('p', { class: 'muted small', text: t('connect.noLink') });
}

function siriSteps() {
  return [
    { title: t('connect.siri.s1'), text: t('connect.siri.s1t'), mock: phone(t('ios.shortcuts'), [[t('connect.siri.name'), { hl: true }], [t('ios.dictate')], [t('ios.copy')], [t('ios.notify')]], { footer: t('connect.siri.name') }) },
    { title: t('connect.siri.s2'), text: t('connect.siri.s2t'), mock: phone('Siri', [[`“${t('connect.siri.hey')}”`, { hl: true }], [`“${t('quick.example1')}”`]]) },
    { title: t('connect.siri.s3'), text: t('connect.siri.s3t'), mock: phone(t('app.name'), [[`📋 ${t('clip.button')}`, { hl: true }], [t('sms.confirmTitle')], [t('sms.confirmSave')]]) },
  ];
}

function smsSteps() {
  return [
    { title: t('connect.sms.s1'), text: t('connect.sms.s1t'), mock: phone(t('ios.shortcuts'), [['Bank SMS → Money Planner', { hl: true }], [t('ios.copy')], [t('ios.notify')]]) },
    { title: t('connect.sms.s2'), text: t('connect.sms.s2t'), mock: phone(t('ios.automation'), [[`＋ ${t('ios.newAutomation')}`, { hl: true }]]) },
    { title: t('connect.sms.s3'), text: t('connect.sms.s3t'), mock: phone(t('ios.newAutomation'), [[t('ios.timeOfDay')], [t('ios.email')], [t('ios.message'), { hl: true }], [t('ios.wifi')]]) },
    { title: t('connect.sms.s4'), text: t('connect.sms.s4t'), mock: phone(t('ios.message'), [[t('ios.sender'), { hl: true, value: 'QNB' }], [t('ios.contains'), { value: '—' }], [t('ios.runImmediately'), { hl: true, toggle: true }]]) },
    { title: t('connect.sms.s5'), text: t('connect.sms.s5t'), mock: phone(t('ios.newAutomation'), [[t('ios.runShortcut'), { hl: true }], ['Bank SMS → Money Planner', { hl: true }], [t('ios.input'), { value: t('ios.shortcutInput') }]]) },
  ];
}

// Returns the screen's children (used full-screen in onboarding and as a page).
export function connectScreen({ onboarding = false, onDone } = {}) {
  return [
    h('h1', { text: t('connect.title') }),
    h('p', { class: 'muted', text: t('connect.intro') }),
    h('section', { class: 'card' },
      h('h2', { text: `🎙️ ${t('connect.siri.title')}` }),
      h('p', { class: 'small', text: t('connect.siri.intro') }),
      installButton(SHORTCUT_LINKS.siri, t('connect.installSiri')),
      walkthrough(siriSteps())),
    h('section', { class: 'card' },
      h('h2', { text: `💬 ${t('connect.sms.title')}` }),
      h('p', { class: 'small', text: t('connect.sms.intro') }),
      h('p', { class: 'small pos', text: t('connect.sms.once') }),
      installButton(SHORTCUT_LINKS.bankSms, t('connect.installSms')),
      walkthrough(smsSteps())),
    h('section', { class: 'card' },
      h('h2', { text: `📋 ${t('connect.clip.title')}` }),
      h('p', { class: 'small', text: t('connect.clip.intro') })),
    h('p', { class: 'muted small', text: t('connect.privacy') }),
    onboarding && h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost grow', type: 'button', onclick: () => { onDone(); toast(t('connect.later'), { ms: 5000 }); } }, t('connect.skip')),
      h('button', { class: 'btn primary grow', type: 'button', onclick: onDone }, t('connect.done'))),
  ];
}

export function connectView() {
  return { title: t('more.connect'), body: connectScreen() };
}
