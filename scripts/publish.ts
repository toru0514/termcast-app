import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { createTermStore } from '../src/pick/store.js';
import {
  ALL_PLATFORMS,
  createPublishers,
  publishAll,
  resultsToPublishFields,
  type Platform,
} from '../src/publish/index.js';
import type { RunManifest } from '../src/meta.js';

function parseOnly(argv: string[]): Platform[] | undefined {
  const idx = argv.indexOf('--only');
  if (idx === -1) return undefined;
  const list = (argv[idx + 1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Platform => (ALL_PLATFORMS as readonly string[]).includes(s));
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

  const only = parseOnly(process.argv.slice(2));
  const dryRun = process.argv.includes('--dry-run');

  console.log(`配信対象: ${manifest.term} (${manifest.video})`);
  console.log(`媒体: ${only ? only.join(', ') : 'all (youtube, tiktok, instagram)'}${dryRun ? ' [dry-run]' : ''}`);

  if (dryRun) {
    console.log('dry-run のため実際の配信は行いません。');
    return;
  }

  const publishers = createPublishers(only);
  const results = await publishAll(publishers, { path: manifest.video }, manifest.meta);

  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⏭️ ' : '❌';
    console.log(`${icon} ${r.platform}: ${r.status}${r.id ? ` id=${r.id}` : ''}${r.link ? ` ${r.link}` : ''}${r.message ? ` — ${r.message}` : ''}`);
  }

  // いずれか成功していれば published として記録
  if (results.some((r) => r.status === 'ok')) {
    const store = createTermStore();
    await store.markPublished(manifest.termId, resultsToPublishFields(results));
    console.log(`\n用語ステータスを published に更新しました (${store.name})。`);
  } else {
    console.log('\n成功した媒体がないため、ステータス更新はスキップしました。');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
