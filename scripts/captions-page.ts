import { readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { SocialStatusStore } from '../src/social/status.js';
import { renderCaptionsHtml, type CaptionItem } from '../src/social/captions-page.js';
import { loadCaptionCache } from '../src/social/caption-cache.js';
import { termFromFilename, loadSeedByTerm, toTerm } from '../src/social/video-terms.js';

/**
 * captions.html を再生成する軽量コマンド（Gemini呼び出しなし）。
 * キャプションはキャッシュ(output/tiktok-captions.json)から、送信状況は social-status.json から読む。
 * generate が新規動画のキャプションをキャッシュへ入れるので、日次はこれを呼ぶだけでページが最新化される。
 *
 *   npm run captions:page
 */
const CAPTIONS_HTML_PATH = resolve(paths.root, 'captions.html');

async function main() {
  const files = (await readdir(paths.video)).filter((f) => f.toLowerCase().endsWith('.mp4')).sort();
  const cache = await loadCaptionCache();
  const statusAll = await new SocialStatusStore().load();
  const seedMap = await loadSeedByTerm();

  let sent = 0;
  const items: CaptionItem[] = files.map((file) => {
    const termStr = termFromFilename(file);
    const term = toTerm(termStr, seedMap.get(termStr));
    const draftId = statusAll[term.id]?.tiktok?.targetId ?? '';
    if (draftId) sent++;
    return { term: termStr, file, draftId, body: cache[file]?.body ?? '' };
  });

  const html = renderCaptionsHtml(items, {
    total: files.length,
    ok: sent,
    skipped: 0,
    failed: items.filter((it) => !it.body).length,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  });
  await writeFile(CAPTIONS_HTML_PATH, html);
  console.log(`captions.html を更新: 全${files.length}本 / 下書き済 ${sent} → ${CAPTIONS_HTML_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
