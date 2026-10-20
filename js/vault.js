// Unlocking, saving and re-keying the encrypted app state.
//
// Two modes (meta.mode):
//   'device' — no PIN (the default): the data is encrypted with a random key
//              the browser stores non-extractable; the app opens straight away.
//   'pin'    — the key is derived from the user's PIN; the app opens locked.

import { dbGet, dbSet, dbSetMany, dbClear } from './db.js';
import { deriveKey, encryptJSON, decryptJSON, randomBytes, generateDeviceKey, PBKDF2_ITERATIONS } from './crypto.js';

export const PIN_LENGTH = 4;
// PINs made before the 4-digit change were 6 digits; they keep working.
export const pinLengthOf = (meta) => meta?.pinLength ?? 6;
const FREE_ATTEMPTS = 5;

let key = null;

let pinMode = false;
let removedOldPin = false;

export const getMeta = () => dbGet('meta');
export const isUnlocked = () => key !== null;
export const usesPin = (meta) => meta?.mode !== 'device'; // vaults made before 'mode' existed had a PIN
export const hasPin = () => pinMode;

const pinMeta = async (pin) => {
  const salt = randomBytes(16);
  return { k: await deriveKey(pin, salt, PBKDF2_ITERATIONS), fields: { mode: 'pin', salt, iterations: PBKDF2_ITERATIONS, failed: 0, lockedUntil: 0, pinLength: pin.length } };
};

// pin = null → no PIN (device key).
export async function createVault(pin, state, prefs) {
  if (pin) {
    const { k, fields } = await pinMeta(pin);
    key = k;
    pinMode = true;
    await dbSetMany({ vault: await encryptJSON(key, state), meta: { v: 1, ...fields, ...prefs } });
  } else {
    key = await generateDeviceKey();
    pinMode = false;
    await dbSetMany({ vault: await encryptJSON(key, state), devicekey: key, meta: { v: 1, mode: 'device', ...prefs } });
  }
}

// No-PIN mode: open with the stored device key.
export async function unlockWithDeviceKey() {
  const k = await dbGet('devicekey');
  const state = await decryptJSON(k, await dbGet('vault'));
  key = k;
  pinMode = false;
  return state;
}

// True once, right after an old required PIN was removed (to tell the user).
export function takeRemovedOldPin() {
  const v = removedOldPin;
  removedOldPin = false;
  return v;
}

// Turn the PIN on (or change it): re-encrypt with a key from the new PIN.
export async function setPin(newPin, state) {
  const meta = await getMeta();
  const { k, fields } = await pinMeta(newPin);
  await dbSetMany({ vault: await encryptJSON(k, state), devicekey: undefined, meta: { ...meta, ...fields } });
  key = k;
  pinMode = true;
}

// Turn the PIN off: re-encrypt with a new device key.
export async function removePin(state) {
  const meta = await getMeta();
  const k = await generateDeviceKey();
  const next = { ...meta, mode: 'device' };
  for (const f of ['salt', 'iterations', 'failed', 'lockedUntil', 'pinLength']) delete next[f];
  await dbSetMany({ vault: await encryptJSON(k, state), devicekey: k, meta: next });
  key = k;
  pinMode = false;
}

// Seconds the user still has to wait after too many wrong PINs (0 = may try).
export function waitSeconds(meta, now = Date.now()) {
  return Math.max(0, Math.ceil(((meta?.lockedUntil ?? 0) - now) / 1000));
}

// Returns the decrypted state, or null if the PIN is wrong.
export async function unlock(pin) {
  const meta = await getMeta();
  if (waitSeconds(meta) > 0) return null;
  const k = await deriveKey(pin, meta.salt, meta.iterations);
  try {
    const state = await decryptJSON(k, await dbGet('vault'));
    key = k;
    pinMode = true;
    if (meta.failed) await dbSet('meta', { ...meta, failed: 0, lockedUntil: 0 });
    // PINs from before the PIN became optional (no meta.mode) were required, not
    // chosen: drop them once. A PIN added later in Settings has mode 'pin' and stays.
    if (!meta.mode) {
      await removePin(state);
      removedOldPin = true;
    }
    return state;
  } catch {
    const failed = (meta.failed ?? 0) + 1;
    const extra = failed - FREE_ATTEMPTS;
    const lockedUntil = extra >= 0 ? Date.now() + Math.min(15 * 60, 30 * 2 ** extra) * 1000 : 0;
    await dbSet('meta', { ...meta, failed, lockedUntil });
    return null;
  }
}

// Checks a PIN without changing the unlocked state or the attempt counter.
export async function checkPin(pin) {
  const meta = await getMeta();
  try {
    await decryptJSON(await deriveKey(pin, meta.salt, meta.iterations), await dbGet('vault'));
    return true;
  } catch {
    return false;
  }
}

export function lock() {
  key = null;
}

export async function saveState(state) {
  if (!key) throw new Error('locked');
  await dbSet('vault', await encryptJSON(key, state));
}

export const changePin = setPin;

export async function updatePrefs(prefs) {
  const meta = await getMeta();
  if (meta) await dbSet('meta', { ...meta, ...prefs });
}

export async function eraseAll() {
  key = null;
  await dbClear();
}
