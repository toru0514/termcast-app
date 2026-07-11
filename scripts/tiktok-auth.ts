import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { config, paths } from '../src/config.js';
import { exchangeCode } from '../src/social/tiktok.js';

/**
 * TikTok Content Posting API 用のトークンを取得して .env に保存する（youtube:auth 相当）。
 *
 * TikTok は localhost をRedirect URIに使えないため、GitHub Pages のコールバックページ
 * (config.tiktok.redirectUri) に表示される authorization code を手で貼り付ける方式にする。
 * 取得した refresh_token（有効約365日）を保存すれば、以降は実行時に自動リフレッシュされる。
 *
 * 事前準備:
 *   .env に TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET を設定（開発者ポータルの Sandbox の値）。
 */
async function main() {
  const { clientKey, clientSecret, redirectUri, scopes } = config.tiktok;
  if (!clientKey || !clientSecret) {
    throw new Error('.env に TIKTOK_CLIENT_KEY と TIKTOK_CLIENT_SECRET を設定してください。');
  }

  const state = 'termcast';
  const authUrl =
    'https://www.tiktok.com/v2/auth/authorize/?' +
    new URLSearchParams({
      client_key: clientKey,
      scope: scopes,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    }).toString();

  console.log('\nブラウザでTikTokの認可画面を開きます。連携するアカウントで承認してください。');
  console.log('（Sandboxの場合は Target users に登録済みのアカウントである必要があります）\n');
  console.log('開かない場合は次のURLを手動で開く:\n' + authUrl + '\n');
  spawn('open', [authUrl], { stdio: 'ignore', detached: true }).unref();

  const rl = createInterface({ input: stdin, output: stdout });
  const raw = await rl.question(
    `承認後、コールバックページ(${redirectUri})に表示される code を貼り付けてEnter:\n> `,
  );
  rl.close();
  // ページからのコピペで前後に空白やURL全体が入っても拾えるよう緩めに抽出。
  const code = extractCode(raw.trim());
  if (!code) throw new Error('code を認識できませんでした。ページに表示された値をそのまま貼ってください。');

  const tokens = await exchangeCode(code);
  saveEnv({
    TIKTOK_ACCESS_TOKEN: tokens.accessToken,
    TIKTOK_REFRESH_TOKEN: tokens.refreshToken,
  });

  console.log('\n✅ .env に TIKTOK_ACCESS_TOKEN と TIKTOK_REFRESH_TOKEN を保存しました。');
  console.log(`   open_id: ${tokens.openId ?? '(なし)'}`);
  console.log(`   scope  : ${tokens.scope ?? scopes}`);
  console.log('   access_token は24時間で失効しますが、実行時に refresh_token で自動更新されます。');
  console.log('\n次: npm run social -- --only tiktok で投稿を試せます。');
}

/** 貼り付け値が code 単体でも `...?code=xxx&state=...` のURLでも拾う。 */
function extractCode(input: string): string {
  if (input.includes('code=')) {
    const m = input.match(/[?&]code=([^&\s]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return input;
}

/** .env の該当キーを上書き（無ければ追記）。 */
function saveEnv(vars: Record<string, string>): void {
  const envPath = resolve(paths.root, '.env');
  let env = '';
  try {
    env = readFileSync(envPath, 'utf8');
  } catch {
    /* 無ければ新規 */
  }
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`;
    if (new RegExp(`^${key}=.*$`, 'm').test(env)) {
      env = env.replace(new RegExp(`^${key}=.*$`, 'm'), line);
    } else {
      env += (env.endsWith('\n') || env === '' ? '' : '\n') + line + '\n';
    }
  }
  if (env && !env.endsWith('\n')) env += '\n';
  writeFileSync(envPath, env);
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
