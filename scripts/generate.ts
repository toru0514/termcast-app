import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { basename } from 'node:path';
import { config, paths } from '../src/config.js';
import { uploadToDrive } from '../src/drive.js';
import { createTermStore } from '../src/pick/store.js';
import { createScriptGenerator } from '../src/script/index.js';
import { buildSceneFile, applyDurations } from '../src/scene/build.js';
import { writeSceneFile } from '../src/scene/io.js';
import { createTtsEngine } from '../src/tts/index.js';
import { renderShort } from '../src/remotion/render.js';
import { buildVideoMeta, type RunManifest } from '../src/meta.js';

const AUDIO_FILE = 'narration.wav';

function log(step: string, msg: string) {
  console.log(`\x1b[36m[${step}]\x1b[0m ${msg}`);
}

async function main() {
  // ①ネタ選定
  const store = createTermStore();
  log('1/6 pick', `store=${store.name}`);
  const term = await store.pickNext();
  if (!term) {
    console.error('pending な用語がありません。data/terms.seed.json を追加するか used.json をリセットしてください。');
    process.exit(1);
  }
  log('1/6 pick', `「${term.term}」(${term.category}, 難易度${term.difficulty})`);

  // ②台本生成
  const generator = createScriptGenerator();
  log('2/6 script', `generator=${generator.name}`);
  const script = await generator.generate(term);

  // ③シーン定義
  let sceneFile = buildSceneFile(term, script);
  log('3/6 scene', `${sceneFile.scenes.length} シーン`);

  // ④音声合成
  const tts = await createTtsEngine();
  log('4/6 tts', `engine=${tts.name}`);
  await mkdir(paths.remotionPublic, { recursive: true });
  const ttsResult = await tts.synthesize(sceneFile.scenes, paths.remotionPublic, AUDIO_FILE);
  sceneFile = applyDurations(sceneFile, ttsResult.durations, ttsResult.audioFile);
  const scenePath = await writeSceneFile(sceneFile);
  log('4/6 tts', `総尺 ${ttsResult.totalSec.toFixed(1)}s${ttsResult.mocked ? '（無音モック）' : ''} → ${scenePath}`);

  // ⑤レンダリング（最終動画は video/ に用語＋日時で出力）
  await mkdir(paths.video, { recursive: true });
  await mkdir(paths.output, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const safeTerm = term.term.replace(/[\\/:*?"<>|]/g, '_');
  const videoPath = resolve(paths.video, `${safeTerm}_${stamp}.mp4`);
  log('5/6 render', 'Remotion レンダリング開始…');
  let lastPct = -1;
  await renderShort(sceneFile, videoPath, (ratio) => {
    const pct = Math.floor(ratio * 100);
    if (pct >= lastPct + 10) {
      lastPct = pct;
      process.stdout.write(`  render ${pct}%\r`);
    }
  });
  console.log('');
  log('5/6 render', `→ ${videoPath}`);

  // ⑥Google Drive へ自動保存（gws CLI 経由。GOOGLE_DRIVE_FOLDER_ID 設定時）
  let driveFileId: string | undefined;
  let driveLink: string | undefined;
  if (config.drive.enabled) {
    log('6/6 drive', 'Google Drive へアップロード中…');
    try {
      const res = await uploadToDrive(videoPath, config.drive.folderId, basename(videoPath));
      driveFileId = res.id;
      driveLink = res.link;
      log('6/6 drive', `保存完了 → ${res.link}`);
    } catch (err) {
      log('6/6 drive', `⚠️ Drive 保存に失敗: ${(err as Error).message}`);
    }
  } else {
    log('6/6 drive', 'GOOGLE_DRIVE_FOLDER_ID 未設定のため Drive 保存はスキップ');
  }

  // 進捗更新 + マニフェスト書き出し
  await store.markGenerated(term.id);
  const meta = buildVideoMeta(term, sceneFile);
  const manifest: RunManifest = {
    termId: term.id,
    term: term.term,
    video: videoPath,
    scene: scenePath,
    meta,
    generatedAt: new Date().toISOString(),
    ttsEngine: tts.name,
    driveFileId,
    driveLink,
  };
  await writeFile(resolve(paths.output, 'last.json'), JSON.stringify(manifest, null, 2));

  log('done', `完了。動画: ${videoPath}${driveLink ? ` / Drive: ${driveLink}` : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
