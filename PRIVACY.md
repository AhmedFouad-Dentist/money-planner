# Privacy · الخصوصية

[العربية ↓](#بالعربية)

## In plain English

**Your data stays on your phone.** Money Planner has no server, no account and no sign-in. Everything you type — transactions, goals, investments, balances, notes — is saved only inside the app's storage on your device, encrypted with your PIN.

**Nobody else can see it.** Not the app's author, not GitHub (which only hosts the app's files), not anyone else. The app contains no analytics, no ads, no tracking and no code from other companies.

### Bank text messages (SMS)

When you paste a bank message, or send one with an iPhone Shortcut:

- **Kept:** only the **amount**, **currency**, **merchant** (shop name, or who sent/received money) and **date** — plus whether it was money in or out. You see these on a confirm screen and can change them before saving.
- **Removed before anything is read:** card numbers, account numbers, IBANs, phone numbers, long reference numbers, **balances** and **credit limits**.
- **Thrown away:** the message text itself. It is never saved, never backed up, never sent anywhere.
- **Refused completely:** any message that mentions a one-time password, verification code, OTP, "رمز التحقق", "كلمة مرور لمرة واحدة" or similar. These are not read or kept at all. Never share such codes with anyone.
- If a Shortcut opens the app with the message in the web address, it's placed after the `#` sign — browsers never send that part to any server. The app removes it from the address bar straight away. (Safari might still list the visit in its History.)
- If you use the copy-and-paste Shortcut, the full message sits on your phone's clipboard until you paste it into the app; the app clears the clipboard after reading it.

### The only time the app goes online

- **Loading/updating the app** from GitHub Pages (just the app's own files).
- **"Update rates online" — only if you tap it.** The app asks `open.er-api.com` for today's exchange rates against your main currency. The only thing in that request is a 3-letter currency code like `QAR`. No amounts, no data about you. Like every website, that service can see your internet (IP) address.

### Backups

Backups are files **you** create and save (for example to Files or iCloud Drive). They are encrypted with a password you choose. Without that password nobody can open them — including you, so keep it safe. If you save a backup to iCloud, Apple stores that encrypted file like any other file of yours.

### Your control

- **Erase everything:** More → Settings → Erase all data.
- Removing the app from the Home Screen also removes its data — make a backup first.
- If you forget your PIN, the data cannot be recovered; erase and restore your latest backup.

### Not advice

Money Planner only records and adds up your numbers. It does not give financial, investment or tax advice.

---

<div dir="rtl" lang="ar">

<a id="بالعربية"></a>

## بالعربية وببساطة

**بياناتك تبقى على هاتفك.** لا يوجد خادم ولا حساب ولا تسجيل دخول. كل ما تكتبه — المعاملات والأهداف والاستثمارات والأرصدة والملاحظات — يُحفظ فقط داخل تخزين التطبيق على جهازك، مشفّرًا بالرمز السري الخاص بك.

**لا أحد غيرك يستطيع رؤيتها.** لا مطوّر التطبيق، ولا GitHub (الذي يستضيف ملفات التطبيق فقط)، ولا أي جهة أخرى. لا يحتوي التطبيق على إحصاءات أو إعلانات أو تتبّع أو أكواد من شركات أخرى.

### رسائل البنك (SMS)

عندما تلصق رسالة من البنك أو ترسلها عبر اختصار iPhone:

- **ما نحتفظ به:** **المبلغ** و**العملة** و**التاجر** (اسم المحل أو مرسل/مستلم المال) و**التاريخ** فقط — بالإضافة إلى هل هي دخل أم مصروف. تراها في شاشة تأكيد ويمكنك تعديلها قبل الحفظ.
- **ما يُحذف قبل أي قراءة:** أرقام البطاقات والحسابات والآيبان وأرقام الهواتف وأرقام المرجع الطويلة و**الأرصدة** و**حدود الائتمان**.
- **ما يُتخلّص منه:** نص الرسالة نفسه. لا يُحفظ أبدًا، ولا يدخل في النسخ الاحتياطية، ولا يُرسل لأي مكان.
- **ما يُرفض تمامًا:** أي رسالة تذكر كلمة مرور لمرة واحدة أو رمز تحقق أو OTP أو «رمز التحقق» أو «كلمة مرور لمرة واحدة» أو ما يشبهها. لا تُقرأ ولا تُحفظ إطلاقًا. لا تشارك هذه الرموز مع أي شخص.
- إذا فتح اختصارٌ التطبيقَ والرسالة داخل الرابط، فهي توضع بعد علامة `#` — وهذا الجزء لا يرسله المتصفح لأي خادم. يحذفه التطبيق من شريط العنوان فورًا. (قد يظل Safari يعرض الزيارة في سجل التصفح.)
- في اختصار النسخ واللصق تبقى الرسالة كاملة في حافظة هاتفك حتى تلصقها في التطبيق، ثم يمسح التطبيق الحافظة بعد قراءتها.

### المرات الوحيدة التي يتصل فيها التطبيق بالإنترنت

- **تحميل التطبيق أو تحديثه** من GitHub Pages (ملفات التطبيق فقط).
- **«تحديث الأسعار عبر الإنترنت» — فقط إذا ضغطت عليه.** يطلب التطبيق من `open.er-api.com` أسعار الصرف مقابل عملتك الرئيسية. لا يحتوي الطلب إلا على رمز عملة من 3 أحرف مثل `QAR`. لا مبالغ ولا بيانات عنك. وكأي موقع، يمكن لهذه الخدمة رؤية عنوان IP الخاص بك.

### النسخ الاحتياطية

النسخ الاحتياطية ملفات **أنت** تنشئها وتحفظها (مثلًا في «الملفات» أو iCloud Drive)، وهي مشفّرة بكلمة مرور تختارها. بدونها لا يستطيع أحد فتحها — ولا أنت، فاحفظها في مكان آمن.

### التحكم بيدك

- **لمسح كل شيء:** المزيد ← الإعدادات ← مسح كل البيانات.
- حذف التطبيق من الشاشة الرئيسية يحذف بياناته أيضًا — اعمل نسخة احتياطية أولًا.
- إذا نسيت الرمز السري فلا يمكن استرجاع البيانات؛ امسحها واستعد آخر نسخة احتياطية.

### ليست نصيحة

مخطط المال يسجّل أرقامك ويجمعها فقط، ولا يقدّم نصائح مالية أو استثمارية أو ضريبية.

</div>
