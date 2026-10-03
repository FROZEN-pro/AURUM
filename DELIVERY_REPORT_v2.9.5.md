# IPLUS MEDIA v2.9.5 — Delivery Report (corrected)

**Date:** 2026-10-02
**Frontend commit:** eab4394 (main) · **Backend:** Apps Script Version 17 (v2.9.5)
**Live URL:** https://frozen-pro.github.io/AURUM/

> This document **supersedes `DELIVERY_REPORT_v2.9.4.md`**, which contained inaccurate
> claims. The main correction: that report stated the backend fixes were "already
> deployed" — they were not. Version 16 carried old code. The backend was actually
> published as **Version 17** on 2026-10-02 and verified live. It also marked
> series-management and the admin-users-panel as "Not Started / Not Investigated";
> both were in fact implemented and are now backed by the deployed backend.

---

## Requested items and final state

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Modernize icons (emoji → SVG) | Done in user app | `.ic-svg` CSS + `<symbol>` sprite + `ic()` helper in index.html |
| 2 | Fix Tomosha tarixi (watch history) | Done | `addToWatchHistory()` persisted via `LS` in index.html |
| 3 | Fix Qurilmalarim (My Devices) | Done | device detect + register + render in index.html |
| 4 | Image-only send in support chat | Done & **verified live** | POST returns `{ok:true}` for image-with-no-text |
| 5 | Admin per-user support chat | Implemented | admin.html `support.adminList`/`list`/`reply`; backend ops in v17 |
| 6 | Series/episode management (admin) | Implemented | admin.html series fields @903-904 + badge @639; `SCHEMA.Videos` cols in v17 |
| 7 | Fullscreen → landscape + hide header | Done | `enterFsChrome()` on both real-FS and pseudo-FS paths |
| 8 | Fix admin users panel (not showing users) | Implemented | admin.html `api('users.list')` @772; `users.list` op in v17 |
| 9 | Deploy backend so app reflects changes | Done & **verified** | Version 17 live at unchanged /exec |
| 10 | Senior-engineer report | This document | — |

## Icon system — correct details

The prior report mis-stated the helper. Actual implementation:

```javascript
const ic = (n, cls='') => `<svg class="ic-svg${cls?' '+cls:''}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
```

Symbols use the `#i-*` id scheme (not `#icon-*`). Sprite + base `.ic-svg` CSS plus
per-context sizing were added; the player, cards, nav bar, and profile rows render
icons via `ic(...)`. Where a control toggles state, classList (`.on`) drives the
active fill/color rather than re-writing text (this also fixed a bug where a
button's `innerHTML` icon was being clobbered by `textContent`).

## Fullscreen behavior

`enterFsChrome()` centralizes the side-effects and is invoked on **both** the native
Fullscreen API path and the CSS pseudo-fullscreen fallback:
- `screen.orientation.lock('landscape')` (best-effort, wrapped — rejects on unsupported
  browsers)
- `Telegram.WebApp.setHeaderColor('#000000')` + `setBackgroundColor('#000000')` to hide
  the header
- On `fullscreenchange` exit: removes `.fs`, `orientation.unlock()`, resets header colors.

## Backend ops now live (Version 17)

- `support.send` — text OR media accepted; rejects only when both empty.
- `handleAdmin_` (requires `ADMIN_TOKEN`): `users.list`, `users.update`, `users.detail`,
  `support.adminList`, `support.list`, `support.reply`.
- `SCHEMA.Videos` extended with `seriesId`, `episode`, `season`, `seriesTitle`; new
  columns are appended to existing sheets without destroying data.

## What was verified vs. not (no over-claiming)

**Verified:**
- Backend Version 17 is live: image-only `support.send` returns `{ok:true}`; empty send
  returns the new `"matn yoki rasm kerak"` string (old build said `"matn kerak"`).
- Frontend is served from GitHub Pages (commit eab4394).

**Not end-to-end verified:**
- Admin ops and the admin support/users UI: `handleAdmin_` short-circuits to
  `unauthorized` without a valid `ADMIN_TOKEN`, which was deliberately not used. These
  are confirmed present in the deployed code and correctly wired in admin.html, but the
  response was not observed through an authenticated call. Validate via the admin panel.
- iOS Safari orientation lock (needs a physical device).

## Housekeeping

- The live-backend verification probe wrote one test row into `Messages`
  (`id: msg_muqwte1ih77n`, `fromId: verify_probe_uid`). Delete it from the DB; it is only
  visible in the admin support list.
- Apps Script editor HEAD was restored to the exact clean 863-line `code.gs` after a
  temporary helper was used and removed; deployed Version 17 predates that helper and is
  unaffected.

## Security posture

- `ADMIN_TOKEN` / `BOT_TOKEN` remain in Script Properties, never in the repo.
- `OWNERS = ['858310974','2004566289']`; admin routes gated by `adminAuth_`.
- User input escaped via `esc()`; Telegram `initData` HMAC validation retained.
