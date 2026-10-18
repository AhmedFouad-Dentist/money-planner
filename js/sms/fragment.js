// Reads text handed over in the URL fragment by an iPhone Shortcut:
//   <app address>/#sms=<URL-encoded bank message>
//   <app address>/#from=QNB&sms=<URL-encoded bank message>
//   <app address>/#say=<URL-encoded dictated text>      (Siri / quick text)
// The fragment (everything after #) is never sent to any server by the browser.
// The text parameter must be the last one: everything after "sms=" / "say=" is
// the text, so an un-encoded "&" inside it cannot cut it short.

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // not encoded (or a stray "%"): use as is
  }
}

// → { kind: 'sms' | 'say', text, from } or null
export function readTextFromHash(hash) {
  if (!hash) return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const m = /(?:^|&)(sms|say)=/.exec(h);
  if (!m) return null;
  let from = null;
  for (const part of h.slice(0, m.index).split('&')) {
    if (part.startsWith('from=')) from = safeDecode(part.slice(5)).trim() || null;
  }
  return { kind: m[1], text: safeDecode(h.slice(m.index + m[0].length)), from };
}
