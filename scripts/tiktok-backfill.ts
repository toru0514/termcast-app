import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { createScriptGenerator } from '../src/script/index.js';
import { buildSceneFile } from '../src/scene/build.js';
import { buildSocialText, TikTokUploader } from '../src/social/index.js';
import { SocialStatusStore } from '../src/social/status.js';
import { renderCaptionsHtml, type CaptionItem } from '../src/social/captions-page.js';
import { loadCaptionCache, saveCaptionCache } from '../src/social/caption-cache.js';
import { termFromFilename, loadSeedByTerm, toTerm } from '../src/social/video-terms.js';

/**
 * 既存の生成済み動画(video/*.mp4)をまとめて TikTok の下書き(inbox)へ送るバックフィル。
 *
 * 下書き(inbox)はAPIで説明文/ハッシュタグを埋め込めない（公開時にアプリで手入力）ため、
 * 各動画の説明文＋ハッシュタグは output/tiktok-captions.md に出力し、公開時のコピペ用とする。
 * 過去動画は scene.json が残っていないので、ファイル名の用語から台本(定義)を再生成して
 * リッチなキャプションを作る。
 *
 * TikTok は「未公開の下書き(pending share)」を一度に溜められる数に上限があり、超えると
 * spam_risk_too_many_pending_share で弾かれる。アプリ側で下書きを公開/削除して枠を空けてから
 * 再実行する運用のため、(1)送信済みはスキップ、(2)上限エラーを検知したら即停止、にしている。
 *
 *   npm run tiktok:backfill            送信＋キャプション出力（送信済みはスキップ）
 *   npm run tiktok:backfill -- --dry-run   キャプション出力だけ（送信しない）
 *   npm run tiktok:backfill -- --force     送信済みも再送する
 */
const CAPTIONS_PATH = resolve(paths.output, 'tiktok-captions.md');
// GitHub Pages で配信するモバイル向けキャプション閲覧ページ（コミット対象）。
const CAPTIONS_HTML_PATH = resolve(paths.root, 'captions.html');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const refresh = process.argv.includes('--refresh'); // キャッシュを無視して全キャプション再生成
  const files = (await readdir(paths.video)).filter((f) => f.toLowerCase().endsWith('.mp4')).sort();
  if (files.length === 0) {
    console.error('video/ に .mp4 がありません。');
    process.exit(1);
  }

  const generator = createScriptGenerator();
  const seedMap = await loadSeedByTerm();
  const uploader = new TikTokUploader(); // レート制限は 1 インスタンスで共有
  const store = new SocialStatusStore();

  if (!dryRun && !uploader.enabled) {
    console.error('TikTokの認証情報がありません。npm run tiktok:auth を先に実行してください。');
    process.exit(1);
  }

  const statusAll = await store.load();
  const captionCache = await loadCaptionCache();
  console.log(`対象 ${files.length} 本${dryRun ? '（dry-run: 送信しない）' : ''}\n`);

  const sections: string[] = [];
  const items: CaptionItem[] = [];
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let stoppedByLimit = false;
  // 上限到達後も「キャプション生成」は全件続け、閲覧ページに全動画を載せる。送信だけ止める。
  let sendingBlocked = false;

  for (const [i, file] of files.entries()) {
    const termStr = termFromFilename(file);
    const videoPath = resolve(paths.video, file);
    const idx = `[${i + 1}/${files.length}]`;

    // 1) キャプションは常に用意（送信可否と独立）。キャッシュがあれば再生成しない（文言を固定）。
    let body = '';
    let draftId = '';
    let itemError: string | undefined;
    let term;
    try {
      term = toTerm(termStr, seedMap.get(termStr));
      draftId = statusAll[term.id]?.tiktok?.targetId ?? '';
      if (captionCache[file] && !refresh) {
        body = captionCache[file].body;
      } else {
        const script = await generator.generate(term);
        body = buildSocialText(buildSceneFile(term, script), 'tiktok').body;
        captionCache[file] = { term: termStr, body };
      }
    } catch (err) {
      failed++;
      itemError = (err as Error).message;
      console.error(`${idx} ❌ ${termStr}: キャプション生成失敗 ${itemError}`);
      items.push({ term: termStr, file, draftId: '', body: '', error: itemError });
      sections.push(`## ${termStr}\n- 動画: \`${file}\`\n- エラー: ${itemError}\n`);
      continue;
    }

    // 2) 送信（dry-run / 送信済み / 上限ブロック時は送らない）
    const already = statusAll[term.id]?.tiktok?.stage === 'draft_sent';
    if (dryRun) {
      console.log(`${idx} 📝 ${termStr} → キャプション生成のみ`);
    } else if (already && !force) {
      skipped++;
      console.log(`${idx} ⏭️  ${termStr} → 送信済みのためスキップ (id=${draftId})`);
    } else if (sendingBlocked) {
      console.log(`${idx} ⏸️  ${termStr} → 下書き上限のため送信スキップ`);
    } else {
      try {
        const res = await uploader.upload(videoPath, undefined, 'inbox');
        draftId = res.publishId;
        await store.set(term.id, {
          platform: 'tiktok',
          stage: 'draft_sent',
          targetId: draftId,
          message: `backfill: ${file}`,
        });
        ok++;
        console.log(`${idx} ✅ ${termStr} → 下書き送信 (id=${draftId})`);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('spam_risk_too_many_pending_share')) {
          sendingBlocked = true;
          stoppedByLimit = true;
          console.error(
            `${idx} ⚠️ ${termStr}: 未公開下書きが上限に達したため以降の送信を停止（キャプション生成は継続）`,
          );
        } else {
          failed++;
          itemError = msg;
          console.error(`${idx} ❌ ${termStr}: ${msg}`);
        }
      }
    }

    items.push({ term: termStr, file, draftId, body, error: itemError });
    sections.push(
      [
        `## ${termStr}`,
        `- 動画: \`${file}\``,
        draftId ? `- 下書きID: \`${draftId}\`` : '- 下書きID: (未送信)',
        '',
        '```',
        body,
        '```',
        '',
      ].join('\n'),
    );
  }

  await saveCaptionCache(captionCache);
  await mkdir(paths.output, { recursive: true });
  const header = [
    '# TikTok 下書き用 キャプション集',
    '',
    '下書き(inbox)はAPIで説明文を埋め込めないため、公開時にTikTokアプリで以下をコピペしてください。',
    '',
    `対象: ${files.length}本 / 送信成功: ${ok} / スキップ(送信済): ${skipped} / 失敗: ${failed}`,
    '',
    '---',
    '',
  ].join('\n');
  await writeFile(CAPTIONS_PATH, header + sections.join('\n'));

  // スマホ閲覧用HTML（GitHub Pages 配信）。generatedAt は resume 制約と無関係なのでここで確定。
  const html = renderCaptionsHtml(items, {
    total: files.length,
    ok,
    skipped,
    failed,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  });
  await writeFile(CAPTIONS_HTML_PATH, html);

  console.log(`\n完了: 成功 ${ok} / スキップ ${skipped} / 失敗 ${failed}`);
  if (stoppedByLimit) console.log('（下書き上限で途中停止。枠を空けて再実行してください）');
  console.log(`キャプション(md): ${CAPTIONS_PATH}`);
  console.log(`キャプション(html): ${CAPTIONS_HTML_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
