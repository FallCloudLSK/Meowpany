// 喵咪系列共用的雲端功能（Firebase 專案 Meowporation，Spark 免費方案）：
// Google 登入、雲端存檔、排行榜。各遊戲用 gameId 分開（meowatt、travel…）。
//
// Godot 透過 JavaScriptBridge 使用：
//   meowCloud.status()                      → JSON 字串 {ready, user:{uid,name,avatar,hasProfile}|null, inApp, error}
//   meowCloud.call(method, argsJson)        → 請求編號；之後每個畫格 meowCloud.result(id) 取結果
//   meowCloud.result(id)                    → "" 表示還在跑；否則 JSON 字串 {ok:true,value} 或 {ok:false,error}
//   meowCloud.showSignIn()                  → 蓋在畫面上的 HTML 登入視窗（iPad 要真實點擊才能開 Google 視窗）
// method：signOut、setProfile、loadSave、writeSave、submit、board、myRanks
//
// 網址加 ?emu=1 時改連本機 Firebase 模擬器（只給測試用）。
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  connectAuthEmulator, signInWithCredential, setPersistence, browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, query, orderBy, limit, getDocs, where, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB3PcxlT0-ot7YjtGSfyzbdvG0w78O9P7o',
  authDomain: 'meowporation.firebaseapp.com',
  projectId: 'meowporation',
  storageBucket: 'meowporation.firebasestorage.app',
  messagingSenderId: '451663683916',
  appId: '1:451663683916:web:135e2440876b0103c3afe9',
};

const EMU = new URLSearchParams(location.search).get('emu') === '1';
const app = initializeApp(EMU ? { ...firebaseConfig, projectId: 'demo-meow', apiKey: 'demo' } : firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
if (EMU) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
setPersistence(auth, browserLocalPersistence).catch(() => {});

const state = { ready: false, user: null, error: '' };
let profile = null;

// LINE、Facebook、Instagram 等 App 內建瀏覽器：Google 不允許在裡面登入
function inAppBrowser() {
  const ua = navigator.userAgent || '';
  if (/Line\//i.test(ua)) return 'LINE';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/; wv\)/.test(ua)) return 'App';
  return '';
}

// 台灣今天 yyyymmdd（和 firestore.rules 的 taipeiDay() 一樣）
function taipeiDay(offsetDays = 0) {
  const t = new Date(Date.now() + 8 * 3600e3 - offsetDays * 86400e3);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, 'players', uid));
  profile = snap.exists() ? snap.data() : null;
}

onAuthStateChanged(auth, async (u) => {
  try {
    if (u) await loadProfile(u.uid);
    else profile = null;
    state.user = u ? { uid: u.uid } : null;
    state.error = '';
  } catch (e) {
    state.error = String(e && e.code || e);
    state.user = u ? { uid: u.uid } : null;
  }
  state.ready = true;
});

function publicUser() {
  if (!state.user) return null;
  return {
    uid: state.user.uid,
    name: profile ? profile.name : '',
    avatar: profile ? profile.avatar : 0,
    hasProfile: !!profile,
  };
}

function me() {
  if (!auth.currentUser) throw new Error('not-signed-in');
  if (!profile) throw new Error('no-profile');
  return { uid: auth.currentUser.uid, name: profile.name, avatar: profile.avatar };
}

// ------------------------------------------------------------------ 方法
const methods = {
  async signOut() {
    await signOut(auth);
    return true;
  },

  async setProfile({ name, avatar }) {
    const uid = auth.currentUser.uid;
    const data = { name: String(name).slice(0, 16), avatar: avatar | 0, updatedAt: serverTimestamp() };
    if (!profile) data.createdAt = serverTimestamp();
    await setDoc(doc(db, 'players', uid), data, { merge: true });
    profile = { ...(profile || {}), name: data.name, avatar: data.avatar };
    return publicUser();
  },

  // 回傳 {data, cleared, device, at(毫秒)} 或 null
  async loadSave({ gameId }) {
    const snap = await getDoc(doc(db, 'players', auth.currentUser.uid, 'saves', gameId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { data: d.data, cleared: d.cleared, device: d.device || '', at: d.at ? d.at.toMillis() : 0 };
  },

  async writeSave({ gameId, data, cleared, device, saveVersion, backup }) {
    const uid = auth.currentUser.uid;
    if (backup) {
      // 被覆蓋的那份先備份，選錯還救得回來
      const old = await getDoc(doc(db, 'players', uid, 'saves', gameId));
      if (old.exists()) {
        const o = old.data();
        await setDoc(doc(db, 'players', uid, 'saves', gameId + '_backup'), {
          data: o.data, cleared: o.cleared | 0, device: String(o.device || ''), saveVersion: o.saveVersion | 0, at: serverTimestamp(),
        });
      }
    }
    await setDoc(doc(db, 'players', uid, 'saves', gameId), {
      data: String(data), cleared: cleared | 0, device: String(device || '').slice(0, 40), saveVersion: saveVersion | 0, at: serverTimestamp(),
    });
    return true;
  },

  // 上傳成績：kinds 可含 progress（cleared）、count（count）、speed（ms、hints、level）
  async submit({ gameId, progress, count, speed }) {
    const p = me();
    const base = { name: p.name, avatar: p.avatar, at: serverTimestamp() };
    const day = String(taipeiDay());
    const out = {};
    if (progress != null) {
      const ref = doc(db, 'boards', gameId, 'progress', p.uid);
      const old = await getDoc(ref);
      if (!old.exists()) {
        await setDoc(ref, { ...base, cleared: Math.min(progress | 0, 2000) });
      } else if ((progress | 0) > old.data().cleared || old.data().name !== p.name || old.data().avatar !== p.avatar) {
        // 規則限制每 3 秒最多 +1：離線玩了很多關時，先上傳允許的量，之後再補
        const o = old.data();
        const allow = 1 + Math.floor((Date.now() - o.at.toMillis()) / 3000);
        const v = Math.max(o.cleared, Math.min(progress | 0, o.cleared + allow));
        await updateDoc(ref, { ...base, cleared: v });
      }
      out.progress = true;
    }
    if (count != null) {
      const ref = doc(db, 'boards', gameId, 'days', day, 'count', p.uid);
      const old = await getDoc(ref);
      if (!old.exists()) {
        await setDoc(ref, { ...base, count: Math.max(1, Math.min(count | 0, 10)) });
      } else if ((count | 0) > old.data().count) {
        const o = old.data();
        const allow = 1 + Math.floor((Date.now() - o.at.toMillis()) / 3000);
        await updateDoc(ref, { ...base, count: Math.min(count | 0, o.count + allow) });
      }
      out.count = true;
    }
    if (speed != null) {
      const ref = doc(db, 'boards', gameId, 'days', day, 'speed', p.uid);
      const old = await getDoc(ref);
      if (!old.exists()) {
        await setDoc(ref, {
          ...base, ms: Math.max(3000, Math.min(speed.ms | 0, 86400000)),
          hints: Math.min(speed.hints | 0, 99), level: String(speed.level || ''),
        });
        out.speed = true;
      } else {
        out.speed = false; // 今天已經有紀錄（只算第一次）
      }
    }
    return out;
  },

  // 排行榜：kind = speed | progress | count；daysAgo 0~6（progress 不用）
  // 回傳 {day, top:[{uid,name,avatar,value,rank}], me:{rank,value}|null}
  async board({ gameId, kind, daysAgo }) {
    const day = taipeiDay(daysAgo | 0);
    const col = kind === 'progress'
      ? collection(db, 'boards', gameId, 'progress')
      : collection(db, 'boards', gameId, 'days', String(day), kind);
    const field = kind === 'speed' ? 'ms' : (kind === 'progress' ? 'cleared' : 'count');
    const dir = kind === 'speed' ? 'asc' : 'desc';
    const snap = await getDocs(query(col, orderBy(field, dir), orderBy('at', 'asc'), limit(10)));
    const top = [];
    let rank = 0;
    let prev = null;
    snap.forEach((d) => {
      const v = d.data()[field];
      if (v !== prev) { rank = top.length + 1; prev = v; }
      top.push({ uid: d.id, name: d.data().name, avatar: d.data().avatar, value: v, rank });
    });
    let mine = null;
    const uid = auth.currentUser && auth.currentUser.uid;
    if (uid) {
      const hit = top.find((r) => r.uid === uid);
      if (hit) {
        mine = { rank: hit.rank, value: hit.value };
      } else {
        const ms = await getDoc(kind === 'progress'
          ? doc(db, 'boards', gameId, 'progress', uid)
          : doc(db, 'boards', gameId, 'days', String(day), kind, uid));
        if (ms.exists()) {
          const v = ms.data()[field];
          const better = await getCountFromServer(query(col, where(field, dir === 'asc' ? '<' : '>', v)));
          mine = { rank: better.data().count + 1, value: v };
        }
      }
    }
    return { day, top, me: mine };
  },

  // 自己在三個榜（今天）的名次，給主選單喵咪提醒與上榜動畫比較
  async myRanks({ gameId }) {
    const out = {};
    for (const kind of ['speed', 'progress', 'count']) {
      const b = await methods.board({ gameId, kind, daysAgo: 0 });
      out[kind] = b.me ? b.me.rank : 0;
    }
    return out;
  },
};

if (EMU) {
  // 測試用：用模擬器的假 Google 帳號登入
  methods._emuSignIn = async ({ sub, email }) => {
    const cred = GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }));
    await signInWithCredential(auth, cred);
    await loadProfile(auth.currentUser.uid);
    state.user = { uid: auth.currentUser.uid };
    return publicUser();
  };
}

const results = new Map();
let nextId = 1;

function call(method, argsJson) {
  const id = nextId++;
  const fn = methods[method];
  let args = {};
  try { args = argsJson ? JSON.parse(argsJson) : {}; } catch (e) { /* ignore */ }
  if (!fn) {
    results.set(id, JSON.stringify({ ok: false, error: 'no-method' }));
    return id;
  }
  Promise.resolve().then(() => fn(args)).then(
    (value) => results.set(id, JSON.stringify({ ok: true, value: value === undefined ? null : value })),
    (e) => results.set(id, JSON.stringify({ ok: false, error: String((e && (e.code || e.message)) || e) })),
  );
  return id;
}

function result(id) {
  if (!results.has(id)) return '';
  const r = results.get(id);
  results.delete(id);
  return r;
}

// ------------------------------------------------------------------ HTML 登入視窗
let signInEvent = '';   // Godot 讀：'' | 'ok' | 'cancel' | 'error:<code>'

function el(tag, css, text) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text) e.textContent = text;
  return e;
}

const BTN = 'display:block;width:100%;margin:14px 0 0;padding:18px 12px;border:0;border-radius:18px;'
  + 'font:bold 24px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;cursor:pointer;';

function showSignIn() {
  signInEvent = '';
  const old = document.getElementById('meow-signin');
  if (old) old.remove();
  const dim = el('div', 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;'
    + 'align-items:center;justify-content:center;padding:16px;');
  dim.id = 'meow-signin';
  const card = el('div', 'background:#fff;border:5px solid #FFB547;border-radius:28px;max-width:440px;width:100%;'
    + 'padding:26px 22px;text-align:center;color:#3B2A1A;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;');
  card.appendChild(el('div', 'font-size:54px;line-height:1;', '🐱'));
  card.appendChild(el('div', 'font-size:28px;font-weight:bold;margin:10px 0;color:#C9701A;', '用 Google 帳號登入'));
  const app = inAppBrowser();
  const close = (ev) => { dim.remove(); signInEvent = ev; };
  if (app) {
    card.appendChild(el('div', 'font-size:21px;line-height:1.6;',
      `${app} 裡面的瀏覽器不能用 Google 登入。請按右上角「⋯」選「用預設瀏覽器開啟」，或用 Chrome、Safari 打開這個網址。`));
    const url = new URL(location.href);
    url.searchParams.set('openExternalBrowser', '1');
    const open = el('a', BTN + 'background:#FFB547;color:#3B2A1A;text-decoration:none;box-sizing:border-box;', '用外部瀏覽器打開');
    open.href = url.toString();
    card.appendChild(open);
    const copy = el('button', BTN + 'background:#FFE2B0;color:#3B2A1A;', '複製網址');
    copy.onclick = () => {
      const t = location.href.split('?')[0];
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
        () => { copy.textContent = '已經複製了！'; },
        () => { window.prompt('請複製這個網址', t); });
    };
    card.appendChild(copy);
  } else {
    card.appendChild(el('div', 'font-size:21px;line-height:1.6;',
      '登入後，進度會存在雲端，換手機也不怕不見，還可以上排行榜！'));
    const go = el('button', BTN + 'background:#FFB547;color:#3B2A1A;', '登入');
    go.onclick = async () => {
      go.disabled = true;
      go.textContent = '登入中…';
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        await loadProfile(auth.currentUser.uid);
        state.user = { uid: auth.currentUser.uid };
        close('ok');
      } catch (e) {
        const code = String((e && e.code) || e);
        if (code.includes('popup-closed') || code.includes('cancelled-popup')) {
          go.disabled = false;
          go.textContent = '登入';
          return;
        }
        close('error:' + code);
      }
    };
    card.appendChild(go);
  }
  const cancel = el('button', BTN + 'background:#EEE6D8;color:#3B2A1A;', '先不要');
  cancel.onclick = () => close('cancel');
  card.appendChild(cancel);
  dim.appendChild(card);
  document.body.appendChild(dim);
}

function takeSignInEvent() {
  const e = signInEvent;
  signInEvent = '';
  return e;
}

window.meowCloud = {
  status: () => JSON.stringify({ ready: state.ready, user: publicUser(), inApp: inAppBrowser(), error: state.error }),
  call,
  result,
  showSignIn,
  takeSignInEvent,
  taipeiDay,
};
