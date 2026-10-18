# Money Planner · مخطط المال

A private money tracker that runs on your phone: spending, income, budgets, investments, net worth and your own savings goals — in any mix of currencies. **Your data never leaves your device.**

[العربية ↓](#العربية)

- **Live app:** https://ahmedfouad-dentist.github.io/money-planner/ (after GitHub Pages is enabled — see below)
- **Privacy notice:** [PRIVACY.md](PRIVACY.md)
- This app only tracks your money. **It does not give financial or investment advice.**

## What it does

- **Transactions** — income and expenses with amount, currency, category, merchant, date and note. Quick add: tap **+**, type the amount, tap a category — saved. Categories are editable.
- **Any currencies** — starts with QAR, EGP, GBP and USD; add any 3-letter code. You choose your **main currency** for net worth and reports. Exchange rates are editable, with an optional online update.
- **Bank SMS** — paste a bank message (or send it from an iPhone Shortcut) and the app pulls out amount, currency, merchant and date. Nothing else is kept. Messages with one-time passwords or verification codes are refused.
- **Goals** — create your own goals: name, amount, currency, optional target date, and what funds each one (savings accounts, investments, or both — you pick which ones count). The app shows progress, the monthly amount needed to hit the date, and a projected date at your current pace.
- **Investments** — your own types (gold, certificates, stocks, property, crypto, anything). Record money in/out and update the current value over time; see gain/loss in amount and %.
- **Net worth** — cash accounts + investments − loans & debts, in your main currency, on the home screen next to what's left for your first goal.
- **Budgets** per category with warnings at 80% and 100%.
- **Subscriptions** — spots payments to the same merchant, of a similar amount, about monthly; you confirm which are real.
- **Monthly report** — spent, saved, savings rate, top categories, 6-month chart, goal progress.
- **Security** — PIN lock on open and after inactivity; all data encrypted (AES-GCM, key derived from your PIN with PBKDF2). Encrypted backup files you save to Files / iCloud.
- Works offline, installs to the iPhone Home Screen, Arabic and English (full right-to-left layout), dark mode.

## Turn on GitHub Pages (one time, for the repository owner)

1. On GitHub open the repository → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab → **Test and deploy to GitHub Pages** → **Run workflow** (or push any commit to `main`).
4. When it finishes (about a minute), the app is live at `https://ahmedfouad-dentist.github.io/money-planner/`.

Every push to `main` runs the tests and, if they pass, redeploys. Open the app once afterwards and tap **Update** when it offers a new version.

## Install on iPhone

1. Open the app address above in **Safari** (it must be Safari).
2. Tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.
3. Open **Money Planner** from the Home Screen icon. It now runs full screen and works offline.
4. First run: choose your language, your currencies and main currency, create your goals (or skip), then set a 6-digit PIN.

> There is no way to recover a forgotten PIN — that's what makes the encryption real. Keep backups.

## Backups

Your data exists only on your phone. If the phone is lost, reset, or the app is removed from the Home Screen, **a backup file is the only way back**.

- **Make one:** More → Backup & restore → choose a backup password (at least 8 characters, different from your PIN) → **Encrypt backup** → **Save backup file** → choose **Save to Files** (iCloud Drive is a good place).
- **Restore:** on a new phone, choose **Restore from a backup file** on the first screen (or More → Backup & restore → Choose backup file), pick the file and type the backup password.
- The app reminds you to back up (every 14 days by default; change it on the Backup screen).
- The file is encrypted (AES-256-GCM, PBKDF2-SHA-256 with 600,000 iterations). Without the password nobody can read it — including you, so write the password down somewhere safe.

<a id="iphone-shortcut"></a>
## iPhone Shortcut: send bank SMS to the app automatically

**Important iPhone limitation.** When a Shortcut opens a web address, iPhone opens it in **Safari**, not in the Home Screen app — and Safari and the Home Screen app keep **separate storage**. So pick one of these two setups:

### Option A (recommended if you installed the app to the Home Screen): copy, then paste

The Shortcut copies the bank message; you open the app and tap **Bank SMS → Paste**.

1. Open the **Shortcuts** app → **Automation** tab → **+** (New Automation).
2. Choose **Message**.
3. Set **Message Contains** to a word that appears in your bank's purchase messages (for example the bank name, `QAR`, `EGP` or `purchase`). If the bank is saved as a contact you can also set **Sender**.
4. Choose **Run Immediately** (and turn off **Notify When Run** if you like) → **Next**.
5. Tap **New Blank Automation**, then add these actions:
   - **Copy to Clipboard** — input: **Shortcut Input** (the message).
   - **Show Notification** — text: `Bank SMS copied — open Money Planner and tap Bank SMS → Paste`.
6. Tap **Done**.

When a bank message arrives: open Money Planner, enter your PIN, tap **Bank SMS** → **Paste** → check → **Confirm & save**. The app clears the clipboard after reading it, so the full message doesn't stay there.

### Option B: open the app with the message in the address

The message goes in the part of the address after `#`, which **browsers never send to any server**. The app reads it, immediately removes it from the address bar and history, shows a confirm sheet, and keeps only the extracted fields.

1–4. Same as Option A.
5. Add these actions:
   - **URL Encode** — input: **Shortcut Input** (tap the variable and choose the message *content* if Shortcuts offers a choice).
   - **Text** — type `https://ahmedfouad-dentist.github.io/money-planner/#sms=` and then insert the **URL Encoded Text** variable right after `=` (no spaces).
   - **Open URLs** — input: the **Text** from the previous step.
6. Tap **Done**.

- If you use the app **in Safari** (not installed to the Home Screen), this opens straight into a confirm sheet.
- If you use the **Home Screen app**, the Safari page shows the extracted amount, merchant and date with a **Copy cleaned summary** button; open the Home Screen app and paste it into **Bank SMS**. Only the cleaned fields go to the clipboard, never the original message.
- Safari may still list the visit in its History; the app removes the message from the page address straight away.
- Optional extra safety: before the other actions add **If** *Shortcut Input* *contains* `OTP` → **Stop This Shortcut**. (The app refuses code messages anyway.)

## What happens to a bank SMS

1. Arabic-Indic digits, direction marks and spacing are normalised.
2. If the message mentions a one-time password, verification code, `OTP`, `رمز التحقق`, `كلمة مرور لمرة واحدة` or similar, it is **refused** and nothing is kept.
3. Card numbers, account numbers, IBANs, phone numbers, long reference numbers, **balances and credit limits are cut out**.
4. Amount, currency, merchant and date are extracted — first with the bank-specific rules in [`js/sms/banks.js`](js/sms/banks.js), then with general English/Arabic rules.
5. You see only those four fields (plus income/expense) to check, fix and save. The message text is dropped and never stored.

**Help tune it for your bank.** Bank formats differ. To add or fix a bank, copy an entry in [`js/sms/banks.js`](js/sms/banks.js) — the file explains each field — and add a test to [`tests/sms-parser.test.mjs`](tests/sms-parser.test.mjs). **Never commit real messages**: replace names, card digits, balances and merchants with obviously fake values first. The included QNB, CIB, NBE, Banque Misr and other entries use illustrative formats and should be tuned with real (redacted) samples.

## Exchange rates

Rates are stored on your phone and can be edited by hand (More → Currencies & rates). **Update rates online** calls `https://open.er-api.com/v6/latest/<your main currency>` — a free service that needs no key and covers QAR and EGP. **Only your main currency's 3-letter code is sent** (no amounts, no data); like any website, the service can see your IP address. Each transaction remembers the rate on the day it was entered, so past months don't change when rates move.

## Security details

- The app state is one JSON document encrypted with **AES-256-GCM** and stored in the browser's IndexedDB on the phone. The key is derived from your 6-digit PIN with **PBKDF2-SHA-256, 600,000 iterations**, and is only kept in memory while unlocked.
- After 5 wrong PINs the app makes you wait (30 s, doubling up to 15 min).
- The app locks on open, after inactivity (2 minutes by default) and when it has been in the background longer than that.
- **Honest limits:** a 6-digit PIN protects against someone picking up your phone, and your iPhone's own encryption protects the device; but someone who copied the app's raw storage off an unlocked phone could try all PINs offline. Backups use a separate password — make it long.
- Strict Content-Security-Policy: scripts only from the app itself; the only allowed outside connection is `open.er-api.com`. No analytics, no third-party scripts, no CDN.

## For developers

No build step and no dependencies — plain ES modules.

```sh
npm test            # unit tests (Node 20+): SMS parser, money maths, encryption, PWA checks
npm run serve       # http://localhost:8080
npm run icons       # regenerate icons/*.png
```

| Path | What |
|---|---|
| `index.html`, `css/app.css` | page shell and styles (mobile-first, RTL via logical properties, dark mode) |
| `js/app.js` | boot, SMS-from-URL handling, auto-lock, service worker registration |
| `js/sms/` | SMS parser (`parser.js`), bank rule table (`banks.js`), vocabulary (`vocab.js`) |
| `js/finance.js` | pure calculations: conversion, monthly totals, goals, net worth, budgets |
| `js/crypto.js`, `js/vault.js`, `js/db.js` | PBKDF2 + AES-GCM, encrypted storage in IndexedDB |
| `js/views/` | screens |
| `sw.js` | offline cache (the deploy workflow stamps a new cache version) |
| `.github/workflows/pages.yml` | runs tests, deploys `main` to GitHub Pages |

---

<div dir="rtl" lang="ar">

<a id="العربية"></a>

# مخطط المال

متتبّع خاص لأموالك يعمل على هاتفك: المصروفات والدخل والميزانيات والاستثمارات وصافي الثروة وأهداف الادخار التي تحددها بنفسك — بأي مجموعة من العملات. **بياناتك لا تغادر جهازك أبدًا.**

- **رابط التطبيق:** https://ahmedfouad-dentist.github.io/money-planner/ (بعد تفعيل GitHub Pages — انظر بالأسفل)
- **إشعار الخصوصية:** [PRIVACY.md](PRIVACY.md)
- التطبيق لمتابعة أموالك فقط، **ولا يقدّم نصائح مالية أو استثمارية.**

## ماذا يفعل

- **المعاملات** — دخل ومصروفات بالمبلغ والعملة والفئة والتاجر والتاريخ وملاحظة. إضافة سريعة: اضغط **+** واكتب المبلغ واضغط فئة — تم الحفظ. الفئات قابلة للتعديل.
- **أي عملات** — يبدأ بالريال القطري والجنيه المصري والجنيه الإسترليني والدولار، ويمكنك إضافة أي رمز من 3 أحرف. أنت تختار **العملة الرئيسية** لصافي الثروة والتقارير. أسعار الصرف قابلة للتعديل مع تحديث اختياري عبر الإنترنت.
- **رسائل البنك** — الصق رسالة البنك (أو أرسلها من اختصار iPhone) فيستخرج التطبيق المبلغ والعملة والتاجر والتاريخ فقط. رسائل رموز التحقق وكلمات المرور لمرة واحدة تُرفض.
- **الأهداف** — أنشئ أهدافك: الاسم والمبلغ والعملة وتاريخ مستهدف اختياري، ومصدر التمويل (حسابات الادخار أو الاستثمارات أو الاثنان — وتختار أيها يُحتسب). يعرض التطبيق التقدّم والمبلغ الشهري المطلوب والتاريخ المتوقع بمعدلك الحالي.
- **الاستثمارات** — أنواع تحددها أنت (ذهب، شهادات، أسهم، عقار، عملات رقمية، أي شيء). سجّل المبالغ الداخلة والخارجة وحدّث القيمة الحالية، وشاهد الربح/الخسارة بالمبلغ والنسبة.
- **صافي الثروة** — الحسابات النقدية + الاستثمارات − القروض والديون بعملتك الرئيسية، في الشاشة الرئيسية بجوار المتبقي لهدفك الأول.
- **ميزانيات** لكل فئة مع تنبيه عند 80٪ و100٪.
- **الاشتراكات** — يكتشف المدفوعات المتكررة شهريًا لنفس التاجر بمبلغ متقارب، وأنت تؤكّد الصحيح منها.
- **تقرير شهري** — المصروف والمدّخر ونسبة الادخار وأعلى الفئات ورسم لآخر 6 أشهر والتقدّم نحو الأهداف.
- **الأمان** — قفل برمز سري عند الفتح وبعد عدم النشاط، وكل البيانات مشفّرة. نسخ احتياطية مشفّرة تحفظها في «الملفات» أو iCloud.
- يعمل بدون إنترنت، ويُثبَّت على الشاشة الرئيسية، بالعربية والإنجليزية (اتجاه من اليمين لليسار)، مع الوضع الداكن.

## تفعيل GitHub Pages (مرة واحدة لمالك المستودع)

1. افتح المستودع على GitHub ← **Settings** ← **Pages**.
2. في **Build and deployment ← Source** اختر **GitHub Actions**.
3. افتح تبويب **Actions** ← **Test and deploy to GitHub Pages** ← **Run workflow** (أو ارفع أي تعديل إلى `main`).
4. بعد دقيقة تقريبًا يصبح التطبيق متاحًا على `https://ahmedfouad-dentist.github.io/money-planner/`.

## التثبيت على iPhone

1. افتح الرابط في **Safari** (لازم Safari).
2. اضغط زر **المشاركة** (المربع والسهم) ← **إضافة إلى الشاشة الرئيسية** ← **إضافة**.
3. افتح **مخطط المال** من أيقونة الشاشة الرئيسية.
4. أول مرة: اختر اللغة والعملات والعملة الرئيسية، وأنشئ أهدافك (أو تخطَّ)، ثم اختر رمزًا سريًا من 6 أرقام.

> لا توجد طريقة لاسترجاع رمز منسي — وهذا ما يجعل التشفير حقيقيًا. احتفظ بنسخ احتياطية.

## النسخ الاحتياطي

بياناتك موجودة على هاتفك فقط. إذا ضاع الهاتف أو أُعيد ضبطه أو حُذف التطبيق، **فملف النسخة الاحتياطية هو الطريق الوحيد لاستعادتها**.

- **لإنشاء نسخة:** المزيد ← النسخ الاحتياطي والاستعادة ← اختر كلمة مرور للنسخة (8 أحرف على الأقل، مختلفة عن الرمز السري) ← **تشفير النسخة** ← **حفظ ملف النسخة** ← **حفظ في الملفات** (iCloud Drive مكان مناسب).
- **للاستعادة:** على هاتف جديد اختر **استعادة من نسخة احتياطية** في أول شاشة، ثم اختر الملف واكتب كلمة المرور.
- يذكّرك التطبيق بالنسخ الاحتياطي (كل 14 يومًا افتراضيًا).
- الملف مشفّر، وبدون كلمة المرور لا يستطيع أحد قراءته — ولا أنت — فاكتبها في مكان آمن.

## اختصار iPhone: إرسال رسائل البنك تلقائيًا

**قيد مهم في iPhone:** عندما يفتح الاختصار رابطًا، يفتحه iPhone في **Safari** وليس في تطبيق الشاشة الرئيسية — وكل منهما له **تخزين منفصل**. لذلك اختر أحد الإعدادين:

### الخيار أ (الأفضل إذا ثبّتّ التطبيق على الشاشة الرئيسية): نسخ ثم لصق

1. افتح تطبيق **الاختصارات** ← تبويب **الأتمتة** ← **+**.
2. اختر **الرسالة**.
3. في **الرسالة تحتوي على** اكتب كلمة موجودة في رسائل الشراء من البنك (مثل اسم البنك أو `QAR` أو `EGP` أو «شراء»). ويمكنك تحديد **المرسل** إذا كان البنك محفوظًا كجهة اتصال.
4. اختر **تشغيل فورًا** ← **التالي**.
5. اضغط **أتمتة فارغة جديدة** وأضف:
   - **نسخ إلى الحافظة** — المُدخل: **مُدخل الاختصار** (الرسالة).
   - **إظهار إشعار** — النص: «تم نسخ رسالة البنك — افتح مخطط المال واضغط رسالة البنك ← لصق».
6. اضغط **تم**.

عند وصول رسالة: افتح التطبيق ← أدخل الرمز ← **رسالة البنك** ← **لصق** ← راجع ← **تأكيد وحفظ**. يمسح التطبيق الحافظة بعد قراءتها حتى لا تبقى الرسالة كاملة فيها.

### الخيار ب: فتح التطبيق والرسالة داخل الرابط

توضع الرسالة بعد علامة `#` في الرابط، وهذا الجزء **لا يرسله المتصفح لأي خادم إطلاقًا**. يقرؤه التطبيق ثم يحذفه فورًا من شريط العنوان والسجل، ويعرض شاشة تأكيد، ولا يحتفظ إلا بالحقول المستخرجة.

1–4. مثل الخيار أ.
5. أضف:
   - **ترميز URL** — المُدخل: **مُدخل الاختصار** (اختر *محتوى* الرسالة إن ظهر الاختيار).
   - **نص** — اكتب `https://ahmedfouad-dentist.github.io/money-planner/#sms=` ثم أدرج متغير **النص المرمّز** مباشرة بعد `=` بدون مسافات.
   - **فتح عناوين URL** — المُدخل: **النص** من الخطوة السابقة.
6. اضغط **تم**.

- إذا كنت تستخدم التطبيق **داخل Safari** (بدون تثبيت)، تُفتح شاشة التأكيد مباشرة.
- إذا كنت تستخدم **تطبيق الشاشة الرئيسية**، تعرض صفحة Safari المبلغ والتاجر والتاريخ مع زر **نسخ الملخص النظيف**؛ افتح التطبيق المثبّت والصقه في **رسالة البنك**. يُنسخ الملخص النظيف فقط، وليس الرسالة الأصلية.
- أمان إضافي اختياري: أضف في البداية **إذا** *مُدخل الاختصار* *يحتوي على* `OTP` ← **إيقاف هذا الاختصار** (التطبيق يرفض رسائل الرموز في كل الأحوال).

## ماذا يحدث لرسالة البنك

1. توحيد الأرقام العربية والمسافات وعلامات الاتجاه.
2. إذا ذكرت الرسالة كلمة مرور لمرة واحدة أو رمز تحقق أو `OTP` أو «رمز التحقق» أو «كلمة مرور لمرة واحدة» أو ما يشبهها، **تُرفض** ولا يُحفظ شيء.
3. **تُحذف** أرقام البطاقات والحسابات والآيبان والهواتف وأرقام المرجع الطويلة **والأرصدة وحدود الائتمان**.
4. يُستخرج المبلغ والعملة والتاجر والتاريخ — أولًا بقواعد البنك في [`js/sms/banks.js`](js/sms/banks.js) ثم بقواعد عامة بالعربية والإنجليزية.
5. ترى هذه الحقول الأربعة فقط لتراجعها وتحفظها. نص الرسالة يُتخلّص منه ولا يُخزَّن أبدًا.

**لضبط القواعد لبنكك:** انسخ أحد الإدخالات في [`js/sms/banks.js`](js/sms/banks.js) (الملف يشرح كل حقل) وأضف اختبارًا في [`tests/sms-parser.test.mjs`](tests/sms-parser.test.mjs). **لا ترفع رسائل حقيقية أبدًا** — استبدل الأسماء وأرقام البطاقات والأرصدة والتجار بقيم وهمية واضحة.

## أسعار الصرف

تُخزَّن الأسعار على هاتفك ويمكن تعديلها يدويًا (المزيد ← العملات وأسعار الصرف). زر **تحديث الأسعار عبر الإنترنت** يتصل بـ `open.er-api.com` — خدمة مجانية بدون مفتاح وتشمل الريال القطري والجنيه المصري. **لا يُرسَل إلا رمز عملتك الرئيسية** (بدون مبالغ أو بيانات)، وكأي موقع يمكن للخدمة رؤية عنوان IP. كل معاملة تحتفظ بسعر يوم إدخالها، فلا تتغير الأشهر السابقة عند تغيّر الأسعار.

## تفاصيل الأمان

- بيانات التطبيق مشفّرة بـ **AES-256-GCM** ومخزّنة في IndexedDB على الهاتف. المفتاح مشتق من الرمز السري المكوّن من 6 أرقام عبر **PBKDF2-SHA-256 بـ 600,000 تكرار** ولا يبقى إلا في الذاكرة أثناء الفتح.
- بعد 5 محاولات خاطئة ينتظر التطبيق (30 ثانية تتضاعف حتى 15 دقيقة).
- يُقفل التطبيق عند الفتح، وبعد عدم النشاط (دقيقتان افتراضيًا)، وعند العودة من الخلفية بعد هذه المدة.
- **بصراحة:** الرمز من 6 أرقام يحمي من شخص يلتقط هاتفك، وتشفير iPhone نفسه يحمي الجهاز؛ لكن من ينسخ التخزين الخام للتطبيق من هاتف مفتوح قد يجرّب كل الرموز. النسخ الاحتياطية تستخدم كلمة مرور منفصلة — اجعلها طويلة.
- سياسة أمان محتوى صارمة: لا أكواد إلا من التطبيق نفسه، والاتصال الخارجي الوحيد المسموح هو `open.er-api.com`. لا إحصاءات ولا أكواد خارجية.

</div>
