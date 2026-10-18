// In-memory app state while unlocked, with debounced encrypted saving.

import { saveState } from './vault.js';
import { netWorth, monthKey, isoDate } from './finance.js';
import { toast } from './ui.js';
import { t } from './i18n.js';

export const store = { state: null };

let renderFn = () => {};
export const setRenderer = (fn) => (renderFn = fn);
export const rerender = () => store.state && renderFn();

let timer = null;
let saving = Promise.resolve();

export function update(mutate, { render = true } = {}) {
  if (!store.state) return;
  mutate(store.state);
  queueSave();
  if (render) renderFn();
}

export function queueSave() {
  clearTimeout(timer);
  timer = setTimeout(flushSave, 300);
}

export function flushSave() {
  clearTimeout(timer);
  timer = null;
  const state = store.state;
  if (!state) return saving;
  recordSnapshot(state);
  saving = saving
    .then(() => saveState(state))
    .catch((e) => {
      console.error(e);
      toast(t('error.save'), { kind: 'error' });
    });
  return saving;
}

// Keep one net-worth figure per month (the latest), for the monthly report.
export function recordSnapshot(state) {
  const now = new Date();
  state.snapshots[monthKey(now)] = { nw: netWorth(state).total, date: isoDate(now) };
}
