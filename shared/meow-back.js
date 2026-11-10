// 喵咪系列共用：Android 系統列的返回鍵（＝瀏覽器「上一頁」）交給遊戲處理，不要直接離開網頁。
// 做法：在歷史紀錄多放一格「遊戲中」；按返回鍵時瀏覽器退回那一格，我們馬上再放一格，並通知遊戲。
// 遊戲端設定 window.meowOnBack = 回呼函式（Godot：JavaScriptBridge.create_callback）。
// 用法：在 index.html 的 <head> 加 <script src="../shared/meow-back.js"></script>
(function () {
  'use strict';
  if (!window.history || !history.pushState) return;
  window.meowBackCount = 0;
  function armed() { return !!(history.state && history.state.meowBack); }
  function arm() {
    if (armed()) return;
    try { history.pushState({ meowBack: 1 }, ''); } catch (e) { /* 不支援就算了 */ }
  }
  // Chrome 規定：使用者沒碰過網頁前加的歷史紀錄，返回鍵會跳過，所以第一次點畫面時再放一次
  arm();
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    addEventListener(ev, arm, { capture: true, passive: true });
  });
  addEventListener('popstate', function () {
    if (armed()) return;          // 往前／其他導覽回到「遊戲中」那格，不算返回
    window.meowBackCount++;
    arm();
    if (typeof window.meowOnBack === 'function') {
      try { window.meowOnBack(); } catch (e) { console.warn(e); }
    }
  });
})();
