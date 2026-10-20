# Money Planner · مخطط المال

A private money tracker that runs on your phone: spending, income, budgets, investments, net worth and your own savings goals — in any mix of currencies. **Your data never leaves your device.**

[العربية ↓](#العربية)

- **Live app:** https://ahmedfouad-dentist.github.io/money-planner/ (after GitHub Pages is enabled — see below)
- **Privacy notice:** [PRIVACY.md](PRIVACY.md)
- This app only tracks your money. **It does not give financial or investment advice.**

## What it does

- **Adding is one box** — type `coffee 15` / `قهوة 15` on the Home screen and press Enter: it's saved at once with a guessed category and your currency, and a toast lets you **Undo** or **Edit**. `15 قهوة`, `قهوة ١٥`, `+5000 مرتب` (income), full sentences and loan phrases work too. The app only asks when the amount is missing or unclear. The full form (currency, date, note, category) is still there via Edit or History → +.
- **Any currencies** — starts with QAR, EGP, GBP and USD; add any 3-letter code. You choose your **main currency** for net worth and reports. Exchange rates are editable, with an optional online update.
- **Bank SMS** — copy a bank message and tap **Add from copied message** (or send it from an iPhone Shortcut): the app pulls out amount, currency, merchant and date. Nothing else is kept. Messages with one-time passwords or verification codes are refused.
- **Say it or type it** — “Hey Siri, صرفت” / “Add expense”, or the quick-text box: *“اشتريت قهوة بـ 15 ريال”*, *“I bought groceries for 120 QAR”*, *“got salary 18000 riyal”*. Arabic (Egyptian and standard) and English, Arabic-Indic digits, and words like ألف / ألفين / thousand. You always confirm before anything is saved.
- **Loans (السلف)** — money you lent and borrowed, per person, with partial repayments, due-date reminders in the app, and a polite reminder message you can send yourself. Also by voice: *“سلفت أحمد 500 ريال”*, *“محمد رجّعلي 200”*, *“I lent Sara 100 GBP”*.
- **Goals** — create your own goals: name, amount, currency, optional target date, and what funds each one (savings accounts, investments, or both — you pick which ones count). The app shows progress, the monthly amount needed to hit the date, and a projected date at your current pace.
- **Investments** — your own types (gold, certificates, stocks, property, crypto, anything). Record money in/out and update the current value over time; see gain/loss in amount and %.
- **Net worth** — cash accounts + investments + money owed to you − debts − money you owe people, in your main currency, on the home screen next to what's left for your first goal. Each goal can count or ignore money owed to you.
- **Budgets** per category with warnings at 80% and 100%.
- **Subscriptions** — spots payments to the same merchant, of a similar amount, about monthly; you confirm which are real.
- **Monthly report** — spent, saved, savings rate, top categories, 6-month chart, goal progress.
- **Security** — all data encrypted on the phone (AES-GCM). No PIN by default — the app opens straight away; an optional PIN lock can be turned on in Settings. Encrypted backup files you save to Files / iCloud.
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
4. First run is one screen: your currency (already picked from your phone's location) → **Start**. No PIN needed. The language follows your phone (Arabic phones start in Arabic; there's a small toggle). Goals, Siri and bank messages are offered later as small cards on Home, and everything is under **More**.

**Using it:** the Home screen has only the input box, what you spent this month, your goal bar (if you set a goal) and your last 5 entries — tap one to edit, swipe it sideways to delete. The bottom bar has three tabs: **Home**, **History** and **More** (goals, investments, loans, everything you own, budgets, report, subscriptions, backup, settings).

> Want a PIN? More → Settings → **Add a PIN**. If you add one and forget it, the data can't be recovered — keep backups.

## Backups

Your data exists only on your phone. If the phone is lost, reset, or the app is removed from the Home Screen, **a backup file is the only way back**.

- **Make one:** More → Backup & restore → choose a backup password (at least 8 characters) → **Encrypt backup** → **Save backup file** → choose **Save to Files** (iCloud Drive is a good place).
- **Restore:** on a new phone, choose **Restore from a backup file** on the first screen (or More → Backup & restore → Choose backup file), pick the file and type the backup password.
- The app reminds you to back up (every 14 days by default; change it on the Backup screen).
- The file is encrypted (AES-256-GCM, PBKDF2-SHA-256 with 600,000 iterations). Without the password nobody can read it — including you, so write the password down somewhere safe.

<a id="iphone-shortcut"></a>
## Siri and bank messages (iPhone Shortcuts)

**First, an iPhone fact:** no app can read your SMS or other messages on iPhone — iOS doesn't allow it. Money Planner only sees text that **you** give it: by copying, typing, dictating, or through a Shortcut you set up yourself.

**Second, an iPhone limit:** when a Shortcut opens a web address, iPhone opens it in **Safari**, not in the Home Screen app, and the two keep **separate storage**. So for people who installed the app to the Home Screen, the shortcuts below **copy** the text, and you then tap **Add from copied message** in the app (one tap). The app clears the clipboard after reading it. Each shortcut also has a “link” variant that opens the app address with the text after `#` (never sent to any server); in Safari it shows what was understood with a **Copy** button for the installed app.

The app's Home screen has two more ways in: **Add from copied message** (long-press any bank SMS → Copy → tap the button) and the **quick text** box (type, or tap 🎤 on the keyboard and speak).

### Shortcut 1 — “Hey Siri, صرفت” / “Add expense”

Make one shortcut per language (dictation listens in one language): name the Arabic one **صرفت** and the English one **Add expense**. The name is what you say to Siri.

1. Open **Shortcuts** → **+** (new shortcut) → tap the name at the top → type **صرفت** (or **Add expense**).
2. Add **Dictate Text**. Tap *Language* and pick Arabic (or English). Set *Stop Listening* to **After Pause**.
3. Add **Copy to Clipboard** — input: **Dictated Text**.
4. Add **Show Notification** — text: `Copied — open Money Planner and tap “Add from copied message”` (Arabic: `تم النسخ — افتح مخطط المال واضغط «إضافة من رسالة منسوخة»`).
5. Tap **Done**.

Use it: say **“Hey Siri, صرفت”**, wait for Siri to listen, then say e.g. **“اشتريت قهوة بـ 15 ريال”** or **“دفعت إيجار 3000 جنيه”**. Open Money Planner → **Add from copied message** → check → **Confirm & save**.

*Link variant (if you use the app in Safari):* replace steps 3–4 with **URL Encode** (input: Dictated Text) → **Text** `https://ahmedfouad-dentist.github.io/money-planner/#say=` followed immediately by the **URL Encoded Text** variable → **Open URLs** (input: Text).

What the app understands — Arabic and English, e.g. *“صرفت 50 باوند بنزين”*, *“قبضت المرتب 15 ألف ريال”*, *“صرفت ألفين جنيه على الكورس”*, *“spent 30 QAR on lunch yesterday”*, *“got salary 18000 riyal”*, *“سلفت أحمد 500 ريال”*, *“اتسلفت من محمد 2000 جنيه”*, *“paid back Omar 50 dollars”*. Currencies: ريال/riyal → QAR, جنيه/LE → EGP, باوند/استرليني/pounds → GBP, دولار/dollars → USD (others too); if you don't say one, your everyday spending currency is used and the confirm screen tells you. The category is guessed from words like قهوة, بنزين, إيجار, groceries, rent.

### Shortcut 2 — “Bank SMS → Money Planner” + the automation

**The shortcut** (receives a bank message and copies it):

1. **Shortcuts** → **+** → name it **Bank SMS → Money Planner**.
2. Add **If** — *Shortcut Input* **contains** `OTP` → inside it add **Stop This Shortcut** → (End If). *(Optional extra safety; the app refuses code messages anyway.)*
3. Add **Copy to Clipboard** — input: **Shortcut Input**.
4. Add **Show Notification** — text: `Bank message copied — open Money Planner and tap “Add from copied message”`.
5. Tap **Done**. (If Shortcuts asks what input the shortcut receives, allow **Text**.)

**The automation** (set up once — Apple doesn't let anyone share automations, so each person creates this; the app's walkthrough shows it with pictures):

1. **Shortcuts** → **Automation** tab → **+** (New Automation) → **Message**.
2. **Sender**: choose your bank. Banks often send from a name rather than a number; if your bank isn't offered, use **Message Contains** with a word from its purchase messages (e.g. the bank's name) instead.
3. Choose **Run Immediately** → **Next** → **New Blank Automation**.
4. Add **Run Shortcut** → choose **Bank SMS → Money Planner** → tap the arrow and set *Input* to **Shortcut Input**.
5. Tap **Done**.

From now on, only messages from that sender (or containing that word) are passed to the shortcut — nothing else. When one arrives, open Money Planner and tap **Add from copied message**.

*Link variant:* in the shortcut, replace steps 3–4 with **URL Encode** (Shortcut Input) → **Text** `https://ahmedfouad-dentist.github.io/money-planner/#sms=` + URL Encoded Text → **Open URLs**.

### One-tap install links (for the app owner, once)

The app's setup screen has **Install shortcut** buttons. To turn them on:

1. Build both shortcuts on your iPhone as above (use the English names, or both language versions of Shortcut 1 — your choice).
2. In Shortcuts, long-press a shortcut → **Share** → **Copy iCloud Link**. (The shortcuts contain no personal data — check before sharing.)
3. Paste the links into [`js/config.js`](js/config.js) (`SHORTCUT_LINKS.siri` and `SHORTCUT_LINKS.bankSms`) and commit. The site redeploys and the buttons appear.

Until then the app shows the step-by-step walkthrough instead.

## Loans (السلف)

More → **Loans**: record money you **lent** (they owe you) or **borrowed** (you owe them) per person, with amount, currency, date, an optional due date and a note. Add partial repayments; the remaining balance updates and the loan is marked settled when fully repaid (or settle it by hand). The overview shows the total owed to you and the total you owe in your main currency, plus a net balance per person across all their loans. Due and overdue loans show as banners on the Home screen and a badge on **More**. **Send a friendly reminder** opens the iPhone share sheet with a polite message you can send yourself — the app never sends anything.

Net worth includes money owed to you and money you owe. Every goal subtracts what you owe people; it adds what people owe you unless you untick **Count money people owe me** on that goal.

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

- The app state is one JSON document encrypted with **AES-256-GCM** and stored in the browser's IndexedDB on the phone.
- **Without a PIN (default):** the key is a random AES key created on the phone and stored by the browser as a *non-extractable* key — the app can use it but its bytes can't be read out by any page script. The app opens straight away, so **your iPhone's passcode / Face ID is what protects the data** from someone holding your phone. Keep a phone passcode.
- **With a PIN (optional, Settings → Add a PIN):** the key is derived from your 4-digit PIN with **PBKDF2-SHA-256, 600,000 iterations** and kept only in memory while unlocked. The app locks on open, after inactivity (2 minutes by default) and after being in the background that long; after 5 wrong PINs it makes you wait (30 s, doubling up to 15 min). Only 10,000 PINs exist, so this stops someone picking up the phone, not someone who copied the app's raw storage.
- Installs from before the PIN became optional are asked for their old PIN once; it is then removed (the app says so). A PIN you add later stays.
- Backups use their own password (not a PIN) — make it long.
- Strict Content-Security-Policy: scripts only from the app itself; the only allowed outside connection is `open.er-api.com`. No analytics, no third-party scripts, no CDN.

## For developers

No build step and no dependencies — plain ES modules.

```sh
npm test            # unit tests (Node 20+): SMS + quick-text parsers, money maths, loans, encryption, PWA checks
npm run serve       # http://localhost:8080
npm run e2e         # browser test on a simulated iPhone (needs Playwright; BASE=<url> tests the live site)
npm run icons       # regenerate icons/*.png
```

| Path | What |
|---|---|
| `index.html`, `css/app.css` | page shell and styles (mobile-first, RTL via logical properties, dark mode) |
| `js/app.js` | boot, SMS-from-URL handling, auto-lock, service worker registration |
| `js/sms/` | SMS parser (`parser.js`), bank rule table (`banks.js`), vocabulary (`vocab.js`), URL-fragment reader (`fragment.js`) |
| `js/nlp/quicktext.js` | quick-text / Siri parser (Arabic + English, amounts in words, loans, category keywords) |
| `js/config.js` | iCloud links for the ready-made Shortcuts |
| `js/finance.js` | pure calculations: conversion, monthly totals, goals, loans, net worth, budgets |
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

- **الإضافة مربع واحد** — اكتب `قهوة 15` في الشاشة الرئيسية ودوس Enter: يتسجّل فورًا بقسم متخمَّن وعملتك، ويظهر تنبيه فيه **تراجع** أو **تعديل**. وكمان `15 قهوة` و`قهوة ١٥` و`+5000 مرتب` (دخل) والجمل الكاملة وجمل السلف. التطبيق بيسأل بس لو المبلغ ناقص أو مش واضح. والشكل الكامل (العملة والتاريخ والملاحظة والقسم) موجود من «تعديل» أو السجل ← +.
- **أي عملات** — يبدأ بالريال القطري والجنيه المصري والجنيه الإسترليني والدولار، ويمكنك إضافة أي رمز من 3 أحرف. أنت تختار **العملة الرئيسية** لصافي الثروة والتقارير. أسعار الصرف قابلة للتعديل مع تحديث اختياري عبر الإنترنت.
- **رسائل البنك** — انسخ رسالة البنك واضغط **إضافة من رسالة منسوخة** (أو أرسلها من اختصار iPhone) فيستخرج التطبيق المبلغ والعملة والتاجر والتاريخ فقط. رسائل رموز التحقق وكلمات المرور لمرة واحدة تُرفض.
- **قُلها أو اكتبها** — «يا Siri، صرفت» أو مربع الإضافة السريعة: *«اشتريت قهوة بـ 15 ريال»*، *«دفعت إيجار 3000 جنيه»*، *«I bought groceries for 120 QAR»*. بالعربية (المصرية والفصحى) والإنجليزية، مع الأرقام العربية وكلمات مثل ألف وألفين. تراجع دائمًا قبل الحفظ.
- **السلف** — ما أقرضته وما اقترضته لكل شخص، مع دفعات جزئية وتذكير بمواعيد السداد داخل التطبيق ورسالة تذكير لطيفة ترسلها أنت بنفسك. وبالصوت أيضًا: *«سلفت أحمد 500 ريال»*، *«اتسلفت من محمد 2000 جنيه»*، *«محمد رجّعلي 200»*.
- **الأهداف** — أنشئ أهدافك: الاسم والمبلغ والعملة وتاريخ مستهدف اختياري، ومصدر التمويل (حسابات الادخار أو الاستثمارات أو الاثنان — وتختار أيها يُحتسب). يعرض التطبيق التقدّم والمبلغ الشهري المطلوب والتاريخ المتوقع بمعدلك الحالي.
- **الاستثمارات** — أنواع تحددها أنت (ذهب، شهادات، أسهم، عقار، عملات رقمية، أي شيء). سجّل المبالغ الداخلة والخارجة وحدّث القيمة الحالية، وشاهد الربح/الخسارة بالمبلغ والنسبة.
- **صافي الثروة** — الحسابات النقدية + الاستثمارات + المستحق لك − الديون − ما عليك للآخرين، بعملتك الرئيسية، في الشاشة الرئيسية بجوار المتبقي لهدفك الأول. ويمكن لكل هدف أن يحتسب المستحق لك أو يتجاهله.
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
4. أول مرة شاشة واحدة: عملتك (متختارة من مكان موبايلك) ← **يلا نبدأ**. من غير رقم سري. اللغة زي لغة الموبايل (وفيه زرار صغير للتغيير). الأهداف وSiri ورسائل البنك بتظهر بعدين ككروت صغيرة في الرئيسية، وكل حاجة موجودة في **المزيد**.

**الاستخدام:** الرئيسية فيها مربع الكتابة، وصرفت قد إيه الشهر ده، وشريط الهدف (لو حطيت هدف)، وآخر 5 حاجات — دوس على أي واحدة للتعديل واسحبها للمسح. الشريط تحت فيه 3 بس: **الرئيسية** و**السجل** و**المزيد**.

> لا توجد طريقة لاسترجاع رمز منسي — وهذا ما يجعل التشفير حقيقيًا. احتفظ بنسخ احتياطية.

## النسخ الاحتياطي

بياناتك موجودة على هاتفك فقط. إذا ضاع الهاتف أو أُعيد ضبطه أو حُذف التطبيق، **فملف النسخة الاحتياطية هو الطريق الوحيد لاستعادتها**.

- **لإنشاء نسخة:** المزيد ← النسخ الاحتياطي والاستعادة ← اختر كلمة مرور للنسخة (8 أحرف على الأقل) ← **تشفير النسخة** ← **حفظ ملف النسخة** ← **حفظ في الملفات** (iCloud Drive مكان مناسب).
- **للاستعادة:** على هاتف جديد اختر **استعادة من نسخة احتياطية** في أول شاشة، ثم اختر الملف واكتب كلمة المرور.
- يذكّرك التطبيق بالنسخ الاحتياطي (كل 14 يومًا افتراضيًا).
- الملف مشفّر، وبدون كلمة المرور لا يستطيع أحد قراءته — ولا أنت — فاكتبها في مكان آمن.

## Siri ورسائل البنك (اختصارات iPhone)

**أولًا، حقيقة عن الآيفون:** لا يستطيع أي تطبيق قراءة رسائلك النصية أو أي رسائل أخرى على الآيفون — نظام iOS لا يسمح بذلك. مخطط المال يرى فقط النص الذي **تعطيه أنت** له: بالنسخ أو الكتابة أو الإملاء أو عبر اختصار تضبطه بنفسك.

**ثانيًا، قيد في الآيفون:** عندما يفتح الاختصار رابطًا يفتحه في **Safari** وليس في تطبيق الشاشة الرئيسية، ولكل منهما **تخزين منفصل**. لذلك الاختصارات التالية **تنسخ** النص، ثم تضغط أنت **إضافة من رسالة منسوخة** في التطبيق (ضغطة واحدة). يمسح التطبيق الحافظة بعد قراءتها. ولكل اختصار نسخة «رابط» تفتح عنوان التطبيق والنص بعد علامة `#` (لا يُرسل لأي خادم)؛ وفي Safari تعرض ما فهمه التطبيق مع زر **نسخ** للتطبيق المثبّت.

وفي الشاشة الرئيسية للتطبيق طريقتان أخريان: **إضافة من رسالة منسوخة** (اضغط مطولًا على رسالة البنك ← نسخ ← اضغط الزر) ومربع **الإضافة السريعة** (اكتب، أو اضغط 🎤 في لوحة المفاتيح وتكلّم).

### الاختصار 1 — «يا Siri، صرفت»

اعمل اختصارًا لكل لغة (الإملاء يستمع بلغة واحدة): سمِّ العربي **صرفت** والإنجليزي **Add expense**. الاسم هو ما تقوله لـ Siri.

1. افتح **الاختصارات** ← **+** (اختصار جديد) ← اضغط الاسم في الأعلى ← اكتب **صرفت**.
2. أضف **إملاء النص**. اضغط *اللغة* واختر العربية. واجعل *إيقاف الاستماع* **بعد التوقف المؤقت**.
3. أضف **نسخ إلى الحافظة** — المُدخل: **النص المُملى**.
4. أضف **إظهار إشعار** — النص: `تم النسخ — افتح مخطط المال واضغط «إضافة من رسالة منسوخة»`.
5. اضغط **تم**.

الاستخدام: قل **«يا Siri، صرفت»**، وانتظر حتى يستمع، ثم قل مثلًا **«اشتريت قهوة بـ 15 ريال»** أو **«دفعت إيجار 3000 جنيه»**. افتح مخطط المال ← **إضافة من رسالة منسوخة** ← راجع ← **تأكيد وحفظ**.

*نسخة الرابط (إذا كنت تستخدم التطبيق في Safari):* استبدل الخطوتين 3 و4 بـ **ترميز URL** (المُدخل: النص المُملى) ← **نص** `https://ahmedfouad-dentist.github.io/money-planner/#say=` يليه مباشرة متغير **النص المرمّز** ← **فتح عناوين URL**.

ما يفهمه التطبيق مثلًا: *«صرفت 50 باوند بنزين»*، *«قبضت المرتب 15 ألف ريال»*، *«صرفت ألفين جنيه على الكورس»*، *«صرفت 100 ريال امبارح غدا»*، *«سلفت أحمد 500 ريال»*، *«اتسلفت من محمد 2000 جنيه»*، *«محمد رجّعلي 200»*. العملات: ريال ← QAR، جنيه ← EGP، باوند/استرليني ← GBP، دولار ← USD (وغيرها)؛ وإذا لم تذكر عملة تُستخدم عملة مصروفاتك اليومية وتنبّهك شاشة التأكيد. وتُخمَّن الفئة من كلمات مثل قهوة وبنزين وإيجار.

### الاختصار 2 — «Bank SMS → Money Planner» والأتمتة

**الاختصار** (يستقبل رسالة البنك وينسخها):

1. **الاختصارات** ← **+** ← سمِّه **Bank SMS → Money Planner**.
2. أضف **إذا** — *مُدخل الاختصار* **يحتوي على** `OTP` ← وداخلها **إيقاف هذا الاختصار** ← (إنهاء إذا). *(أمان إضافي اختياري؛ التطبيق يرفض رسائل الرموز في كل الأحوال.)*
3. أضف **نسخ إلى الحافظة** — المُدخل: **مُدخل الاختصار**.
4. أضف **إظهار إشعار** — النص: `تم نسخ رسالة البنك — افتح مخطط المال واضغط «إضافة من رسالة منسوخة»`.
5. اضغط **تم**. (إذا سألك عن نوع المُدخل فاسمح بـ **النص**.)

**الأتمتة** (مرة واحدة — Apple لا تسمح بمشاركة الأتمتة، فكل شخص ينشئها بنفسه؛ والتطبيق يشرحها بالصور):

1. **الاختصارات** ← تبويب **الأتمتة** ← **+** ← **الرسالة**.
2. **المرسل**: اختر البنك. كثيرًا ما ترسل البنوك باسم وليس برقم؛ إذا لم يظهر البنك فاستخدم **الرسالة تحتوي على** مع كلمة من رسائل الشراء (مثل اسم البنك).
3. اختر **تشغيل فورًا** ← **التالي** ← **أتمتة فارغة جديدة**.
4. أضف **تشغيل الاختصار** ← اختر **Bank SMS → Money Planner** ← اضغط السهم واجعل *المُدخل* = **مُدخل الاختصار**.
5. اضغط **تم**.

من الآن فصاعدًا تُمرَّر فقط رسائل هذا المرسل (أو التي تحتوي على تلك الكلمة) — لا شيء غيرها. عند وصول رسالة افتح التطبيق واضغط **إضافة من رسالة منسوخة**.

### روابط التثبيت بلمسة واحدة (لمالك التطبيق، مرة واحدة)

1. اصنع الاختصارين على الآيفون كما بالأعلى.
2. في الاختصارات اضغط مطولًا على الاختصار ← **مشاركة** ← **نسخ رابط iCloud**. (الاختصارات لا تحتوي على بيانات شخصية — تأكد قبل المشاركة.)
3. الصق الروابط في [`js/config.js`](js/config.js) (`SHORTCUT_LINKS.siri` و`SHORTCUT_LINKS.bankSms`) وارفع التعديل. بعد النشر تظهر أزرار **تثبيت الاختصار** في التطبيق، وحتى ذلك الحين يعرض التطبيق الشرح خطوة بخطوة.

## السلف

المزيد ← **السلف**: سجّل ما **أقرضته** (عليه لك) أو **اقترضته** (عليك له) لكل شخص، بالمبلغ والعملة والتاريخ وموعد سداد اختياري وملاحظة. أضف دفعات جزئية فيتحدّث المتبقي، وتُعتبر السلفة مسددة عند اكتمال السداد (أو يدويًا). تعرض النظرة العامة إجمالي المستحق لك وإجمالي ما عليك بعملتك الرئيسية، وصافي الرصيد لكل شخص عبر كل سلفه. السلف المستحقة أو المتأخرة تظهر كتنبيه في الشاشة الرئيسية وعلامة على **المزيد**. زر **إرسال تذكير لطيف** يفتح نافذة المشاركة برسالة مهذبة ترسلها أنت بنفسك — التطبيق لا يرسل شيئًا من تلقاء نفسه.

صافي الثروة يشمل المستحق لك وما عليك. وكل هدف يخصم ما عليك للآخرين، ويضيف المستحق لك ما لم تلغِ اختيار **احتساب المبالغ المستحقة لي** في ذلك الهدف.

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

- بيانات التطبيق مشفّرة بـ **AES-256-GCM** ومخزّنة في IndexedDB على الموبايل.
- **من غير رقم سري (الافتراضي):** المفتاح عشوائي اتعمل على الموبايل والمتصفح بيحتفظ بيه بشكل محدش يقدر يطلّعه. التطبيق بيفتح على طول، فاللي بيحمي بياناتك من أي حد ماسك موبايلك هو **قفل الآيفون نفسه (الرقم أو Face ID)** — خلّي للموبايل رمز قفل.
- **برقم سري (اختياري، من الإعدادات ← حط رقم سري):** المفتاح بيتعمل من رقم سري من 4 أرقام عبر **PBKDF2-SHA-256 بـ 600,000 تكرار**، والتطبيق بيتقفل وهو بيفتح وبعد عدم الاستخدام. فيه 10,000 احتمال بس، فده بيمنع حد يمسك الموبايل، مش حد نسخ تخزين التطبيق.
- النسخ القديمة اللي كان فيها رقم سري إجباري بتسألك عليه مرة واحدة وبعدين بتشيله (وتقولك). أي رقم سري تحطه بنفسك بعد كده بيفضل.
- النسخ الاحتياطية ليها كلمة سر خاصة — خلّيها طويلة.
- سياسة أمان محتوى صارمة: لا أكواد إلا من التطبيق نفسه، والاتصال الخارجي الوحيد المسموح هو `open.er-api.com`. لا إحصاءات ولا أكواد خارجية.

</div>
