// 部署前檢查服務帳戶金鑰（GOOGLE_APPLICATION_CREDENTIALS），只印出不機密的欄位。
// 用法：node check-credentials.mjs <專案 ID>
import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const fail = (msg) => { console.log(`::error::${msg}`); process.exit(1); };
const project = process.argv[2];
const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let key;
try {
  key = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
} catch (e) {
  fail('FIREBASE_SERVICE_ACCOUNT 不是有效的 JSON。請把下載的 .json 金鑰檔「整個內容」（從 { 到 }）貼進 Secret。');
}
console.log(`type=${key.type} project_id=${key.project_id} client_email=${key.client_email} has_private_key=${Boolean(key.private_key)}`);
if (key.type !== 'service_account' || !key.private_key || !key.client_email) {
  fail('FIREBASE_SERVICE_ACCOUNT 不是服務帳戶金鑰（type 要是 service_account，且要有 private_key）。請在 Firebase 主控台 → 專案設定 → 服務帳戶 →「產生新的私密金鑰」，把整個 .json 內容貼進 Secret。');
}
if (key.project_id !== project) {
  console.log(`::warning::金鑰屬於專案 ${key.project_id}，但要部署到 ${project}。`);
}
try {
  const auth = new GoogleAuth({ keyFile: file, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const token = await (await auth.getClient()).getAccessToken();
  if (!token?.token) throw new Error('沒有拿到 access token');
  console.log('金鑰可以登入 Google（取得 access token 成功）');
} catch (e) {
  fail(`金鑰無法登入 Google：${e.message}（金鑰可能已被刪除或停用，請重新產生一把）`);
}
