# Meowpany 喵咪系列

給長輩玩的可愛貓咪益智網頁遊戲（GitHub Pages）。登入、雲端存檔與排行榜用 Firebase 專案 Meowporation（Spark 免費方案）。

| 遊戲 | 資料夾 | 網址 |
|---|---|---|
| 喵咪電力公司 | `Meowatt/` | https://fallcloudlsk.github.io/Meowpany/Meowatt/ |

`Meowatt/` 由 Godot 專案的 `tools/export_web.py publish` 自動匯出並推送，請不要手動修改。

## Firebase

- `shared/meow-cloud.js`：各遊戲共用的雲端模組（Google 登入、雲端存檔、排行榜）。Godot 匯出設定的 `head_include` 會載入它，遊戲用 `JavaScriptBridge` 呼叫。網址加 `?emu=1` 會改連本機模擬器。

- `firestore.rules`：玩家資料、雲端存檔、三種排行榜的資料庫規則（說明在檔案開頭）。
- `firestore.indexes.json`：排行榜排序用的索引。
- `.github/workflows/deploy.yml`：改到上面兩個檔案並推到 main 時，自動部署到 Firebase。
  需要 Secret `FIREBASE_SERVICE_ACCOUNT`（服務帳戶 JSON 金鑰）與 Variable `FIREBASE_PROJECT_ID`。
