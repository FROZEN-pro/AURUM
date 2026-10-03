# Backend Deployment Log — v2.9.5

**Date:** 2026-10-02, 4:57 PM
**Status:** ✅ Deployed and verified live

---

## What changed since the v2.9.4 log

The earlier `DEPLOYMENT_v2.9.4` log recorded a Version 16 republish that carried
**no backend code changes** — the deployed Apps Script still held the old ~808-line
`code.gs`. That is why the frontend fixes were not reflected in the running app.
This v2.9.5 deployment corrects that: the full 863-line backend was written into the
Apps Script editor and published as a new version.

## Google Apps Script (web app)

- **Project:** IPLUS MEDIA (ex-AURUM)
- **Version deployed:** Version 17 — Oct 2, 2026, 4:57 PM (previous: Version 16)
- **Deployment ID:** `AKfycbysfIFbYeJIE5eaINhc2BElTQd96zMvFRAR6wUvTFSHQMjod-6PGNg4m4m5UZgQ7Socaw`
- **Web App URL (unchanged):** https://script.google.com/macros/s/AKfycbysfIFbYeJIE5eaINhc2BElTQd96zMvFRAR6wUvTFSHQMjod-6PGNg4m4m5UZgQ7Socaw/exec
- **Execute as:** Me (owner) · **Access:** Anyone
- **Description:** "v2.9.5 - Backend: image-only support chat, admin users.list/update/detail, per-user support chat (adminList/list/reply), series/episode fields, syntax fixes"

The existing deployment was **edited** (not recreated), so the `/exec` URL and
Deployment ID are stable — no frontend endpoint changes were required.

## Backend content now live (code.gs @ Version 17)

- `SCHEMA.Videos` includes `seriesId`, `episode`, `season`, `seriesTitle`.
- `SCHEMA.Messages`: `['id','fromId','toId','text','type','mediaUrl','ts','read']`.
- `support.send` accepts **image-only** messages: guard is now
  `if (!text && !media) return {ok:false, error:'matn yoki rasm kerak'}`.
- `handleAdmin_` (guarded by `adminAuth_`) adds ops: `users.list`, `users.update`,
  `users.detail`, `support.adminList`, `support.list`, `support.reply`.

## Deployment process

1. Opened the correct Apps Script project editor.
2. Replaced stale code with the repo `code.gs` (863 lines) via the editor and saved.
3. Deploy → Manage deployments → Edit the active web-app deployment.
4. Set Version = "New version" → Deploy → confirmed "Version 17 on Oct 2, 2026, 4:57 PM".

## Verification performed

Live HTTP `POST` against `/exec` (same-origin from the editor):

| Test | Payload | Response | Meaning |
|------|---------|----------|---------|
| Image-only send | `{action:'social',op:'support.send',uid:...,mediaUrl:'…',text:''}` | `{ok:true, id:"msg_…"}` | New behavior: image without text is accepted |
| Empty send | `{action:'social',op:'support.send',uid:...,text:'',mediaUrl:''}` | `{ok:false, error:"matn yoki rasm kerak"}` | New v2.9.5 error string (old build said "matn kerak") |

These two responses prove `/exec` is serving Version 17 (the fixed backend), not the
old Version 16.

## Verification NOT performed (honest limits)

- Admin ops (`users.list`, `support.adminList`, `support.reply`) are **deployed in code**
  but were **not exercised end-to-end over HTTP**, because `handleAdmin_` returns
  `unauthorized` before the switch unless a valid `ADMIN_TOKEN` is supplied. The token
  lives in Script Properties and was intentionally not read or used here. Confirm these
  through the admin panel UI or a token-bearing request.
- The verification `support.send` probe wrote **one test row** into the `Messages` sheet
  (`id: msg_muqwte1ih77n`, `fromId: verify_probe_uid`). It should be deleted from the
  database; it is admin-panel-visible only, not user-facing.

## Current system state

| Component | Version | Status | Location |
|-----------|---------|--------|----------|
| Frontend (user app) | v2.9.4 | Live | https://frozen-pro.github.io/AURUM/ (commit eab4394) |
| Frontend (admin panel) | v2.9.4 | Live | https://frozen-pro.github.io/AURUM/admin.html |
| Backend (Apps Script) | v2.9.5 / Version 17 | Live | /exec URL above |
| Database | Google Sheets | Active | Sheet ID in Script Properties |
| Telegram Bot | Active | Running | BOT_TOKEN property |

## Note on repo HEAD

After publishing Version 17, a temporary cleanup helper was added to the editor for a
delete attempt, then **removed** and the editor re-saved. Repo `code.gs` and the editor
HEAD are both the clean 863-line version.
