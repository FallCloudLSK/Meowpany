# Meowpany 喵咪系列

給長輩玩的可愛貓咪益智網頁遊戲，放在 Firebase 專案 Meowporation。

| 遊戲 | 資料夾 | 網址 |
|---|---|---|
| 喵咪電力公司 | `hosting/Meowatt/` | https://meowporation.web.app/Meowatt/ |

## 資料夾

- `hosting/`：部署到 Firebase Hosting 的內容（系列首頁與各遊戲）。`hosting/Meowatt/` 由 Godot 專案的 `tools/export_web.py publish` 自動匯出，請不要手動修改。
- `pages/`：舊網址 https://fallcloudlsk.github.io/Meowpany/ 的轉址頁。會把舊網址瀏覽器裡的 Godot 存檔（IndexedDB `/userfs`）打包在網址 `#migrate=` 後帶到新網址。
- `firebase.json`、`firestore.rules`、`firestore.indexes.json`：Hosting 設定與雲端存檔、排行榜的資料庫規則。
- `.github/workflows/deploy.yml`：推到 main 自動部署 Firebase 與 GitHub Pages；PR 會產生預覽網址。

## 需要的 GitHub 設定

- Secret `FIREBASE_SERVICE_ACCOUNT`：Google Cloud 服務帳戶 JSON 金鑰（角色：Firebase 管理員）。
- Variable `FIREBASE_PROJECT_ID`：Firebase 專案 ID（沒設就用 `.firebaserc`）。
- Settings → Pages → Source 選 GitHub Actions。
