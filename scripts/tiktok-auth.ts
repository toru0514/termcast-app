import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { stdin, stdout } from 'node:process';
import { config } from '../src/config.js';
import { updateEnv } from '../src/env-file.js';
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
  updateEnv({
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

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
