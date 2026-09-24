# 👑 AURUM — theme-able shaxsiy streaming web-app

Bitta faylli, premium dizaynli streaming ilova: **12 ta olam temasi** (Anime · Disney · Kino · Klassik),
YouTube player, yangiliklar lentasi, sevkli ro'yxat, profil va to'liq analitikali **Admin panel**.
Backend — Google Sheets + Apps Script, integratsiya — GitHub Pages va Telegram WebApp.

```
index.html   — foydalanuvchi ilovasi (responsive, PC + smartphone)
admin.html   — Command Center (CRUD + grafiklar + Telegram broadcast)
code.gs      — Google Apps Script backend (Sheets DB + Telegram auth HMAC)
```

---

## 1. GitHub Pages'ga chiqarish (2 daqiqa)

1. Yangi repository oching (`AURUM`), 3 ta faylni tashlang: `index.html`, `admin.html`, `code.gs`
2. **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**
3. Sayt: `https://USERNAME.github.io/AURUM/` — admin: `.../AURUM/admin.html`

> Ilova API'siz ham to'liq ishlaydi (demo kontent + localStorage). Backend qo'shgach jonli bo'ladi.

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
5. Birinchi `bootstrap` so'rida `AURUM DB` nomli Spreadsheet avtomatik yaratiladi
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
   WebApp URL: `https://USERNAME.github.io/AURUM/`
3. Botga `/start` o'rniga havola orqali kirilsa `window.Telegram.WebApp` avtomatik aniqlanadi:
   - Fullscreen expand, header/footer tema rangga moslanadi
   - **Auth:** `initData` Apps Script'ga borib HMAC-SHA256 (`WebAppData` kaliti) bilan tekshiriladi —
     soxta login imkonsiz, foydalanuvchi `Users` jadvaliga tushadi
   - Profil → Telegram tugmasi, share tugmasi, theme quick-button ham Telegram ichida ishlaydi

## 4. Temalar (12 ta olam)

Profil → **🎨 Temalar do'koni** — tanlanganda butun ilova o'zgaradi:

| Kategoriya | Temalar | Nima o'zgaradi |
|---|---|---|
| 🌸 Anime | Naruto · Solo Leveling · Ruhlar olami | fon gradienti + barg/neon/tushdan zarrachalar (canvas), shrift (Shippori Mincho, Orbitron, Zen Maru), tugma burchaklari, glow, karta animatsiyasi |
| 🏰 Disney | Frozen · Elemental · Zootopia | yorug' rejim, qor/alanga/konfetti particles, Quicksand/Fredoka, yumaloq kartalar |
| 🎬 Kino | Avengers · Harry Potter · Titanic | Bebas/Cinzel/Playfair, uchqun/sehr-yulduz animatsiyalari, kinolikka xos palitra |
| ⚪ Klassik | Yorug' · Tun · Terminal | minimal Inter / JetBrains Mono, particles o'chgan holda tejamkor |

Sozlamalar: `Animatsiyalar` switch'i barcha harakatlarni o'chiradi (tejamkorlik/prefers-reduced-motion uchun).

## 5. Admin panel imkoniyatlari

- **Dashboard:** 6 ta KPI, 14 kunlik aktivlik grafigi, kategoriya donut', tema reytingi, jonli hodisalar oqimi
- **Videolar / Yangiliklar:** qidiruv + filtr + CRUD, status (active/draft), featured boshqaruvi
- **Foydalanuvchilar:** Telegram profillar, rol (user/vip/tester), bloklash
- **Temalar analitikasi:** tanlovlar, ushlab turish %, trend
- **E'lonlar:** Telegram broadcast (sarlavha + matn + inline tugma), test-rejim, tarix
- **Sozlamalar:** API/token/chat, JSON import/export, Sheets'ga push/pull
- API ulanmagan bo'lsa avtomatik **DEMO rejim** — hammasi brauzerda, grafiklar butun boshli ko'rsatiladi

## 6. Lokal ishga tushirish

```bash
git clone <repo> && cd AURUM
python -m http.server 8080   # yoki faylni shunchaki brauzerda oching
```

## 7. Xavfsizlik eslatmalari

- `ADMIN_TOKEN` hech qachon GitHub'ga commit qilinmasin — admin.html uni faqat localStorage'da saqlaydi
- `BOT_TOKEN` faqat Apps Script *Script Properties* ichida yashaydi (web sahifaga chiqmaydi)
- Telegram auth server tomonida tekshiriladi (HMAC + 16 soatlik `auth_date` oynasi)

---
© AURUM · HTML + CSS + JS, noldan qurilgan build-free loyiha · GitHub · Google Sheets · Apps Script · Telegram
