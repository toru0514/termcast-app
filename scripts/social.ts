import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { SceneFileSchema } from '../src/types.js';
import type { RunManifest } from '../src/meta.js';
import { runSocial } from '../src/social/index.js';
import {
  ACTIVE_SOCIAL_PLATFORMS,
  ALL_SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '../src/social/platforms.js';

/**
 * SNS投稿自動化 CLI（YouTube以外: TikTok / Instagram / X）。
 * 直近の generate 結果(output/last.json)を入力に、媒体別の下書き送信/公開/生成を行う。
 *
 *   npm run social                 全媒体
 *   npm run social -- --only x      X のみ
 *   npm run social -- --dry-run     本文案の確認だけ（送信しない）
 */
function parseOnly(argv: string[]): SocialPlatform[] | undefined {
  const idx = argv.indexOf('--only');
  if (idx === -1) return undefined;
  const list = (argv[idx + 1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is SocialPlatform => (ALL_SOCIAL_PLATFORMS as readonly string[]).includes(s));
  return list.length ? list : undefined;
}

async function main() {
  const manifestPath = resolve(paths.output, 'last.json');
  if (!existsSync(manifestPath)) {
    console.error('output/last.json がありません。先に npm run generate を実行してください。');
    process.exit(1);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as RunManifest;
  if (!existsSync(manifest.video)) {
    console.error(`動画が見つかりません: ${manifest.video}`);
    process.exit(1);
  }
  if (!existsSync(manifest.scene)) {
    console.error(`scene.json が見つかりません: ${manifest.scene}`);
    process.exit(1);
  }

  const sceneFile = SceneFileSchema.parse(JSON.parse(await readFile(manifest.scene, 'utf8')));
  const platforms = parseOnly(process.argv.slice(2));
  const dryRun = process.argv.includes('--dry-run');

  console.log(`SNS配信対象: ${manifest.term} (${manifest.video})`);
  console.log(
    `媒体: ${platforms ? platforms.join(', ') : `default (${ACTIVE_SOCIAL_PLATFORMS.join(', ')})`}${dryRun ? ' [dry-run]' : ''}`,
  );

  const results = await runSocial({
    contentId: manifest.termId,
    videoPath: manifest.video,
    sceneFile,
    platforms,
    dryRun,
  });

  for (const r of results) {
    const icon = r.outcome === 'ok' ? '✅' : r.outcome === 'skipped' ? '⏭️ ' : '❌';
    const parts = [
      `${icon} ${r.platform}: ${r.outcome}`,
      r.stage ? `[${r.stage}]` : '',
      r.targetId ? `id=${r.targetId}` : '',
      r.link ? r.link : '',
      r.message ? `— ${r.message}` : '',
    ].filter(Boolean);
    console.log(parts.join(' '));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
