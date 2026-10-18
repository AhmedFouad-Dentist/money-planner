// Suggests a category for a merchant: first from the user's own history, then
// from a few common merchant names. Category ids refer to the default set.

import { merchantKey } from './recurring.js';

export const MERCHANT_HINTS = [
  ['groceries', /carrefour|lulu|spinneys|al ?meera|monoprix|hypermarket|supermarket|grocer|tesco|sainsbury|waitrose|aldi|lidl|asda|kazyon|seoudi|metro market|gourmet|سوبر ?ماركت|هايبر|بقالة|كارفور/i],
  ['dining', /talabat|snoonu|deliveroo|just ?eat|uber ?eats|restaurant|cafe|café|coffee|starbucks|costa|kfc|mcdonald|burger|pizza|elmenus|مطعم|كافيه|قهوة|طلبات/i],
  ['transport', /uber|careem|karwa|metro|woqod|petrol|fuel|shell|parking|tfl|trainline|swvl|indriver|بنزين|وقود|مواصلات|أوبر|كريم/i],
  ['bills', /ooredoo|vodafone|etisalat|orange|\bwe\b|kahramaa|electric|water|internet|broadband|ee limited|o2|council tax|كهرباء|مياه|فاتورة|فودافون|اتصالات/i],
  ['subscriptions', /netflix|spotify|apple\.com|icloud|youtube|shahid|osn|disney|amazon prime|anghami|chatgpt|openai|claude|adobe|microsoft/i],
  ['health', /pharmacy|chemist|boots|clinic|hospital|medical|dental|lab|صيدلية|مستشفى|عيادة|معمل/i],
  ['shopping', /amazon|noon|ikea|h&m|zara|primark|shein|jumia|centrepoint|max fashion/i],
  ['travel', /qatar ?airways|egyptair|airways|airline|airbnb|booking\.com|hotel|expedia|skyscanner|طيران|فندق/i],
  ['education', /\bgdc\b|exam|course|udemy|coursera|university|school|book|ore\b|ielts|oet|امتحان|كورس|جامعة/i],
];

export function suggestCategory(merchant, type, transactions, categories) {
  const valid = (id) => categories.some((c) => c.id === id && c.type === type && !c.archived);
  const key = merchantKey(merchant);
  if (key) {
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      if (tx.type === type && merchantKey(tx.merchant) === key && valid(tx.categoryId)) return tx.categoryId;
    }
    if (type === 'expense') {
      for (const [id, re] of MERCHANT_HINTS) if (re.test(merchant) && valid(id)) return id;
    }
  }
  return null;
}
