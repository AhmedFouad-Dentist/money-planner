// Encryption helpers (WebCrypto only — works in browsers and in Node for tests).
// A key is derived from the PIN (or backup password) with PBKDF2-SHA-256 and
// used with AES-256-GCM. Keys are created non-extractable.

export const PBKDF2_ITERATIONS = 600_000;
const AAD = new TextEncoder().encode('money-planner:v1');

const subtle = () => globalThis.crypto.subtle;

export function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(secret, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await subtle().importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(key, value) {
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, data));
  return { iv, ct };
}

// Throws if the key is wrong or the data was tampered with.
export async function decryptJSON(key, { iv, ct }) {
  const data = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, ct);
  return JSON.parse(new TextDecoder().decode(data));
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---- backup files: { format, version, kdf, iv, data } — everything but the
// header is encrypted with a key derived from the backup password.
export const BACKUP_FORMAT = 'money-planner-backup';

export async function createBackup(state, password, iterations = PBKDF2_ITERATIONS) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, iterations);
  const { iv, ct } = await encryptJSON(key, state);
  return {
    format: BACKUP_FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: toBase64(salt) },
    cipher: 'AES-256-GCM',
    iv: toBase64(iv),
    data: toBase64(ct),
  };
}

export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // 'format' | 'password'
  }
}

export async function openBackup(file, password) {
  if (!file || file.format !== BACKUP_FORMAT || file.version !== 1 || !file.kdf?.salt) throw new BackupError('format');
  const iterations = Number(file.kdf.iterations);
  if (!(iterations >= 100_000 && iterations <= 10_000_000)) throw new BackupError('format');
  const key = await deriveKey(password, fromBase64(file.kdf.salt), iterations);
  try {
    return await decryptJSON(key, { iv: fromBase64(file.iv), ct: fromBase64(file.data) });
  } catch {
    throw new BackupError('password');
  }
}
