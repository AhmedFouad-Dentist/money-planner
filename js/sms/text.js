// Text helpers shared by the SMS parser.
//
// Two layers of normalisation are used:
//  - normalizeText(): makes the message predictable (Western digits, no invisible
//    direction marks, no Arabic diacritics, single spaces). Its output is what
//    extracted values (e.g. the merchant) are sliced from.
//  - foldArabic(): additionally maps Arabic letter variants to one form
//    (أ/إ/آ -> ا, ى -> ي, ة -> ه ...). It is length-preserving, so a match found in
//    the folded text sits at exactly the same position in the normalised text.
//    All keyword matching happens on the folded text, which lets rule authors
//    write Arabic naturally without worrying about hamza or taa marbuta.

const INVISIBLE = /[​-‏؜‪-‮⁦-⁩﻿­]/g;
const DIACRITICS = /[ً-ٰٟـ]/g; // harakat, dagger alef, tatweel
const SPACES = /[\t  -   　]/g;

export function normalizeText(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(DIACRITICS, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)) // Arabic-Indic digits
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)) // Persian digits
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/٬/g, ',') // Arabic thousands separator
    .replace(SPACES, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

export function foldArabic(s) {
  return String(s)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

// Compile a rule regex so that it also matches folded text: Arabic letters in
// the pattern source are folded the same way as the message.
export function compileRule(re, extraFlags = '') {
  const flags = new Set((re.flags + extraFlags).split(''));
  flags.delete('g');
  flags.delete('y');
  return new RegExp(foldArabic(re.source), [...flags].join(''));
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Boundaries that work for both Latin and Arabic words (\b is ASCII-only in JS).
export const AR = '\\u0621-\\u064a';
export const WORD_START = `(?<![A-Za-z${AR}])`;
export const WORD_END = `(?![A-Za-z${AR}])`;
