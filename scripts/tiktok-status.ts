import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { TikTokUploader } from '../src/social/index.js';

/**
 * 送信済み TikTok コンテンツの処理状況を確認する診断ツール。
 * output/social-status.json に記録された publish_id ごとに status/fetch を叩く。
 * inbox 送信は SEND_TO_USER_INBOX なら「アプリの通知(受信トレイ)に届いている」状態。
 *
 *   npm run tiktok:status
 */
async function main() {
  const statusPath = resolve(paths.output, 'social-status.json');
  if (!existsSync(statusPath)) {
    console.error('output/social-status.json がありません。まだ送信していません。');
    process.exit(1);
  }
  const data = JSON.parse(await readFile(statusPath, 'utf8')) as Record<
    string,
    { tiktok?: { targetId?: string | null; message?: string } }
  >;

  const targets = Object.entries(data)
    .map(([contentId, v]) => ({ contentId, publishId: v.tiktok?.targetId ?? '', note: v.tiktok?.message }))
    .filter((t) => t.publishId);

  if (targets.length === 0) {
    console.error('TikTok の publish_id が記録されていません。');
    process.exit(1);
  }

  const uploader = new TikTokUploader();
  console.log(`TikTok 送信済み ${targets.length} 件のステータスを確認します…\n`);
  for (const t of targets) {
    try {
      const s = await uploader.queryStatus(t.publishId);
      const hint = STATUS_HINT[s.status] ?? '';
      console.log(`• ${t.contentId}: ${s.status}${hint ? ` — ${hint}` : ''}${s.failReason ? ` (fail: ${s.failReason})` : ''}`);
    } catch (err) {
      console.log(`• ${t.contentId}: 取得失敗 — ${(err as Error).message}`);
    }
  }
  console.log(
    '\nSEND_TO_USER_INBOX = アプリの「通知(受信トレイ)」に届いています。TikTokアプリ下部の通知タブを確認してください。',
  );
}

const STATUS_HINT: Record<string, string> = {
  SEND_TO_USER_INBOX: 'アプリの通知に到達（下書きフォルダではなく通知から開く）',
  PROCESSING_UPLOAD: 'アップロード処理中',
  PROCESSING_DOWNLOAD: 'ダウンロード処理中',
  PUBLISH_COMPLETE: '公開完了',
  FAILED: '失敗',
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
