import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths } from '../src/config.js';
import { readSceneFile } from '../src/scene/io.js';
import { renderShort } from '../src/remotion/render.js';

/**
 * 既存の scene/scene.json（＋ src/remotion/public の音声）から動画だけ再生成する。
 * Gemini / VOICEVOX を再実行せずレンダリングだけ試したいとき用。
 */
async function main() {
  const sceneFile = await readSceneFile();
  await mkdir(paths.video, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const safeTerm = sceneFile.term.replace(/[\\/:*?"<>|]/g, '_');
  const out = resolve(paths.video, `${safeTerm}_${stamp}_rerender.mp4`);

  console.log(`re-render: ${sceneFile.term} → ${out}`);
  let lastPct = -1;
  await renderShort(sceneFile, out, (ratio) => {
    const pct = Math.floor(ratio * 100);
    if (pct >= lastPct + 10) {
      lastPct = pct;
      process.stdout.write(`  render ${pct}%\r`);
    }
  });
  console.log(`\n完了: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
