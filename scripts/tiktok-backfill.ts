import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { TermSchema, type Term } from '../src/types.js';
import { createScriptGenerator } from '../src/script/index.js';
import { buildSceneFile } from '../src/scene/build.js';
import { buildSocialText, TikTokUploader } from '../src/social/index.js';
import { SocialStatusStore } from '../src/social/status.js';

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

/** `PBR_2026-06-27-...mp4` / `NISA_final.mp4` → 用語部分を取り出す */
function termFromFilename(file: string): string {
  return file
    .replace(/\.mp4$/i, '')
    .replace(/_(\d{4}-\d{2}-\d{2}.*|final)$/i, '');
}

async function loadSeedByTerm(): Promise<Map<string, Partial<Term>>> {
  const map = new Map<string, Partial<Term>>();
  try {
    const seed = JSON.parse(await readFile(paths.seed, 'utf8')) as Array<Record<string, unknown>>;
    seed.forEach((s, i) => {
      if (typeof s.term === 'string') {
        map.set(s.term, {
          id: (s.id as string) ?? `seed-${i}`,
          term: s.term,
          reading: (s.reading as string) ?? '',
          category: (s.category as string) ?? '',
          difficulty: (s.difficulty as number) ?? 1,
        });
      }
    });
  } catch {
    /* seed が無ければ用語名だけで進める */
  }
  return map;
}

function toTerm(termStr: string, seed?: Partial<Term>): Term {
  return TermSchema.parse({
    id: seed?.id ?? termStr,
    term: termStr,
    reading: seed?.reading ?? '',
    category: seed?.category ?? '',
    difficulty: seed?.difficulty ?? 1,
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
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
  console.log(`対象 ${files.length} 本${dryRun ? '（dry-run: 送信しない）' : ''}\n`);

  const sections: string[] = [];
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let stoppedByLimit = false;

  for (const [i, file] of files.entries()) {
    const termStr = termFromFilename(file);
    const videoPath = resolve(paths.video, file);
    const idx = `[${i + 1}/${files.length}]`;
    try {
      const term = toTerm(termStr, seedMap.get(termStr));
      const already = statusAll[term.id]?.tiktok?.stage === 'draft_sent';
      const script = await generator.generate(term);
      const sceneFile = buildSceneFile(term, script);
      const social = buildSocialText(sceneFile, 'tiktok');

      let draftId = statusAll[term.id]?.tiktok?.targetId ?? '';
      if (!dryRun && already && !force) {
        skipped++;
        console.log(`${idx} ⏭️  ${termStr} → 送信済みのためスキップ (id=${draftId})`);
      } else if (!dryRun) {
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
      } else {
        console.log(`${idx} 📝 ${termStr} → キャプション生成のみ`);
      }

      sections.push(
        [
          `## ${termStr}`,
          `- 動画: \`${file}\``,
          draftId ? `- 下書きID: \`${draftId}\`` : '- 下書きID: (未送信)',
          '',
          '```',
          social.body,
          '```',
          '',
        ].join('\n'),
      );
    } catch (err) {
      const msg = (err as Error).message;
      failed++;
      console.error(`${idx} ❌ ${termStr}: ${msg}`);
      sections.push(`## ${termStr}\n- 動画: \`${file}\`\n- エラー: ${msg}\n`);
      // 未公開下書きの上限に達した場合、以降も必ず失敗するので即停止して枠空けを促す。
      if (msg.includes('spam_risk_too_many_pending_share')) {
        stoppedByLimit = true;
        console.error(
          '\n⚠️ 未公開の下書き(pending)が上限に達しました。TikTokアプリで下書きを公開/削除して枠を空けてから、\n' +
            '   もう一度 npm run tiktok:backfill を実行してください（送信済みは自動スキップされます）。',
        );
        break;
      }
    }
  }

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

  console.log(`\n完了: 成功 ${ok} / スキップ ${skipped} / 失敗 ${failed}`);
  if (stoppedByLimit) console.log('（下書き上限で途中停止。枠を空けて再実行してください）');
  console.log(`キャプション: ${CAPTIONS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
