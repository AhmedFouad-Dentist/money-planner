// Reads a bank SMS handed over in the URL fragment, e.g.
//   <app address>/#sms=<URL-encoded text>
//   <app address>/#from=QNB&sms=<URL-encoded text>
// The fragment (everything after #) is never sent to any server by the browser.
// `sms` must be the last parameter: everything after "sms=" is the message, so an
// un-encoded "&" inside the message cannot cut it short.

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // not encoded (or a stray "%"): use as is
  }
}

export function readSmsFromHash(hash) {
  if (!hash) return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  let i = 0;
  if (!h.startsWith('sms=')) {
    const j = h.indexOf('&sms=');
    if (j === -1) return null;
    i = j + 1;
  }
  let from = null;
  for (const part of h.slice(0, i).split('&')) {
    if (part.startsWith('from=')) from = safeDecode(part.slice(5)).trim() || null;
  }
  return { sms: safeDecode(h.slice(i + 4)), from };
}
