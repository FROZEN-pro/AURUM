// AURUM · Google Apps Script Backend v2.1
// index.html va admin.html shu fayl bilan ishlaydi.
// Script Properties: ADMIN_TOKEN, BOT_TOKEN, BROADCAST_CHAT,
//                  OWNER_CHAT, APP_URL, SHEET_ID
// Kod o`zgarsa: Deploy > Manage deployments > Edit > New version > Deploy
// Sheets DB avtomatik: Videos, News, Users, Events, Settings,
//                     Announcements, Likes, Comments, CommentLikes

var PROPS = PropertiesService.getScriptProperties();

// ---------- Sheet yordamchilari ----------
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
  Announcements: ['ts','title','body','button','sent'],
  Likes:         ['id','videoId','userId','ts'],
  Comments:      ['id','videoId','userId','name','text','ts','likes'],
  CommentLikes:  ['id','commentId','userId','ts']
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
    ['ts','createdAt'].forEach(function (k) { if (o[k] && typeof o[k] === 'object') o[k] = +new Date(o[k]); });
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
  var key = head[0];
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
function uid_() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function trim_(s, n) { return String(s == null ? '' : s).slice(0, n); }

// ---------- JSON javob ----------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- GET ----------
function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || 'ping';
  var me = (e && e.parameter && e.parameter.uid) || '';
  try {
    if (a === 'bootstrap') return json_(bootstrap_(me));
    if (a === 'ping') return json_({ ok: true, name: 'AURUM backend v2.1', sheets: getSS_().getName(), t: Date.now() });
    return json_({ ok: false, error: 'nodoma action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}
function bootstrap_(me) {
  var likes = rows_('Likes'), comments = rows_('Comments');
  var likeCounts = {}, commentCounts = {}, myLikes = [];
  likes.forEach(function (l) {
    likeCounts[l.videoId] = (likeCounts[l.videoId] || 0) + 1;
    if (me && l.userId === me) myLikes.push(l.videoId);
  });
  comments.forEach(function (c) { commentCounts[c.videoId] = (commentCounts[c.videoId] || 0) + 1; });
  return {
    ok: true,
    videos: active_(rows_('Videos')),
    news: active_(rows_('News')),
    settings: { notice: getSetting_('notice', ''), app: 'AURUM' },
    meta: { likeCounts: likeCounts, commentCounts: commentCounts, myLikes: myLikes }
  };
}
function active_(arr) {
  return arr.filter(function (x) { return !x.status || x.status === 'active'; })
    .map(function (x) {
      if (x.featured != null) x.featured = (x.featured === 1 || x.featured === '1' || x.featured === true) ? 1 : 0;
      if (x.hot != null) x.hot = (x.hot === 1 || x.hot === '1' || x.hot === true) ? 1 : 0;
      return x;
    });
}

// ---------- POST router ----------
function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'JSON buzilgan' }); }
  try {
    switch (d.action) {
      case 'track':    return handleTrack_(d);
      case 'auth':     return handleAuth_(d);
      case 'social':   return handleSocial_(d);
      case 'admin':    return handleAdmin_(d);
      default:         return json_({ ok: false, error: 'action topilmadi: ' + d.action });
    }
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

// ---------- Hodisalarni yozish ----------
function handleTrack_(d) {
  sheet_('Events').appendRow([d.ts || Date.now(), trim_(d.userId, 40), trim_(d.event, 40), trim_(d.itemId, 60), trim_(d.theme, 30), trim_(d.meta, 300)]);
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

// ---------- Layk va izohlar (real-time) ----------
function handleSocial_(d) {
  var uid = trim_(d.uid, 40);
  if (!uid) return json_({ ok: false, error: 'uid kerak' });

  // --- LAYK: yorib qo'shish, qayta bosib o'chirish ---
  if (d.op === 'like') {
    var vid = trim_(d.videoId, 60);
    if (!vid) return json_({ ok: false, error: 'videoId kerak' });
    var lid = vid + '|' + uid;
    var liked = !!findRow_('Likes', 'id', lid);
    if (liked) {
      delRow_('Likes', 'id', lid);
    } else {
      sheet_('Likes').appendRow([lid, vid, uid, Date.now()]);
      sheet_('Events').appendRow([Date.now(), uid, 'like', vid, '', '']);
    }
    var count = rows_('Likes').filter(function (l) { return String(l.videoId) === vid; }).length;
    return json_({ ok: true, liked: !liked, count: count });
  }

  // --- IZOH QO'SHISH ---
  if (d.op === 'comment.add') {
    var vid2 = trim_(d.videoId, 60);
    var text = trim_(d.text, 900).replace(/\s+$/, '');
    if (!vid2 || !text) return json_({ ok: false, error: 'videoId va matn kerak' });
    var cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sheet_('Comments').appendRow([cid, vid2, uid, trim_(d.name, 60) || 'Mehmon', text, Date.now(), 0]);
    sheet_('Events').appendRow([Date.now(), uid, 'comment', vid2, '', '']);
    var me = findRow_('Users', 'id', uid);
    if (me) sheet_('Users').getRange(me, SCHEMA.Users.indexOf('last') + 1).setValue(Date.now());
    return json_({ ok: true, comment: { id: cid, videoId: vid2, userId: uid, name: trim_(d.name, 60) || 'Mehmon', text: text, ts: Date.now(), likes: 0 } });
  }

  // --- IZOHNI YOQTIRISH (toggle) ---
  if (d.op === 'comment.vote') {
    var commentId = trim_(d.commentId, 40);
    var clid = commentId + '|' + uid;
    var crow = findRow_('Comments', 'id', commentId);
    if (!crow) return json_({ ok: false, error: 'izoh topilmadi' });
    var voted = !!findRow_('CommentLikes', 'id', clid);
    var cur = +sheet_('Comments').getRange(crow, SCHEMA.Comments.indexOf('likes') + 1).getValue() || 0;
    if (voted) {
      delRow_('CommentLikes', 'id', clid);
      sheet_('Comments').getRange(crow, SCHEMA.Comments.indexOf('likes') + 1).setValue(Math.max(0, cur - 1));
    } else {
      sheet_('CommentLikes').appendRow([clid, commentId, uid, Date.now()]);
      sheet_('Comments').getRange(crow, SCHEMA.Comments.indexOf('likes') + 1).setValue(cur + 1);
    }
    return json_({ ok: true, voted: !voted, likes: cur + (voted ? -1 : 1) });
  }

  // --- O'Z IZOHINI O'CHIRISH ---
  if (d.op === 'comment.delete') {
    var cid2 = trim_(d.commentId, 40);
    var row = findRow_('Comments', 'id', cid2);
    if (!row) return json_({ ok: false, error: 'izoh topilmadi' });
    var owner = String(sheet_('Comments').getRange(row, SCHEMA.Comments.indexOf('userId') + 1).getValue());
    var isAdmin = d.admin === true;
    if (owner !== uid && !isAdmin) return json_({ ok: false, error: 'faqat o\'zingizniki' });
    sheet_('Comments').deleteRow(row);
    return json_({ ok: true });
  }

  // --- IZOHLAR RO'YXATI (video bo'yicha) + yangilanib turish uchun ---
  if (d.op === 'comment.list') {
    var vid3 = trim_(d.videoId, 60);
    var mine = {};
    rows_('CommentLikes').forEach(function (cl) { if (cl.userId === uid) mine[cl.commentId] = true; });
    var list = rows_('Comments')
      .filter(function (c) { return String(c.videoId) === vid3; })
      .sort(function (a, b) { return (+b.ts) - (+a.ts); })
      .map(function (c) { c.canEdit = (c.userId === uid); return c; });
    return json_({ ok: true, comments: list.slice(0, 200), votes: mine, mine: uid });
  }

  // --- Mening layklangan videolarim (fav sinxroni) ---
  if (d.op === 'myLikes') {
    var arr = rows_('Likes').filter(function (l) { return l.userId === uid; }).map(function (l) { return String(l.videoId); });
    return json_({ ok: true, ids: arr });
  }

  return json_({ ok: false, error: 'social op topilmadi' });
}

// ---------- Telegram WebApp initData tekshiruvi (HMAC-SHA256) ----------
function handleAuth_(d) {
  var token = PROPS.getProperty('BOT_TOKEN');
  if (!token) return json_({ ok: false, error: 'BOT_TOKEN sozlanmagan' });
  if (!verifyInitData_(d.initData || '', token)) return json_({ ok: false, error: 'initData imzosi tasdiqlanmadi' });
  var u = parseInitUser_(d.initData || '');
  if (!u || !u.id) return json_({ ok: false, error: 'foydalanuvchi topilmadi' });
  var uid = 'tg' + u.id;
  var name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  var r = findRow_('Users', 'id', uid);
  var role = 'user';
  if (r) {
    var sh = sheet_('Users');
    role = sh.getRange(r, SCHEMA.Users.indexOf('role') + 1).getValue() || 'user';
    sh.getRange(r, SCHEMA.Users.indexOf('name') + 1).setValue(name);
    sh.getRange(r, SCHEMA.Users.indexOf('last') + 1).setValue(Date.now());
  } else {
    sheet_('Users').appendRow([uid, u.username || '', name, role, '', 1, Date.now(), 'active', Date.now()]);
  }
  var likes = rows_('Likes').filter(function (l) { return l.userId === uid; }).map(function (l) { return String(l.videoId); });
  return json_({ ok: true, user: { id: uid, name: name, tgId: u.id, username: u.username || '', role: role, photo: u.photo_url || '', premium: !!u.is_premium }, likes: likes });
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
  // Apps Script quyi imzosi: computeHmacSha256Signature(x, y) => key=y, x-xabar.
  var secret = Utilities.computeHmacSha256Signature(Utilities.newBlob('WebAppData').getBytes(), Utilities.newBlob(botToken).getBytes());
  var calc = Utilities.computeHmacSha256Signature(Utilities.newBlob(dataCheckString).getBytes(), secret)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (calc !== hash) return false;
  var age = Date.now() / 1000 - (+params.auth_date || 0);
  return age < 16 * 3600;
}

// ---------- Admin API ----------
function withCreated_(item) {
  var o = { createdAt: Date.now() };
  item = item || {};
  for (var k in item) if (item.hasOwnProperty(k)) o[k] = item[k];
  if (item.createdAt) o.createdAt = item.createdAt;
  return o;
}
function handleAdmin_(d) {
  var tok = PROPS.getProperty('ADMIN_TOKEN');
  if (!tok) return json_({ ok: false, error: 'ADMIN_TOKEN sozlanmagan' });
  if (String(d.token == null ? '' : d.token).trim() !== String(tok).trim()) return json_({ ok: false, error: 'unauthorized' });
  switch (d.op) {
    case 'ping':  return json_({ ok: true, t: Date.now(), version: 'v2.1' });
    case 'pull':  return json_({ ok: true, data: { videos: rows_('Videos'), news: rows_('News'),
                          users: rows_('Users'), events: rows_('Events').slice(-3000),
                          announcements: rows_('Announcements'), likes: rows_('Likes'), comments: rows_('Comments') } });
    case 'push':  return handlePush_(d);
    case 'videos.save':   upsert_('Videos', withCreated_(d.item)); return json_({ ok: true });
    case 'videos.delete': delRow_('Videos', 'id', d.id); return json_({ ok: true });
    case 'news.save':     upsert_('News', withCreated_(d.item)); return json_({ ok: true });
    case 'news.delete':   delRow_('News', 'id', d.id); return json_({ ok: true });
    case 'users.save':    upsert_('Users', d.item || {}); return json_({ ok: true });
    case 'users.delete':  delRow_('Users', 'id', d.id); return json_({ ok: true });
    case 'settings.save': setSetting_(d.key, d.value); return json_({ ok: true });
    case 'comments.delete': {
      var row = findRow_('Comments', 'id', d.id);
      if (row) sheet_('Comments').deleteRow(row);
      return json_({ ok: !!row });
    }
    case 'likes.delete': {
      var lr = findRow_('Likes', 'id', trim_(d.videoId, 60) + '|' + trim_(d.userId, 40));
      if (lr) sheet_('Likes').deleteRow(lr);
      return json_({ ok: !!lr });
    }
    case 'events.clear': sheet_('Events').clear(); sheet_('Events').appendRow(SCHEMA.Events); return json_({ ok: true });
    case 'stats':
      return json_({ ok: true, stats: adminStats_() });
    case 'announce':      return handleAnnounce_(d);
    default: return json_({ ok: false, error: 'op topilmadi' });
  }
}
function adminStats_() {
  var ev = rows_('Events'), users = rows_('Users'), likes = rows_('Likes'),
      comments = rows_('Comments'), videos = rows_('Videos'), news = rows_('News');
  var now = Date.now();
  var active7 = users.filter(function (u) { return (+u.last || 0) > now - 7 * 864e5; }).length;
  var active30 = users.filter(function (u) { return (+u.last || 0) > now - 30 * 864e5; }).length;
  var playBy = {}, likeBy = {}, cmtBy = {};
  likes.forEach(function (l) { likeBy[l.videoId] = (likeBy[l.videoId] || 0) + 1; });
  comments.forEach(function (c) { cmtBy[c.videoId] = (cmtBy[c.videoId] || 0) + 1; });
  ev.forEach(function (r) { if (r.event === 'play' && r.itemId) playBy[r.itemId] = (playBy[r.itemId] || 0) + 1; });
  var byVideo = videos.map(function (v) {
    return { id: v.id, title: v.title, yt: v.yt, plays: playBy[v.id] || 0, likes: likeBy[v.id] || 0, comments: cmtBy[v.id] || 0 };
  }).sort(function (a, b) { return (b.plays + b.likes * 2 + b.comments * 3) - (a.plays + a.likes * 2 + a.comments * 3); }).slice(0, 30);
  return {
    total: ev.length, byEvent: countBy_(ev, 'event'), byTheme: countBy_(ev, 'theme'),
    users: users.length, active7: active7, active30: active30,
    videos: videos.length, newsCount: news.length,
    likes: likes.length, comments: comments.length,
    byVideo: byVideo,
    daily: dailyCounts_(ev, 14),
    recentEvents: ev.slice(-80).reverse()
  };
}
function dailyCounts_(ev, days) {
  var out = [];
  for (var i = days - 1; i >= 0; i--) {
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var start = +d0 - i * 864e5, end = start + 864e5;
    var plays = 0, logins = 0;
    ev.forEach(function (r) {
      var t = +r.ts;
      if (t >= start && t < end) { if (r.event === 'play') plays++; if (r.event === 'login') logins++; }
    });
    out.push({ d: start, plays: plays, logins: logins });
  }
  return out;
}
function countBy_(rows, key) {
  var o = {}; rows.forEach(function (r) { if (r[key]) o[r[key]] = (o[r[key]] || 0) + 1; }); return o;
}
// admin push (butun bazani Sheets'ga yozish)
function handlePush_(d) {
  var data = d.data || {};
  [['videos','Videos'], ['news','News']].forEach(function (pair) {
    var k = pair[0], name = pair[1];
    if (!data[k]) return;
    var sh = sheet_(name); sh.clear();
    sh.appendRow(SCHEMA[name]);
    data[k].forEach(function (item) {
      sh.appendRow(SCHEMA[name].map(function (h) { return item[h] != null ? item[h] : ''; }));
    });
  });
  return json_({ ok: true });
}

// ---------- Telegram broadcast ----------
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

// ---------- Bir martalik init (opsional) ----------
function setup() { var ss = getSS_(); ['Likes','Comments','CommentLikes'].forEach(sheet_); Logger.log('AURUM backend v2 tayyor. Sheet: ' + ss.getUrl()); }
