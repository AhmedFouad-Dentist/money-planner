// Unlocking, saving and re-keying the encrypted app state.

import { dbGet, dbSet, dbSetMany, dbClear } from './db.js';
import { deriveKey, encryptJSON, decryptJSON, randomBytes, PBKDF2_ITERATIONS } from './crypto.js';

export const PIN_LENGTH = 6;
const FREE_ATTEMPTS = 5;

let key = null;

export const getMeta = () => dbGet('meta');
export const isUnlocked = () => key !== null;

export async function createVault(pin, state, prefs) {
  const salt = randomBytes(16);
  key = await deriveKey(pin, salt, PBKDF2_ITERATIONS);
  await dbSetMany({
    vault: await encryptJSON(key, state),
    meta: { v: 1, salt, iterations: PBKDF2_ITERATIONS, failed: 0, lockedUntil: 0, ...prefs },
  });
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
    if (meta.failed) await dbSet('meta', { ...meta, failed: 0, lockedUntil: 0 });
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

export async function changePin(newPin, state) {
  const meta = await getMeta();
  const salt = randomBytes(16);
  const k = await deriveKey(newPin, salt, PBKDF2_ITERATIONS);
  await dbSetMany({
    vault: await encryptJSON(k, state),
    meta: { ...meta, salt, iterations: PBKDF2_ITERATIONS, failed: 0, lockedUntil: 0 },
  });
  key = k;
}

export async function updatePrefs(prefs) {
  const meta = await getMeta();
  if (meta) await dbSet('meta', { ...meta, ...prefs });
}

export async function eraseAll() {
  key = null;
  await dbClear();
}
