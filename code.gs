/**
 * =============================================================
 *  AURUM · Google Apps Script Backend (code.gs)
 *  GitHub-dagi index.html / admin.html shu fayl bilan ishlaydi.
 *
 *  SOZLASH (2 daqiqa):
 *  1. script.google.com → yangi loyiha → shu faylni Copy/Paste
 *  2. Project Settings → Properties → quyidagilarni qo’shing:
 *        BOT_TOKEN   = 123456:ABC-...   (BotFather)
 *        ADMIN_TOKEN = o’zingiz uzoq tasodifiy satr
 *        BROADCAST_CHAT = -1001234567890 yoki @kanal (ixtiyoriy)
 *  3. Deploy → New deployment → Web app
 *        Execute as: Me   ·   Who has access: Anyone
 *  4. Olingan /exec URL ni index.html va admin.html’dagi
 *     APP_CONFIG.API_URL ga yozing.
 *
 *  Google Sheets DB avtomatik yaratiladi (jadval: Videos, News,
 *  Users, Events, Settings, Announcements).
 * =============================================================
 */

var PROPS = PropertiesService.getScriptProperties();

/* ---------- Sheet yordamchilari ---------- */
function getSS_() {
  var id = PROPS.getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : null;
  if (!ss) {
    ss = SpreadsheetApp.create('AURUM DB');
    PROPS.setProperty('SHEET_ID', ss.getId());
  }
  return ss;
}
var SCHEMA = {
  Videos:        ['id','yt','title','cat','dur','views','featured','desc','status','createdAt'],
  News:          ['id','title','cat','src','time','read','hot','emoji','body','status','createdAt'],
  Users:         ['id','tg','name','role','theme','sessions','last','status','createdAt'],
  Events:        ['ts','userId','event','itemId','theme','meta'],
  Settings:      ['key','value'],
  Announcements: ['ts','title','body','button','sent']
};
function sheet_(name) {
  var ss = getSS_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SCHEMA[name]);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function rows_(name) {
  var sh = sheet_(name), v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = v[i][j];
    if (o.ts && typeof o.ts === 'object') o.ts = +new Date(o.ts);
    if (o.createdAt && typeof o.createdAt === 'object') o.createdAt = +new Date(o.createdAt);
    out.push(o);
  }
  return out;
}
function findRow_(name, key, val) {
  var sh = sheet_(name), head = SCHEMA[name], col = head.indexOf(key) + 1;
  if (col < 1) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(val)) return i + 2;
  return null;
}
function upsert_(name, obj) {
  var sh = sheet_(name), head = SCHEMA[name];
  var key = head[0]; // 'id' yoki 'ts'
  var kv = obj[key] != null ? obj[key] : (key === 'ts' ? Date.now() : 'x' + Date.now());
  var r = findRow_(name, key, kv);
  var line = head.map(function (h) { return obj[h] != null ? obj[h] : ''; });
  if (r) sh.getRange(r, 1, 1, head.length).setValues([line]);
  else sh.appendRow(line);
  return kv;
}
function delRow_(name, key, val) {
  var r = findRow_(name, key, val);
  if (r) sheet_(name).deleteRow(r);
  return !!r;
}
function setSetting_(k, v) {
  var r = findRow_('Settings', 'key', k);
  var sh = sheet_('Settings');
  if (r) sh.getRange(r, 2).setValue(v); else sh.appendRow([k, v]);
}
function getSetting_(k, dflt) {
  var r = findRow_('Settings', 'key', k);
  if (!r) return dflt;
  var v = sheet_('Settings').getRange(r, 2).getValue();
  return v === '' ? dflt : v;
}

/* ---------- JSON javob (CORS) ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Router ---------- */
function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || 'ping';
  if (a === 'bootstrap') return json_({ ok: true, videos: active_(rows_('Videos')), news: active_(rows_('News')),
    settings: { notice: getSetting_('notice', ''), app: 'AURUM' } });
  if (a === 'ping') return json_({ ok: true, demo: false, name: 'AURUM backend', sheets: getSS_.getName(), t: Date.now() });
  return json_({ ok: false, error: 'nodoma action' });
}
function active_(arr) {
  return arr.filter(function (x) { return !x.status || x.status === 'active'; })
    .map(function (x) { if (x.featured != null) x.featured = (x.featured === 1 || x.featured === '1' || x.featured === true) ? 1 : 0;
      if (x.hot != null) x.hot = (x.hot === 1 || x.hot === '1' || x.hot === true) ? 1 : 0; return x; });
}

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'JSON buzilgan' }); }
  switch (d.action) {
    case 'track':    return handleTrack_(d);
    case 'auth':     return handleAuth_(d);
    case 'admin':    return handleAdmin_(d);
    default:         return json_({ ok: false, error: 'action topilmadi: ' + d.action });
  }
}

/* ---------- Hodisalarni yozish ---------- */
function handleTrack_(d) {
  sheet_('Events').appendRow([d.ts || Date.now(), d.userId || 'guest', d.event || '?', d.itemId || '', d.theme || '', String(d.meta || '').slice(0, 300)]);
  // user faollik statistikasini yangilash
  if (d.userId && d.userId !== 'guest') {
    var r = findRow_('Users', 'id', d.userId);
    if (r) {
      var sh = sheet_('Users');
      sh.getRange(r, SCHEMA.Users.indexOf('last') + 1).setValue(Date.now());
      if (d.event === 'login') {
        var s = +sh.getRange(r, SCHEMA.Users.indexOf('sessions') + 1).getValue() || 0;
        sh.getRange(r, SCHEMA.Users.indexOf('sessions') + 1).setValue(s + 1);
      }
    }
  }
  return json_({ ok: true });
}

/* ---------- Telegram WebApp initData tekshiruvi (HMAC-SHA256) ---------- */
function handleAuth_(d) {
  var token = PROPS.getProperty('BOT_TOKEN');
  if (!token) return json_({ ok: false, error: 'BOT_TOKEN sozlanmagan' });
  if (!verifyInitData_(d.initData || '', token)) return json_({ ok: false, error: 'initData imzosi tasdiqlanmadi' });
  var u = parseInitUser_(d.initData || '');
  if (!u || !u.id) return json_({ ok: false, error: 'foydalanuvchi topilmadi' });
  var uid = 'tg' + u.id;
  var r = findRow_('Users', 'id', uid);
  var role = r ? sheet_('Users').getRange(r, SCHEMA.Users.indexOf('role') + 1).getValue() : 'user';
  if (!r) sheet_('Users').appendRow([uid, u.username || '', [u.first_name, u.last_name].filter(Boolean).join(' '), role, '', 1, Date.now(), 'active', Date.now()]);
  return json_({ ok: true, user: { id: uid, name: [u.first_name, u.last_name].filter(Boolean).join(' '), username: u.username || '', role: role } });
}
function parseInitUser_(initData) {
  var p = parseQS_(initData);
  try { return JSON.parse(p.user || 'null'); } catch (e) { return null; }
}
function parseQS_(s) {
  var o = {};
  String(s).split('&').forEach(function (kv) {
    var i = kv.indexOf('=');
    if (i > 0) { try { o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) {} }
  });
  return o;
}
function verifyInitData_(initData, botToken) {
  if (!initData) return false;
  var params = parseQS_(initData);
  var hash = params.hash; delete params.hash;
  if (!hash) return false;
  var dataCheckString = Object.keys(params).sort()
    .map(function (k) { return k + '=' + params[k]; }).join('\n');
  var secret = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  var calc = Utilities.computeHmacSha256Signature(dataCheckString, secret)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (calc !== hash) return false;
  // auth_date 16 soatdan yangi bo’lsin (replay hujumga qarshi)
  var age = Date.now() / 1000 - (+params.auth_date || 0);
  return age < 16 * 3600;
}

/* ---------- Admin API ---------- */
function handleAdmin_(d) {
  var tok = PROPS.getProperty('ADMIN_TOKEN');
  if (!tok || d.token !== tok) return json_({ ok: false, error: 'unauthorized' });
  switch (d.op) {
    case 'ping':  return json_({ ok: true, t: Date.now() });
    case 'pull':  return json_({ ok: true, data: { videos: rows_('Videos'), news: rows_('News'),
                          users: rows_('Users'), events: rows_('Events').slice(-3000),
                          announcements: rows_('Announcements') } });
    case 'push':  return handlePush_(d);
    case 'videos.save':   upsert_('Videos', Object.assign({ createdAt: Date.now() }, d.item)); return json_({ ok: true });
    case 'videos.delete': delRow_('Videos', 'id', d.id); return json_({ ok: true });
    case 'news.save':     upsert_('News', Object.assign({ createdAt: Date.now() }, d.item)); return json_({ ok: true });
    case 'news.delete':   delRow_('News', 'id', d.id); return json_({ ok: true });
    case 'users.save':    upsert_('Users', d.item || {}); return json_({ ok: true });
    case 'settings.save': setSetting_(d.key, d.value); return json_({ ok: true });
    case 'stats':
      var ev = rows_('Events');
      return json_({ ok: true, stats: { total: ev.length, byEvent: countBy_(ev, 'event'), byTheme: countBy_(ev, 'theme') } });
    case 'announce':      return handleAnnounce_(d);
    default: return json_({ ok: false, error: 'op topilmadi' });
  }
}
function countBy_(rows, key) {
  var o = {}; rows.forEach(function (r) { if (r[key]) o[r[key]] = (o[r[key]] || 0) + 1; }); return o;
}
/* admin push (butun bazani Sheets’ga yozish) */
function handlePush_(d) {
  var data = d.data || {};
  ['videos', 'news'].forEach(function (k) {
    if (!data[k]) return;
    var name = k === 'videos' ? 'Videos' : 'News';
    var sh = sheet_(name); sh.clear();
    sh.appendRow(SCHEMA[name]);
    data[k].forEach(function (item) {
      sh.appendRow(SCHEMA[name].map(function (h) { return item[h] != null ? item[h] : ''; }));
    });
  });
  return json_({ ok: true });
}

/* ---------- Telegram broadcast ---------- */
function handleAnnounce_(d) {
  var token = PROPS.getProperty('BOT_TOKEN');
  var chat = PROPS.getProperty('BROADCAST_CHAT');
  var chatId = d.test ? PROPS.getProperty('OWNER_CHAT') : chat;
  if (!token) return json_({ ok: false, error: 'BOT_TOKEN sozlanmagan' });
  if (!chatId) return json_({ ok: false, error: d.test ? 'OWNER_CHAT property qo\'yilmagan' : 'BROADCAST_CHAT property qo\'yilmagan' });
  var text = '👑 <b>' + escHtml_(d.title || '') + '</b>\n\n' + escHtml_(d.text || d.body || '');
  var payload = { chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: false };
  if (d.button) payload.reply_markup = JSON.stringify({
    inline_keyboard: [[{ text: d.button, url: PROPS.getProperty('APP_URL') || 'https://t.me' }]]
  });
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    sheet_('Announcements').appendRow([Date.now(), d.title || '', d.text || d.body || '', d.button || '', chatId]);
    return json_({ ok: true });
  } catch (e) { return json_({ ok: false, error: String(e) }); }
}
function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- Bir martalik init (opsional) ---------- */
function setup() { getSS_(); Logger.log('AURUM backend tayyor. Sheet: ' + getSS_().getUrl()); }
