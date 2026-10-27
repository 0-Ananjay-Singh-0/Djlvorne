/*
  auth.js - Djlvorne's own login (separate from the Puter login).

  Two backends behind one small interface, window.DjAuth:
    - "firebase": real accounts, used when firebase-config.js has your keys.
    - "local":    device-only fallback so you can test the screens before
                  Firebase is set up. Passwords are still hashed (PBKDF2),
                  but accounts only exist in this browser.

  The vault password (for Locked Chats and Notes) is hashed with a slow,
  salted hash and only the hash is stored. There is NO reset for it, by design.
  For now the vault hash lives on this device; moving it to Firestore comes
  with the Firebase step.

  DjAuth.init()                       -> user or null (restores a session)
  DjAuth.signUp(email, pw, vaultPw)   -> user
  DjAuth.signIn(email, pw)            -> user
  DjAuth.signOut()
  DjAuth.hasVault(uid) / DjAuth.checkVault(uid, vaultPw)
  user = { uid, email, created }
*/
(function () {
  var cfg = window.FIREBASE_CONFIG || {};
  var useFirebase = !!(cfg.apiKey && cfg.projectId);
  var ITER = 210000; // PBKDF2 rounds: slow on purpose

  /* ---------- small helpers ---------- */
  function b64e(buf) {
    var bytes = new Uint8Array(buf), s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64d(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function randomB64(n) { return b64e(crypto.getRandomValues(new Uint8Array(n))); }

  async function hashPw(pw, saltB64, iter) {
    if (!(window.crypto && crypto.subtle)) {
      throw new Error("Secure hashing needs https or localhost. Open the app from http://localhost or http://127.0.0.1 (Live Server), or an https address.");
    }
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: b64d(saltB64), iterations: iter },
      key, 256
    );
    return b64e(bits);
  }
  function same(a, b) { // compare without bailing out early
    if (a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }
  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }

  /* ---------- vault password (same for both backends) ---------- */
  var VKEY = function (uid) { return "dj:vault:" + uid; };

  async function setVault(uid, vaultPw) {
    var salt = randomB64(16);
    var hash = await hashPw(vaultPw, salt, ITER);
    localStorage.setItem(VKEY(uid), JSON.stringify({ salt: salt, hash: hash, iter: ITER }));
  }
  function hasVault(uid) { return !!read(VKEY(uid), null); }
  async function checkVault(uid, vaultPw) {
    var v = read(VKEY(uid), null);
    if (!v) return false;
    return same(await hashPw(vaultPw, v.salt, v.iter), v.hash);
  }

  /* ---------- LOCAL (device-only) backend ---------- */
  var UKEY = "dj:local-users", SKEY = "dj:local-session";
  var users = function () { return read(UKEY, {}); };
  var pub = function (u) { return { uid: u.uid, email: u.email, created: u.created }; };

  var local = {
    init: async function () {
      var uid = localStorage.getItem(SKEY), all = users();
      for (var k in all) if (all[k].uid === uid) return pub(all[k]);
      return null;
    },
    signUp: async function (email, pw, vaultPw) {
      email = email.trim().toLowerCase();
      var all = users();
      if (all[email]) throw new Error("An account with this email already exists on this device. Try signing in.");
      var salt = randomB64(16);
      var u = {
        uid: "l_" + randomB64(9).replace(/[^a-zA-Z0-9]/g, "x"),
        email: email, created: Date.now(),
        salt: salt, iter: ITER, hash: await hashPw(pw, salt, ITER)
      };
      await setVault(u.uid, vaultPw);
      all[email] = u;
      localStorage.setItem(UKEY, JSON.stringify(all));
      localStorage.setItem(SKEY, u.uid);
      return pub(u);
    },
    signIn: async function (email, pw) {
      email = email.trim().toLowerCase();
      var u = users()[email];
      var bad = new Error("Wrong email or password.");
      if (!u) throw bad;
      if (!same(await hashPw(pw, u.salt, u.iter), u.hash)) throw bad;
      localStorage.setItem(SKEY, u.uid);
      return pub(u);
    },
    signOut: async function () { localStorage.removeItem(SKEY); }
  };

  /* ---------- FIREBASE backend ---------- */
  var fbAuth = null;
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = src; s.onload = ok;
      s.onerror = function () { fail(new Error("Could not load Firebase. Check your internet connection.")); };
      document.head.appendChild(s);
    });
  }
  async function fbReady() {
    if (fbAuth) return fbAuth;
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    await loadScript(base + "firebase-app-compat.js");
    await loadScript(base + "firebase-auth-compat.js");
    firebase.initializeApp(cfg);
    fbAuth = firebase.auth();
    return fbAuth;
  }
  function fbUser(u) {
    return {
      uid: u.uid, email: u.email,
      created: u.metadata && u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : Date.now()
    };
  }
  function fbMsg(e) {
    var m = {
      "auth/invalid-credential": "Wrong email or password.",
      "auth/wrong-password": "Wrong email or password.",
      "auth/user-not-found": "Wrong email or password.",
      "auth/invalid-email": "That email address does not look right.",
      "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
      "auth/weak-password": "Password is too weak. Use at least 6 characters.",
      "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
      "auth/network-request-failed": "Network problem. Check your connection.",
      "auth/operation-not-allowed": "Email/Password sign-in is not switched on in your Firebase project yet."
    }[e && e.code];
    return new Error(m || (e && e.message) || "Something went wrong.");
  }

  var firebaseBackend = {
    init: async function () {
      var a = await fbReady();
      return new Promise(function (ok) {
        var off = a.onAuthStateChanged(function (u) { off(); ok(u ? fbUser(u) : null); });
      });
    },
    signUp: async function (email, pw, vaultPw) {
      var a = await fbReady(), cred;
      try { cred = await a.createUserWithEmailAndPassword(email.trim(), pw); }
      catch (e) { throw fbMsg(e); }
      await setVault(cred.user.uid, vaultPw);
      return fbUser(cred.user);
    },
    signIn: async function (email, pw) {
      var a = await fbReady();
      try { return fbUser((await a.signInWithEmailAndPassword(email.trim(), pw)).user); }
      catch (e) { throw fbMsg(e); }
    },
    signOut: async function () { var a = await fbReady(); await a.signOut(); }
  };

  var backend = useFirebase ? firebaseBackend : local;
  window.DjAuth = {
    kind: useFirebase ? "firebase" : "local",
    init: backend.init,
    signUp: backend.signUp,
    signIn: backend.signIn,
    signOut: backend.signOut,
    hasVault: hasVault,
    checkVault: checkVault
  };
})();
