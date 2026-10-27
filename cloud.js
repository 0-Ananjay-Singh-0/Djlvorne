/*
  cloud.js - saves chats to Firebase (Firestore) and powers the master panel.
  Who can read what is decided by the Firestore security rules on Firebase's servers,
  not by this file. Images are not uploaded, only text.
*/
(function () {
  var MASTER = 'rex.ananjay@gmail.com', known = {}, timer = null, latest = null, warned = false;

  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { fail(new Error('Could not load Firebase. Check your connection.')); };
      document.head.appendChild(s);
    });
  }
  async function db() {
    if (!firebase.firestore) await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
    return firebase.firestore();
  }
  function fail(e) {
    console.warn('Cloud sync:', e);
    if (!warned) { warned = true; if (api.onError) api.onError(e); }
  }
  function noImg(k, v) { return typeof v === 'string' && v.slice(0, 5) === 'data:' ? '' : v; }
  function pack(c) {
    var arr = (c.msgs || []).filter(function (m) { return !m.pending; });
    var s = JSON.stringify(arr, noImg);
    while (s.length > 900000 && arr.length > 1) { arr = arr.slice(1); s = JSON.stringify(arr, noImg); }
    return { title: c.title || '', mode: c.mode || 'chat', pin: !!c.pin, locked: !!c.locked, updated: Date.now(), msgs: s };
  }
  function unpack(doc) {
    var d = doc.data(), m = [];
    try { m = JSON.parse(d.msgs || '[]'); } catch (e) {}
    return { id: doc.id, title: d.title || '', mode: d.mode || 'chat', pin: !!d.pin, locked: !!d.locked, updated: d.updated || 0, msgs: m };
  }
  function userChats(d, uid) { return d.collection('users').doc(uid).collection('chats'); }

  async function flush() {
    if (!latest) return;
    var uid = latest.uid, list = latest.chats; latest = null;
    try {
      var d = await db(), ops = [], ids = {};
      list.forEach(function (c) { ids[String(c.id)] = 1; ops.push(['set', String(c.id), pack(c)]); });
      Object.keys(known).forEach(function (id) { if (!ids[id]) ops.push(['del', id]); });
      for (var i = 0; i < ops.length; i += 400) {
        var b = d.batch();
        ops.slice(i, i + 400).forEach(function (o) {
          var ref = userChats(d, uid).doc(o[1]);
          if (o[0] === 'set') b.set(ref, o[2]); else b.delete(ref);
        });
        await b.commit();
      }
      known = ids;
    } catch (e) { fail(e); }
  }

  var api = {
    MASTER: MASTER, onError: null,
    start: async function (U, local) {
      try {
        var d = await db();
        await d.collection('users').doc(U.uid).set({ email: U.email, created: U.created || Date.now(), seen: Date.now() }, { merge: true });
        var snap = await userChats(d, U.uid).get(), cloud = [];
        snap.forEach(function (x) { known[x.id] = 1; cloud.push(unpack(x)); });
        var have = {}; local.forEach(function (c) { have[String(c.id)] = 1; });
        var extra = cloud.filter(function (c) { return !have[c.id]; });
        api.push(U.uid, local.concat(extra));
        return extra;
      } catch (e) { fail(e); return []; }
    },
    push: function (uid, chats) { latest = { uid: uid, chats: chats }; clearTimeout(timer); timer = setTimeout(flush, 1500); },
    /* master only: the server rules refuse these for anyone else */
    listUsers: async function () {
      var s = await (await db()).collection('users').get(), out = [];
      s.forEach(function (x) { var v = x.data(); out.push({ uid: x.id, email: v.email || x.id, created: v.created || 0 }); });
      return out.sort(function (a, b) { return a.email.localeCompare(b.email); });
    },
    listChats: async function (uid) {
      var s = await userChats(await db(), uid).get(), out = [];
      s.forEach(function (x) { out.push(unpack(x)); });
      return out.sort(function (a, b) { return b.updated - a.updated; });
    },
    getNotes: async function (uid) {
      var x = await (await db()).collection('users').doc(uid).collection('meta').doc('notes').get();
      return x.exists ? (x.data().text || '') : '';
    },
    resetEmail: async function (email) { await firebase.auth().sendPasswordResetEmail(email); }
  };
  window.DjCloud = api;
})();
