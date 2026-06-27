import { readFileSync, appendFileSync, readFileSync as read } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { google } from 'googleapis';
import { config, paths } from '../src/config.js';

/**
 * YouTube アップロード用の refresh token を一度だけ取得して .env に保存する。
 * gws の Desktop OAuth クライアント(client_secret.json)を流用するので新規クライアント作成は不要。
 * 事前に GCP で「YouTube Data API v3」を有効化しておくこと。
 */
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];
const PORT = 4173;

async function main() {
  const raw = JSON.parse(readFileSync(config.youtube.clientSecretPath, 'utf8'));
  const c = raw.installed ?? raw.web;
  if (!c?.client_id) throw new Error(`OAuth client が読めません: ${config.youtube.clientSecretPath}`);

  const redirectUri = `http://localhost:${PORT}`;
  const oauth2 = new google.auth.OAuth2(c.client_id, c.client_secret, redirectUri);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  const code: string = await new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '', redirectUri);
      const codeParam = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      if (err) {
        res.end(`認証エラー: ${err}。ターミナルに戻ってください。`);
        server.close();
        reject(new Error(err));
        return;
      }
      if (codeParam) {
        res.end('認証完了しました。ターミナルに戻ってください。');
        server.close();
        resolvePromise(codeParam);
      } else {
        res.statusCode = 400;
        res.end('code がありません');
      }
    });
    server.listen(PORT, () => {
      console.log('\nブラウザで同意してください。開かない場合は次のURLを手動で開く:\n');
      console.log(authUrl + '\n');
      spawn('open', [authUrl], { stdio: 'ignore', detached: true }).unref();
    });
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('refresh_token が取得できませんでした（既に同意済みの場合は OAuth 同意をリセットして再実行）');
  }

  const envPath = resolve(paths.root, '.env');
  let env = '';
  try {
    env = read(envPath, 'utf8');
  } catch {
    /* .env が無ければ新規 */
  }
  if (/^YOUTUBE_REFRESH_TOKEN=/m.test(env)) {
    console.log('\n⚠️ .env に既に YOUTUBE_REFRESH_TOKEN があります。次の値で置き換えてください:');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } else {
    appendFileSync(envPath, `\nYOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('\n✅ .env に YOUTUBE_REFRESH_TOKEN を保存しました。');
  }
  console.log('これで npm run generate 時に YouTube へ自動アップロードされます。');
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
