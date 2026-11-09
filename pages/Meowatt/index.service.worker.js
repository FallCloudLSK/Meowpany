// 舊版遊戲的 service worker 會從快取直接開出舊遊戲，看不到搬家頁。
// 瀏覽器發現這個檔案變了就會換成這一版：清掉舊快取、取消註冊，再重新載入頁面，
// 玩家就會看到搬家頁並被帶到新網址（存檔在 IndexedDB，不受影響）。
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf('喵咪電力公司-sw-cache-') === 0; })
      .map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var list = await self.clients.matchAll({ type: 'window' });
    list.forEach(function (client) {
      try { client.navigate(client.url); } catch (e) { /* ignore */ }
    });
  })());
});
