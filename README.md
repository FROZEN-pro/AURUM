# 👑 IPLUS MEDIA — theme-able shaxsiy streaming web-app

Bitta faylli, premium dizaynli streaming ilova: **12 ta olam temasi** (Anime · Disney · Kino · Klassik),
**custom YouTube pleyer** (seek, tezlik, ±10s, avto-kechiktirish, keyingi video), real-vaqt **layk** va
**izoh (komment)** tizimi, yangiliklar lentasi, sevkli ro'yxat, profil va to'liq analitikali **Admin panel**.
Backend — Google Sheets + Apps Script, integratsiya — GitHub Pages va Telegram WebApp.

```
index.html   — foydalanuvchi ilovasi (responsive, PC + smartphone, custom player, layk + izoh)
admin.html   — Command Center (faqat REAL ma'lumot: CRUD + toploader + moderatsiya + analitika)
code.gs      — Google Apps Script backend v2 (Sheets DB + Telegram auth HMAC + layk/izoh API)
```

> ⚠️ **code.gs yangilangan versiyasi chiqqanda:** Apps Script'da kodni qayta paste qilib
> **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** bo'lishi shart.
> Aks holda eski versiya xizmat qilaveradi (`admin ping` javobida `version:"v2"` bo'lmasa — deploy qilinmagan).

---

## 1. GitHub Pages'ga chiqarish (2 daqiqa)

1. Yangi repository oching (`IPLUS MEDIA`), 3 ta faylni tashlang: `index.html`, `admin.html`, `code.gs`
2. **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**
3. Sayt: `https://USERNAME.github.io/IPLUS MEDIA/` — admin: `.../IPLUS MEDIA/admin.html`

> Ilovada hech qanday demo/test ma'lumot yo'q — kontent faqat backend'dan keladi.
> Kontent bo'lmasa: «Hali videolar yo'q» holati ko'rsatiladi.

## 2. Google Sheets + Apps Script backend

1. [script.google.com](https://script.google.com) → **New project** → `code.gs` mazmunini paste qiling
2. **Project Settings → Script Properties** ga qo'shing:

   | Property | Ma'no |
   |---|---|
   | `BOT_TOKEN` | BotFather'dan olgan bot token |
   | `ADMIN_TOKEN` | O'zingiz uylagan uzun tasodifiy qator (admin panel kirishi uchun) |
   | `BROADCAST_CHAT` | E'lon yuboriladigan kanal/group `chat_id` (`-100…`) |
   | `OWNER_CHAT` | Sizning Telegram ID (test xabarlar uchun) |
   | `APP_URL` | Ilova havolasi (e'lon tugmasi uchun) |

3. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone**
4. `/exec` URL oling va:
   - `index.html` → `window.APP_CONFIG.API_URL` ga
   - `admin.html` → Sozlamalar bo'limiga yozing
5. Birinchi `bootstrap` so'rida `IPLUS MEDIA DB` nomli Spreadsheet avtomatik yaratiladi
   (jadvallar: **Videos · News · Users · Events · Settings · Announcements**).

### Video qo'shish (Admin panel)
Videolar → **＋ Yangi video** → YouTube **linkini to'liq qo'ying** (`https://www.youtube.com/watch?v=…`,
`https://youtu.be/…`, `shorts`, `embed` — ID avtomatik ajratiladi) yoki faqat ID kiriting.
`Featured` belgilanganlar Home'dagi hero-slider'ga chiqadi.
Shuningdek, ilovadagi **qidiruv paneliga** linkni qo'yib Enter bossangiz — video darhol player'da ochiladi.

> ⚠️ **Muhim — "private" videolar:** Player `www.youtube.com/embed` ishlatadi (cookie'li), shuning uchun
> videoning **egasi login bo'lgan brauzerda** private videolar ham o'ynaydi.
> Lekin boshqa foydalanuvchilar private videolarni ko'ra OL MAYDI (YouTube cheklovi) —
> ular uchun videolarni **Unlisted** qiling: hech kim topa olmaydi, lekin hamma havola orqali ko'radi.

## 3. Telegram WebApp sifatida

1. **@BotFather** → `/newbot` → token oling (yoki mavjud bot)
2. Bot sozlamalari: `/setdomain` yoki BotFather → *Bot Settings → Menu Button* →
   WebApp URL: `https://USERNAME.github.io/IPLUS MEDIA/`
3. Botga havola orqali kirilganda `window.Telegram.WebApp` avtomatik aniqlanadi:
   - **Avtomatik kirish:** ism yozish kerak emas — `initData` Apps Script'ga borib
     HMAC-SHA256 (`WebAppData` kaliti, 16 soatlik `auth_date` oynasi) bilan tekshiriladi,
     foydalanuvchi `Users` jadvaliga tushadi va uning `tg<id>` identifikatori layk/izohlarda ishlatiladi
   - Fullscreen expand, header rang temaga moslanadi, 🎨 Tema tugma Telegram header'da
   - Ilova tashqarisida (oddiy brauzerda) ham ishlaydi — qurilmaviy `u<id>` ishlatiladi,
     keyin Telegram orqali kirsa layk/izohlar shu hisobga o'tadi
4. **Admin panelni botga ulash:** BotFather → *Bot Settings → Menu Button* → URL:
   `https://USERNAME.github.io/IPLUS MEDIA/admin.html#tok=ADMIN_TOKENINGIZ`
   — panel token'siz ochiladi (token hash orqali uzatiladi, localStorage'da saqlanadi).
   Oddiy foydalanuvchilarga admin panel **hech qayerda ko'rinmaydi** (Profil'dagi havola
   faqat `role=admin` larda chiqadi).

## 4. Temalar (12 ta olam)

Profil → **🎨 Temalar do'koni** — tanlanganda butun ilova o'zgaradi:

| Kategoriya | Temalar | Nima o'zgaradi |
|---|---|---|
| 🌸 Anime | Naruto · Solo Leveling · Ruhlar olami | fon gradienti + barg/neon/tushdan zarrachalar (canvas), shrift (Shippori Mincho, Orbitron, Zen Maru), tugma burchaklari, glow, karta animatsiyasi |
| 🏰 Disney | Frozen · Elemental · Zootopia | yorug' rejim, qor/alanga/konfetti particles, Quicksand/Fredoka, yumaloq kartalar |
| 🎬 Kino | Avengers · Harry Potter · Titanic | Bebas/Cinzel/Playfair, uchqun/sehr-yulduz animatsiyalari, kinolikka xos palitra |
| ⚪ Klassik | Yorug' · Tun · Terminal | minimal Inter / JetBrains Mono, particles o'chgan holda tejamkor |

Sozlamalar: `Animatsiyalar` switch'i barcha harakatlarni o'chiradi (tejamkorlik/prefers-reduced-motion uchun).

## 5. Admin panel imkoniyatlari (v2 — faqat REAL ma'lumot)

- **Dashboard:** 7 ta KPI (hodisalar, play, foydalanuvchi+faollik, layklar, izohlar, videolar, yangiliklar),
  14 kunlik play/login grafigi, hodisa donut'i, tema reytingi, **top-30 video jalb jadvali**, jonli oqim
- **Videolar:** qidiruv + filtr + CRUD, status (active/draft), featured, **📥 Toploader** —
  bir nechta YouTube linkni darhol import qilish (oEmbed orqali sarlavha avtomatik, `tavsif:` qo'shib yozish mumkin)
- **Yangiliklar:** CRUD, HOT, status
- **Moderatsiya:** barcha izohlarni ko'rish/qidirish/filtr (video bo'yicha) va o'chirish; layklar ro'yxati + o'chirish
- **Foydalanuvchilar:** qidiruv/rol filtri, rol almashtirish (user/vip/admin), bloklash, o'chirish
- **E'lonlar:** Telegram broadcast (kanal + test), tarix Sheets'dan
- **Sozlamalar:** API/token, ping (backend `version:"v2"` ekanini tekshiradi), JSON backup, event tarixini tozalash
- Hech qanday demo/seed ma'lumot yo'q — token noto'g'ri bo'lsa panel umuman kirmaydi
- Ma'lumotlar har **30 soniyada** avtomatik yangilanadi

## 6. Lokal ishga tushirish

```bash
git clone <repo> && cd IPLUS MEDIA
python -m http.server 8080   # yoki faylni shunchaki brauzerda oching
```

## 7. Xavfsizlik eslatmalari

- `ADMIN_TOKEN` hech qachon GitHub'ga commit qilinmasin — admin.html uni faqat localStorage'da saqlaydi
- `BOT_TOKEN` faqat Apps Script *Script Properties* ichida yashaydi (web sahifaga chiqmaydi)
- Telegram auth server tomonida tekshiriladi (HMAC + 16 soatlik `auth_date` oynasi)

---
© IPLUS MEDIA · HTML + CSS + JS, noldan qurilgan build-free loyiha · GitHub · Google Sheets · Apps Script · Telegram
