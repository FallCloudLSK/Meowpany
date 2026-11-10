// 喵咪系列共用：把瀏覽器的 alert() 換成遊戲自己的對話框。
// 瀏覽器原生的警告視窗標題會顯示網址，長輩看不懂；這裡改成用遊戲名稱當標題、中文說明。
// 用法：在 index.html 的 <head> 加 <script src="../shared/meow-dialog.js" data-title="喵咪電力公司"></script>
(function () {
  'use strict';
  const me = document.currentScript;
  const title = (me && me.dataset.title) || document.title || '喵咪遊戲';

  // 常見英文訊息 → 中文
  function translate(msg) {
    const m = String(msg || '');
    if (/WebGL context lost/i.test(m)) {
      return { text: '畫面休息太久了，需要重新整理一下才能繼續玩。\n進度都有存好，不會不見喔！', reload: true };
    }
    if (/reload/i.test(m)) {
      return { text: '遊戲需要重新整理一下才能繼續。\n進度都有存好，不會不見喔！', reload: true };
    }
    return { text: m, reload: false };
  }

  function show(msg) {
    const t = translate(msg);
    const old = document.getElementById('meow-dialog');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'meow-dialog';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;';
    const box = document.createElement('div');
    box.style.cssText = 'box-sizing:border-box;background:#fff;border:6px solid #FFB547;border-radius:28px;padding:28px 24px;max-width:min(86vw,520px);text-align:center;color:#3B2A1A;box-shadow:0 8px 30px rgba(0,0,0,.25);';
    const h = document.createElement('div');
    h.textContent = '🐱 ' + title;
    h.style.cssText = 'font-size:26px;font-weight:700;color:#C9701A;margin-bottom:14px;';
    const p = document.createElement('div');
    p.textContent = t.text;
    p.style.cssText = 'font-size:21px;font-weight:700;line-height:1.6;white-space:pre-line;margin-bottom:22px;';
    const b = document.createElement('button');
    b.textContent = t.reload ? '重新整理' : '好';
    b.style.cssText = 'font-size:24px;font-weight:700;color:#3B2A1A;background:#FFB547;border:none;border-bottom:6px solid #C9701A;border-radius:22px;padding:14px 40px;min-width:200px;cursor:pointer;';
    b.onclick = function () {
      if (t.reload) location.reload();
      else wrap.remove();
    };
    box.append(h, p, b);
    wrap.append(box);
    (document.body || document.documentElement).append(wrap);
  }

  window.alert = show;
  window.meowDialog = { show: show };
})();
