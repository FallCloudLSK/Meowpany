// 舊網址（GitHub Pages）→ 新網址（Firebase Hosting）的搬家工具。
//
// Godot 網頁版把 user:// 存在這個網域的 IndexedDB（資料庫 "/userfs"，物件倉庫 "FILE_DATA"）。
// 新網址是不同網域讀不到，所以在這裡讀出存檔，放在網址 # 後面帶過去（# 後面不會傳到伺服器）。
//
// 格式：#migrate=<z|j>.<base64url>
//   z = deflate-raw 壓縮後的 JSON，j = 未壓縮 JSON（舊瀏覽器沒有 CompressionStream 時）
//   JSON = {"v":1,"from":"<舊網址>","files":{"godot/app_userdata/<遊戲>/<檔名>":"<base64>"}}
// 新網址的 meow-cloud.js 會解開，交給遊戲當成匯入進度處理（有衝突時讓玩家選）。
(function () {
  'use strict';

  var NEW_ORIGIN = 'https://meowporation.web.app';

  var SKIP = /(^|\/)(logs|shader_cache|vulkan|\.godot)(\/|$)/;
  var MAX_FILE = 256 * 1024;
  var MAX_TOTAL = 1024 * 1024;

  function readUserFiles() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve({}); return; }
      var req;
      try { req = indexedDB.open('/userfs'); } catch (e) { resolve({}); return; }
      req.onupgradeneeded = function () {
        // 資料庫原本不存在：代表這個瀏覽器沒有玩過，不要留下空資料庫
        try { req.transaction.abort(); } catch (e) { /* ignore */ }
      };
      req.onerror = function () { resolve({}); };
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('FILE_DATA')) { db.close(); resolve({}); return; }
        var files = {};
        var total = 0;
        var tx = db.transaction('FILE_DATA', 'readonly');
        var cur = tx.objectStore('FILE_DATA').openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (!c) return;
          var path = String(c.key).replace(/^\/userfs\/?/, '');
          var v = c.value;
          if (v && v.contents && !SKIP.test(path)) {
            var bytes = v.contents instanceof Uint8Array ? v.contents : new Uint8Array(v.contents);
            if (bytes.length <= MAX_FILE && total + bytes.length <= MAX_TOTAL) {
              files[path] = bytesToB64(bytes);
              total += bytes.length;
            }
          }
          c.continue();
        };
        tx.oncomplete = function () { db.close(); resolve(files); };
        tx.onerror = function () { db.close(); resolve(files); };
      };
    });
  }

  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function toB64Url(bytes) {
    return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function encode(obj) {
    var json = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === 'undefined') {
      return Promise.resolve('j.' + toB64Url(json));
    }
    var stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (buf) {
      return 'z.' + toB64Url(new Uint8Array(buf));
    }, function () {
      return 'j.' + toB64Url(json);
    });
  }

  function run(opts) {
    var target = opts.target;
    var keepQuery = location.search || '';
    var setLink = function (href) { if (opts.linkEl) opts.linkEl.href = href; };
    var say = function (t) { if (opts.statusEl) opts.statusEl.textContent = t; };
    setLink(target + keepQuery);

    readUserFiles().then(function (files) {
      var names = Object.keys(files);
      if (!names.length) {
        say('馬上帶你去新家…');
        return target + keepQuery;
      }
      return encode({ v: 1, from: location.href.split('#')[0], files: files }).then(function (code) {
        say('進度打包好了，馬上帶你去新家…');
        return target + keepQuery + '#migrate=' + code;
      });
    }).catch(function () {
      say('馬上帶你去新家…');
      return target + keepQuery;
    }).then(function (href) {
      setLink(href);
      setTimeout(function () { location.replace(href); }, 1200);
    });
  }

  window.MeowMigrate = { NEW_ORIGIN: NEW_ORIGIN, run: run, readUserFiles: readUserFiles };
})();
