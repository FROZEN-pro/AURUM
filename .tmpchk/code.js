// IPLUS MEDIA · Google Apps Script Backend v2.9
// index.html va admin.html shu fayl bilan ishlaydi.
// Script Properties: ADMIN_TOKEN, BOT_TOKEN, BROADCAST_CHAT,
//                  OWNER_CHAT, APP_URL, SHEET_ID
// Kod o`zgarsa: Deploy > Manage deployments > Edit > New version > Deploy
// Sheets DB avtomatik: Videos, News, Users, Events, Settings,
//                     Announcements, Likes, Comments, CommentLikes, Views

var PROPS = PropertiesService.getScriptProperties();

// Telegram ID orqali avtomatik admin: bu ID'larning initData imzosi
// ADMIN_TOKEN o'rnini bosadi. ID'lar maxfiy emas, lekin ularga kirish
// faqat Telegram bot imzolagan initData bilan ochiladi.
var OWNERS = ['858310974', '2004566289'];
function isOwner_(tgId) { return OWNERS.indexOf(String(tgId)) >= 0; }

// ---------- Sheet yordamchilari ----------
function getSS_() {
  var id = PROPS.getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : null;
  if (!ss) {
    ss = SpreadsheetApp.create('IPLUS MEDIA DB');
    PROPS.setProperty('SHEET_ID', ss.getId());
  }
  return ss;
}
var SCHEMA = {
  Videos:        ['id','yt','title','cat','dur','views','featured','desc','status','createdAt','tags','live','seriesId','episode','season'],
  News:          ['id','title','cat','src','time','read','hot','emoji','body','status','createdAt','tags','reads'],
  Users:         ['id','tg','name','role','theme','sessions','last','status','createdAt'],
  Events:        ['ts','userId','event','itemId','theme','meta'],
  Settings:      ['key','value'],
  Announcements: ['ts','title','body','button','sent'],
  Likes:         ['id','videoId','userId','ts'],
  Comments:      ['id','videoId','userId','name','text','ts','likes'],
  CommentLikes:  ['id','commentId','userId','ts'],
  Views:         ['id','itemId','userId','ts'],
  Devices:       ['id','userId','deviceName','platform','lastSeen','active'],
  Messages:      ['id','fromId','toId','text','type','mediaUrl','ts','read']
};
// Jadval sarlavhasi SCHEMA'dan farq qilsa (eski versiya yaratgan bo'lsa),
// yetishmayotgan ustunlar oxiriga qo'shiladi — mavjud ma'lumot buzilmaydi.
var ENSURED_ = {}, HDR_ = {};
function sheet_(name) {
  var ss = getSS_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SCHEMA[name]);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setFontWeight('bold');
    sh.setFrozenRows(1);
    ENSURED_[name] = true; HDR_[name] = SCHEMA[name].slice();
    return sh;
  }
  if (!ENSURED_[name]) {
    ENSURED_[name] = true;
    var want = SCHEMA[name] || [];
    var have = headerOf_(sh);
    var missing = want.filter(function (k) { return have.indexOf(k) < 0; });
    if (missing.length) {
      sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      have = have.concat(missing);
    }
    HDR_[name] = have;
  }
  return sh;
}
function headerOf_(sh) {
  var n = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, n).getValues()[0].map(function (h) { return String(h == null ? '' : h).trim(); });
}
function head_(name) { sheet_(name); return HDR_[name]; }
// Ustunni HAQIQIY sarlavha bo'yicha topamiz: jadval tartibi o'zgargan bo'lsa ham
// ma'lumot noto'g'ri ustunga yozilmaydi.
function col_(name, key) {
  var h = head_(name), i = h.indexOf(key);
  return i >= 0 ? i + 1 : 0;
}
function rows_(name) {
  var sh = sheet_(name), v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = v[i][j];
    ['ts','createdAt','last'].forEach(function (k) { if (o[k] && typeof o[k] === 'object') o[k] = +new Date(o[k]); });
    out.push(o);
  }
  return out;
}
function findRow_(name, key, val) {
  var sh = sheet_(name), col = col_(name, key);
  if (!col) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(val)) return i + 2;
  return null;
}
function cellVal_(name, row, key) {
  var c = col_(name, key);
  return c ? sheet_(name).getRange(row, c).getValue() : '';
}
function cellSet_(name, row, key, val) {
  var c = col_(name, key);
  if (c) sheet_(name).getRange(row, c).setValue(val);
}
function upsert_(name, obj) {
  var sh = sheet_(name), head = head_(name);
  var key = SCHEMA[name][0];
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
function dayKey_(ts) {
  var d = ts ? new Date(+ts) : new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
// Unikal ko'rish/o'qish: bitta foydalanuvchi bitta elementni kuniga bir marta hisoblaydi.
function countOnce_(itemId, userId, prefix) {
  var id = prefix + '|' + itemId + '|' + userId + '|' + dayKey_();
  if (findRow_('Views', 'id', id)) return false;
  sheet_('Views').appendRow([id, itemId, userId, Date.now()]);
  return true;
}
function bumpCol_(name, rowId, key, delta) {
  var r = findRow_(name, 'id', rowId);
  if (!r) return 0;
  var cur = +cellVal_(name, r, key) || 0;
  var next = Math.max(0, cur + delta);
  cellSet_(name, r, key, next);
  return next;
}
function canonUser_(u) {
  u = u || {};
  return {
    id: String(u.id || u.userId || u.uid || ''),
    tg: String(u.tg || u.username || u.user || u.tgUsername || ''),
    name: String(u.name || u.fullName || u.full_name || ''),
    role: String(u.role || 'user'),
    theme: String(u.theme || ''),
    sessions: +u.sessions || 0,
    last: +u.last || +u.lastSeen || 0,
    status: String(u.status || 'active'),
    createdAt: +u.createdAt || 0
  };
}
function users_() { return rows_('Users').map(canonUser_).filter(function (u) { return u.id; }); }

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
    if (a === 'ping') return json_({ ok: true, name: 'IPLUS MEDIA backend v2.9', sheets: getSS_().getName(), t: Date.now() });
    return json_({ ok: false, error: 'noma\u2019lum action: ' + a });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}
function bootstrap_(me) {
  var likes = rows_('Likes'), comments = rows_('Comments');
  var likeCounts = {}, commentCounts = {}, myLikes = [];
  likes.forEach(function (l) {
    likeCounts[l.videoId] = (likeCounts[l.videoId] || 0) + 1;
    if (me && String(l.userId) === String(me)) myLikes.push(String(l.videoId));
  });
  comments.forEach(function (c) {
    var k = String(c.videoId);
    commentCounts[k] = (commentCounts[k] || 0) + 1;
  });
  return {
    ok: true,
    videos: active_(rows_('Videos')),
    news: active_(rows_('News')),
    settings: { notice: getSetting_('notice', ''), app: getSetting_('app', 'IPLUS MEDIA') },
    meta: { likeCounts: likeCounts, commentCounts: commentCounts, myLikes: myLikes }
  };
}
function active_(arr) {
  return arr.filter(function (x) { return !x.status || x.status === 'active'; })
    .map(function (x) {
      if (x.featured != null) x.featured = (x.featured === 1 || x.featured === '1' || x.featured === true) ? 1 : 0;
      if (x.hot != null) x.hot = (x.hot === 1 || x.hot === '1' || x.hot === true) ? 1 : 0;
      if (x.live != null) x.live = (x.live === 1 || x.live === '1' || x.live === true) ? 1 : 0;
      x.views = +x.views || 0;
      x.reads = +x.reads || 0;
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
  var userId = trim_(d.userId, 40);
  sheet_('Events').appendRow([d.ts || Date.now(), userId, trim_(d.event, 40), trim_(d.itemId, 60), trim_(d.theme, 30), trim_(d.meta, 300)]);
  if (userId && userId !== 'guest') {
    var r = findRow_('Users', 'id', userId);
    if (r) {
      cellSet_('Users', r, 'last', Date.now());
      if (d.event === 'login') cellSet_('Users', r, 'sessions', (+cellVal_('Users', r, 'sessions') || 0) + 1);
      if (d.theme) cellSet_('Users', r, 'theme', trim_(d.theme, 30));
    }
    // Yangilik o'qilishi: kuniga bir marta hisoblanadi
    if (d.event === 'read' && d.itemId && countOnce_(trim_(d.itemId, 60), userId, 'read')) {
      bumpCol_('News', trim_(d.itemId, 60), 'reads', 1);
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

  // --- IZOH QO'SHISH (video yoki yangilik ostiga) ---
  if (d.op === 'comment.add') {
    var vid2 = trim_(d.videoId || d.itemId, 60);
    var text = trim_(d.text, 900).replace(/\s+$/, '');
    if (!vid2 || !text) return json_({ ok: false, error: 'videoId va matn kerak' });
    var cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sheet_('Comments').appendRow([cid, vid2, uid, trim_(d.name, 60) || 'Mehmon', text, Date.now(), 0]);
    sheet_('Events').appendRow([Date.now(), uid, 'comment', vid2, '', '']);
    var me = findRow_('Users', 'id', uid);
    if (me) cellSet_('Users', me, 'last', Date.now());
    return json_({ ok: true, comment: { id: cid, videoId: vid2, userId: uid, name: trim_(d.name, 60) || 'Mehmon', text: text, ts: Date.now(), likes: 0 } });
  }

  // --- IZOHNI YOQTIRISH (toggle) ---
  if (d.op === 'comment.vote') {
    var commentId = trim_(d.commentId, 40);
    var clid = commentId + '|' + uid;
    var crow = findRow_('Comments', 'id', commentId);
    if (!crow) return json_({ ok: false, error: 'izoh topilmadi' });
    var voted = !!findRow_('CommentLikes', 'id', clid);
    var cur = +cellVal_('Comments', crow, 'likes') || 0;
    if (voted) {
      delRow_('CommentLikes', 'id', clid);
      cellSet_('Comments', crow, 'likes', Math.max(0, cur - 1));
    } else {
      sheet_('CommentLikes').appendRow([clid, commentId, uid, Date.now()]);
      cellSet_('Comments', crow, 'likes', cur + 1);
    }
    return json_({ ok: true, voted: !voted, likes: cur + (voted ? -1 : 1) });
  }

  // --- O'Z IZOHINI O'CHIRISH ---
  if (d.op === 'comment.delete') {
    var cid2 = trim_(d.commentId, 40);
    var row = findRow_('Comments', 'id', cid2);
    if (!row) return json_({ ok: false, error: 'izoh topilmadi' });
    var owner = String(cellVal_('Comments', row, 'userId'));
    var isAdmin = d.admin === true;
    if (owner !== uid && !isAdmin) return json_({ ok: false, error: 'faqat o\u2019zingizniki' });
    sheet_('Comments').deleteRow(row);
    return json_({ ok: true });
  }

  // --- IZOHLAR RO'YXATI (video yoki yangilik bo'yicha) ---
  if (d.op === 'comment.list') {
    var vid3 = trim_(d.videoId || d.itemId, 60);
    var mine = {};
    rows_('CommentLikes').forEach(function (cl) { if (String(cl.userId) === uid) mine[cl.commentId] = true; });
    var list = rows_('Comments')
      .filter(function (c) { return String(c.videoId) === vid3; })
      .sort(function (a, b) { return (+b.ts) - (+a.ts); })
      .map(function (c) {
        c.canEdit = (String(c.userId) === uid);
        c.likes = +c.likes || 0;
        return c;
      });
    return json_({ ok: true, comments: list.slice(0, 200), votes: mine, mine: uid });
  }

  // --- KO'RISH: bitta foydalanuvchi kuniga bir marta hisoblanadi ---
  if (d.op === 'view') {
    var vid4 = trim_(d.videoId || d.itemId, 60);
    if (!vid4) return json_({ ok: false, error: 'videoId kerak' });
    var fresh = countOnce_(vid4, uid, 'view');
    var r4 = findRow_('Videos', 'id', vid4);
    var total = fresh ? bumpCol_('Videos', vid4, 'views', 1) : (r4 ? (+cellVal_('Videos', r4, 'views') || 0) : 0);
    if (fresh) sheet_('Events').appendRow([Date.now(), uid, 'view', vid4, trim_(d.theme, 30), '']);
    return json_({ ok: true, counted: fresh, views: total });
  }

  // --- JONLI HISOBLAGICHLAR (ko'rish · layk · izoh) ---
  if (d.op === 'counters') {
    var vid5 = trim_(d.videoId || d.itemId, 60);
    var likes5 = 0, cmts5 = 0;
    rows_('Likes').forEach(function (l) { if (String(l.videoId) === vid5) likes5++; });
    rows_('Comments').forEach(function (c) { if (String(c.videoId) === vid5) cmts5++; });
    var r5 = findRow_('Videos', 'id', vid5);
    var views5 = r5 ? (+cellVal_('Videos', r5, 'views') || 0) : 0;
    return json_({ ok: true, views: views5, likes: likes5, comments: cmts5 });
  }

  // --- Mening layklangan videolarim (fav sinxroni) ---
  if (d.op === 'myLikes') {
    var arr = rows_('Likes').filter(function (l) { return l.userId === uid; }).map(function (l) { return String(l.videoId); });
    return json_({ ok: true, ids: arr });
  }

  // --- SUPPORT CHAT: xabar yuborish ---
  if (d.op === 'support.send') {
    var text = trim_(d.text, 900);
    if (!text) return json_({ ok: false, error: 'matn kerak' });
    var mid = 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var toId = d.toId || 'admin'; // admin yoki boshqa user
    sheet_('Messages').appendRow([mid, uid, toId, text, d.type || 'text', d.mediaUrl || '', Date.now(), 0]);
    return json_({ ok: true, id: mid });
  }

  // --- SUPPORT CHAT: xabarlarni olish ---
  if (d.op === 'support.list') {
    var msgs = rows_('Messages')
      .filter(function (m) { return String(m.fromId) === uid || String(m.toId) === uid || m.toId === 'admin'; })
      .sort(function (a, b) { return (+a.ts) - (+b.ts); })
      .slice(-100); // oxirgi 100 ta
    return json_({ ok: true, messages: msgs });
  }

  // --- ADMIN: barcha support xabarlarni ko'rish ---
  if (d.op === 'support.adminList' && d.isAdmin) {
    var allMsgs = rows_('Messages')
      .sort(function (a, b) { return (+b.ts) - (+a.ts); })
      .slice(0, 200);
    return json_({ ok: true, messages: allMsgs });
  }

  // --- ADMIN: javob yuborish ---
  if (d.op === 'support.reply' && d.isAdmin) {
    var rid = 'reply_' + Date.now().toString(36);
    sheet_('Messages').appendRow([rid, 'admin', d.toUserId, trim_(d.text, 900), 'text', '', Date.now(), 0]);
    return json_({ ok: true, id: rid });
  }

  // --- ADMIN: foydalanuvchilar ro'yxati ---
  if (d.op === 'users.list' && d.isAdmin) {
    var allUsers = rows_('Users')
      .sort(function (a, b) { return (+b.last || 0) - (+a.last || 0); })
      .map(function (u) {
        return {
          id: u.id,
          tg: u.tg || '',
          name: u.name || '',
          role: u.role || 'user',
          status: u.status || 'active',
          sessions: u.sessions || 0,
          last: u.last || 0,
          createdAt: u.createdAt || 0
        };
      });
    return json_({ ok: true, users: allUsers, total: allUsers.length });
  }

  // --- ADMIN: foydalanuvchi holatini o'zgartirish (ban/unban/role) ---
  if (d.op === 'users.update' && d.isAdmin) {
    var userId = d.userId;
    if (!userId) return json_({ ok: false, error: 'userId kerak' });
    var r = findRow_('Users', 'id', userId);
    if (!r) return json_({ ok: false, error: 'foydalanuvchi topilmadi' });
    
    if (d.status !== undefined) cellSet_('Users', r, 'status', d.status);
    if (d.role !== undefined) cellSet_('Users', r, 'role', d.role);
    
    return json_({ ok: true, updated: userId });
  }

  // --- ADMIN: foydalanuvchi tafsilotlari ---
  if (d.op === 'users.detail' && d.isAdmin) {
    var uid = d.userId;
    if (!uid) return json_({ ok: false, error: 'userId kerak' });
    var user = findRow_('Users', 'id', uid);
    if (!user) return json_({ ok: false, error: 'foydalanuvchi topilmadi' });
    
    // Foydalanuvchi faoliyati statistikasi
    var userLikes = rows_('Likes').filter(function (l) { return String(l.userId) === uid; }).length;
    var userComments = rows_('Comments').filter(function (c) { return String(c.userId) === uid; }).length;
    var userViews = rows_('Views').filter(function (v) { return String(v.userId) === uid; }).length;
    var userEvents = rows_('Events').filter(function (e) { return String(e.userId) === uid; }).length;
    
    return json_({ 
      ok: true, 
      user: user,
      stats: {
        likes: userLikes,
        comments: userComments,
        views: userViews,
        events: userEvents
      }
    });
  }

  // ---------- SERIES & AUTO-ADVANCE ----------
  if (d.op === 'series.next') {
    var currentId = d.currentId;
    if (!currentId) return json_({ ok: false, error: 'currentId kerak' });
  
    // Hozirgi videoni topish
    var currentVideo = findRow_('Videos', 'id', currentId);
    if (!currentVideo) return json_({ ok: false, error: 'video topilmadi' });
  
    var seriesId = currentVideo.seriesId || '';
    var season = +(currentVideo.season || 1);
    var episode = +(currentVideo.episode || 1);
  
    if (!seriesId) {
      return json_({ ok: true, next: null, message: 'Bu serial emas' });
    }
  
    // Keyingi episodni topish
    var allEpisodes = rows_('Videos').filter(function(v) {
      return v.seriesId === seriesId && +v.season === season;
    }).sort(function(a, b) {
      return (+a.episode || 0) - (+b.episode || 0);
    });
  
    var nextEpisode = null;
    for (var i = 0; i < allEpisodes.length; i++) {
      if (allEpisodes[i].id === currentId && i < allEpisodes.length - 1) {
        nextEpisode = allEpisodes[i + 1];
        break;
      }
    }
  
    return json_({ ok: true, next: nextEpisode, hasNext: !!nextEpisode });
  }

  // ---------- AD BANNER SETTINGS ----------
  if (d.op === 'ad.get') {
    var adData = {
      enabled: PROPS.getProperty('AD_ENABLED') === 'true',
      imageUrl: PROPS.getProperty('AD_IMAGE_URL') || '',
      linkUrl: PROPS.getProperty('AD_LINK_URL') || '',
      title: PROPS.getProperty('AD_TITLE') || ''
    };
    return json_({ ok: true, ad: adData });
  }

  if (d.op === 'ad.set' && d.isAdmin) {
    PROPS.setProperty('AD_ENABLED', d.enabled ? 'true' : 'false');
    if (d.imageUrl) PROPS.setProperty('AD_IMAGE_URL', trim_(d.imageUrl, 500));
    if (d.linkUrl) PROPS.setProperty('AD_LINK_URL', trim_(d.linkUrl, 500));
    if (d.title) PROPS.setProperty('AD_TITLE', trim_(d.title, 200));
    return json_({ ok: true });
  }

  // ---------- ADMIN: BOT CHANNEL/GROUP LINKING ----------
  if (d.op === 'bot.channels' && d.isAdmin) {
    var channels = {
      broadcastChat: PROPS.getProperty('BROADCAST_CHAT') || '',
      ownerChat: PROPS.getProperty('OWNER_CHAT') || '',
      supportGroup: PROPS.getProperty('SUPPORT_GROUP') || ''
    };
    return json_({ ok: true, channels: channels });
  }

  if (d.op === 'bot.setChannel' && d.isAdmin) {
    if (d.key === 'broadcast') PROPS.setProperty('BROADCAST_CHAT', String(d.chatId));
    else if (d.key === 'owner') PROPS.setProperty('OWNER_CHAT', String(d.chatId));
    else if (d.key === 'support') PROPS.setProperty('SUPPORT_GROUP', String(d.chatId));
    else return json_({ ok: false, error: 'noto\'g\'ri key' });
    return json_({ ok: true });
  }

  return json_({ ok: false, error: 'social op topilmadi' });
}

// ---------- Telegram broadcast ----------
function handleAuth_(d) {
  var token = PROPS.getProperty('BOT_TOKEN');
  if (!token) return json_({ ok: false, error: 'BOT_TOKEN sozlanmagan' });
  var chk = checkInitData_(d.initData || '', token);
  if (!chk.ok) { logAuthFail_(d.initData || '', chk); return json_({ ok: false, error: 'initData imzosi tasdiqlanmadi' }); }
  var u = parseInitUser_(d.initData || '');
  if (!u || !u.id) return json_({ ok: false, error: 'foydalanuvchi topilmadi' });
  var uid = 'tg' + u.id;
  var name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  var r = findRow_('Users', 'id', uid);
  var role = isOwner_(u.id) ? 'admin' : 'user';
  if (r) {
    if (role !== 'admin') role = String(cellVal_('Users', r, 'role') || 'user');
    if (role !== 'admin' && String(cellVal_('Users', r, 'status') || 'active') === 'banned') {
      return json_({ ok: false, error: 'blocked' });
    }
    cellSet_('Users', r, 'role', role);
    cellSet_('Users', r, 'name', name);
    if (u.username) cellSet_('Users', r, 'tg', u.username);
    cellSet_('Users', r, 'last', Date.now());
  } else {
    upsert_('Users', { id: uid, tg: u.username || '', name: name, role: role, theme: '',
                       sessions: 1, last: Date.now(), status: 'active', createdAt: Date.now() });
  }
  var likes = rows_('Likes').filter(function (l) { return String(l.userId) === uid; }).map(function (l) { return String(l.videoId); });
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
/* initData tekshiruvi. Telegram docs: `signature` maydoni data-check string'dan
   chiqarib tashlanadi, faqat boshqa parametrlar alifbo tartibida birlashtiriladi. */
function checkInitData_(initData, botToken) {
  var r = { ok: false, reason: '', age: -1 };
  if (!initData) { r.reason = 'no_initdata'; return r; }
  var pairs = rawPairs_(initData);
  var hash = '';
  pairs.forEach(function (p) { if (p.k === 'hash') hash = p.v; });
  if (!hash) { r.reason = 'no_hash'; return r; }
  // Apps Script quyi imzosi: computeHmacSha256Signature(x, y) => key=y, x-xabar.
  var secret = Utilities.computeHmacSha256Signature(Utilities.newBlob('WebAppData').getBytes(), Utilities.newBlob(botToken).getBytes());
  var sign = function (dcs) {
    return hex_(Utilities.computeHmacSha256Signature(Utilities.newBlob(dcs).getBytes(), secret));
  };
  // To'g'ri variant: hash va signature maydonlarini chiqarib tashlab, qolganlarini
  // alifbo tartibida birlashtiramiz. Qiymatlar URL-dekodlangan holatda bo'ladi.
  var dcs = pairs.filter(function (p) {
    return p.k !== 'hash' && p.k !== 'signature';
  }).sort(function (a, b) { return a.k < b.k ? -1 : (a.k > b.k ? 1 : 0); })
    .map(function (p) {
      var v = p.v;
      try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
      return p.k + '=' + v;
    }).join('\n');
  var calc = sign(dcs);
  if (calc !== hash) { r.reason = 'bad_hash'; return r; }
  r.age = Date.now() / 1000 - (+parseQS_(initData).auth_date || 0);
  if (!(r.age < 16 * 3600)) { r.reason = 'stale'; return r; }
  r.ok = true;
  r.reason = 'ok';
  return r;
}
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
// Xom (URL-dekodlanmagan) key=value juftliklari.
function rawPairs_(s) {
  var out = [];
  String(s).split('&').forEach(function (kv) {
    var i = kv.indexOf('=');
    if (i > 0) out.push({ k: kv.slice(0, i), v: kv.slice(i + 1) });
  });
  return out;
}
function verifyInitData_(initData, botToken) { return checkInitData_(initData, botToken).ok; }
/* Xato sababi Events'ga yoziladi. Maxfiy hech narsa tushmaydi: token, to'liq
   hash va user JSON'i emas, faqat 8 belgili prefikslar va kalit nomlari. */
function logAuthFail_(initData, chk) {
  var uid = '', keys = '';
  try { var u = parseInitUser_(initData); if (u && u.id) uid = 'tg' + u.id; } catch (e) {}
  try { keys = Object.keys(parseQS_(initData)).sort().join(','); } catch (e) {}
  sheet_('Events').appendRow([Date.now(), uid || 'anon', 'auth_fail', '', '',
    trim_('reason=' + chk.reason + ' age=' + Math.round(chk.age) + ' keys=' + keys, 300)]);
}

// ---------- Admin API ----------
function withCreated_(item) {
  var o = { createdAt: Date.now() };
  item = item || {};
  for (var k in item) if (item.hasOwnProperty(k)) o[k] = item[k];
  if (item.createdAt) o.createdAt = item.createdAt;
  return o;
}
function adminAuth_(d) {
  var tok = PROPS.getProperty('ADMIN_TOKEN');
  if (tok && String(d.token == null ? '' : d.token).trim() === String(tok).trim()) return true;
  var bt = PROPS.getProperty('BOT_TOKEN');
  if (!bt || !d.initData) return false;
  if (!verifyInitData_(d.initData, bt)) return false;
  var u = parseInitUser_(d.initData);
  return !!(u && isOwner_(u.id));
}
function handleAdmin_(d) {
  if (!adminAuth_(d)) return json_({ ok: false, error: 'unauthorized' });
  switch (d.op) {
    case 'ping':  return json_({ ok: true, t: Date.now(), version: 'v2.9' });
    case 'pull':  return json_({ ok: true, data: { videos: rows_('Videos'), news: rows_('News'),
                          users: users_(), events: rows_('Events').slice(-3000),
                          announcements: rows_('Announcements'), likes: rows_('Likes'),
                          comments: rows_('Comments'), settings: settings_() } });
    case 'push':  return handlePush_(d);
    case 'videos.save':   upsert_('Videos', withCreated_(d.item)); return json_({ ok: true });
    case 'videos.delete': delRow_('Videos', 'id', d.id); return json_({ ok: true });
    case 'news.save':     upsert_('News', withCreated_(d.item)); return json_({ ok: true });
    case 'news.delete':   delRow_('News', 'id', d.id); return json_({ ok: true });
    case 'users.save':    upsert_('Users', canonUser_(d.item)); return json_({ ok: true });
    case 'users.delete':  delRow_('Users', 'id', d.id); return json_({ ok: true });
    case 'settings.save': setSetting_(d.key, d.value); return json_({ ok: true });
    case 'settings.pull': return json_({ ok: true, settings: settings_() });
    case 'doctor':        return json_({ ok: true, doctor: doctor_() });
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
    default: return json_({ ok: false, error: 'op topilmadi: ' + d.op });
  }
}
function settings_() {
  return rows_('Settings').map(function (s) { return { key: String(s.key), value: String(s.value == null ? '' : s.value) }; });
}
// Backend holati: jadval sarlavhalari, qatorlar soni, yetishmayotgan property'lar.
// Admin paneldagi "Diagnostika" bo'limi shu ma'lumot bilan ishlaydi.
function doctor_() {
  var out = [];
  Object.keys(SCHEMA).forEach(function (n) {
    var sh = sheet_(n);
    var have = head_(n).slice();
    out.push({
      sheet: n,
      rows: Math.max(0, sh.getLastRow() - 1),
      header: have,
      expected: SCHEMA[n],
      ok: SCHEMA[n].every(function (k) { return have.indexOf(k) >= 0; })
    });
  });
  var props = ['ADMIN_TOKEN','BOT_TOKEN','SHEET_ID','BROADCAST_CHAT','OWNER_CHAT','APP_URL'];
  return {
    version: 'v2.9',
    ssId: getSS_().getId(),
    ssName: getSS_().getName(),
    ssUrl: getSS_().getUrl(),
    sheets: out,
    missingProps: props.filter(function (p) { return !PROPS.getProperty(p); })
  };
}
function adminStats_() {
  var ev = rows_('Events'), users = users_(), likes = rows_('Likes'),
      comments = rows_('Comments'), videos = rows_('Videos'), news = rows_('News'),
      views = rows_('Views');
  var now = Date.now();
  var active7 = users.filter(function (u) { return (+u.last || 0) > now - 7 * 864e5; }).length;
  var active30 = users.filter(function (u) { return (+u.last || 0) > now - 30 * 864e5; }).length;
  var playBy = {}, likeBy = {}, cmtBy = {}, viewBy = {}, actBy = {};
  likes.forEach(function (l) { likeBy[l.videoId] = (likeBy[l.videoId] || 0) + 1; });
  comments.forEach(function (c) { cmtBy[c.videoId] = (cmtBy[c.videoId] || 0) + 1; });
  views.forEach(function (v) { viewBy[v.itemId] = (viewBy[v.itemId] || 0) + 1; });
  ev.forEach(function (r) {
    if (r.event === 'play' && r.itemId) playBy[r.itemId] = (playBy[r.itemId] || 0) + 1;
    if (r.userId) actBy[r.userId] = (actBy[r.userId] || 0) + 1;
  });
  var byVideo = videos.map(function (v) {
    return { id: v.id, title: v.title, yt: v.yt, cat: v.cat,
             views: +v.views || 0, unique: viewBy[v.id] || 0,
             plays: playBy[v.id] || 0, likes: likeBy[v.id] || 0, comments: cmtBy[v.id] || 0 };
  }).sort(function (a, b) {
    return (b.views + b.plays + b.likes * 2 + b.comments * 3) - (a.views + a.plays + a.likes * 2 + a.comments * 3);
  }).slice(0, 30);
  var byCat = countBy_(videos, 'cat');
  var topUsers = users.map(function (u) {
    return { id: u.id, name: u.name, tg: u.tg, role: u.role, last: u.last,
             sessions: u.sessions, actions: actBy[u.id] || 0 };
  }).sort(function (a, b) { return (b.actions - a.actions) || (+b.last - +a.last); }).slice(0, 20);
  return {
    total: ev.length, byEvent: countBy_(ev, 'event'), byTheme: countBy_(ev, 'theme'),
    users: users.length, active7: active7, active30: active30, banned: users.filter(function (u) { return u.status === 'banned'; }).length,
    videos: videos.length, newsCount: news.length,
    likes: likes.length, comments: comments.length,
    views: videos.reduce(function (s, v) { return s + (+v.views || 0); }, 0),
    uniqueViews: views.length,
    newsReads: news.reduce(function (s, n) { return s + (+n.reads || 0); }, 0),
    byVideo: byVideo, byCat: byCat, topUsers: topUsers,
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
    var sh = sheet_(name), head = SCHEMA[name];
    sh.clear();
    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
    HDR_[name] = head.slice(); ENSURED_[name] = true;
    data[k].forEach(function (item) {
      sh.appendRow(head.map(function (h) { return item[h] != null ? item[h] : ''; }));
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
    inline_keyboard: [[{ text: d.button, url: trim_(d.url, 300) || PROPS.getProperty('APP_URL') || 'https://t.me' }]]
  });
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var body = {};
    try { body = JSON.parse(res.getContentText()); } catch (e) {}
    if (!body.ok) return json_({ ok: false, error: trim_(body.description || res.getContentText(), 200) });
    sheet_('Announcements').appendRow([Date.now(), d.title || '', d.text || d.body || '', d.button || '', chatId]);
    return json_({ ok: true, chat: chatId });
  } catch (e) { return json_({ ok: false, error: String(e) }); }
}
function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Bir martalik init (opsional) ----------
function setup() {
  var ss = getSS_();
  Object.keys(SCHEMA).forEach(sheet_);
  Logger.log('IPLUS MEDIA backend v2.9 tayyor. Sheet: ' + ss.getUrl());
}
