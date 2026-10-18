// Optional exchange-rate update. The ONLY thing sent is your main currency's
// code in the address (e.g. …/latest/QAR) — no amounts, no personal data. The
// service sees your IP address like any website would. No API key needed.
export const RATES_URL_BASE = 'https://open.er-api.com/v6/latest/';

export async function fetchRates(base, codes) {
  if (!/^[A-Z]{3}$/.test(base)) throw new Error('bad base');
  const res = await fetch(RATES_URL_BASE + base, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success' || !json.rates) throw new Error('bad response');
  const rates = {};
  for (const c of codes) {
    const r = Number(json.rates[c]);
    if (r > 0) rates[c] = r;
  }
  return { rates, updatedAt: new Date().toISOString() };
}
