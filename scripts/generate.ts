import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { basename } from 'node:path';
import { config, paths } from '../src/config.js';
import { uploadToDrive } from '../src/drive.js';
import { uploadToYouTube } from '../src/youtube.js';
import { createTermStore } from '../src/pick/store.js';
import { createScriptGenerator } from '../src/script/index.js';
import { createFactChecker, verifiedGenerate } from '../src/verify/index.js';
import type { ScriptResult, Term } from '../src/types.js';
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
  // ①ネタ選定 ＋ ②台本生成 ＋ ファクトチェック・ゲート
  // 生成→検証を通過するまで pending 用語を順に試し、通らない用語は needs_review にして次へ。
  const store = createTermStore();
  const generator = createScriptGenerator();
  const checker = createFactChecker();
  log('1/6 pick', `store=${store.name} / checker=${checker.name}`);
  if (checker.name === 'noop') {
    log('verify', '⚠️ GEMINI未設定 or VERIFY_ENABLED=false のため、ファクトチェックはスキップされます');
  }

  let term: Term | null = null;
  let script: ScriptResult | null = null;
  for (let i = 0; i < config.verify.maxTerms; i++) {
    const candidate = await store.pickNext();
    if (!candidate) break;
    log('1/6 pick', `「${candidate.term}」(${candidate.category}, 難易度${candidate.difficulty})`);
    log('2/6 script', `generator=${generator.name} → factcheck=${checker.name}`);
    const r = await verifiedGenerate(candidate, generator, checker, { maxRegen: config.verify.maxRegen });
    if (r.ok) {
      term = candidate;
      script = r.script;
      log('2/6 script', `✅ ファクトチェック合格（生成${r.attempts}回）`);
      break;
    }
    const problems = r.verdict?.issues.map((x) => `${x.scene}: ${x.problem}`).join(' / ') || '不明';
    log('2/6 script', `❌ 「${candidate.term}」不合格（${r.attempts}回試行）→ needs_review。指摘: ${problems}`);
    await store.markNeedsReview(candidate.id);
  }

  if (!term || !script) {
    console.error(
      'ファクトチェックを通過する台本が得られませんでした（pending枯渇 or 連続不合格）。needs_review を確認してください。',
    );
    process.exit(1);
  }

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

  const meta = buildVideoMeta(term, sceneFile);

  // ⑥-a Google Drive へ自動保存（gws CLI 経由。GOOGLE_DRIVE_FOLDER_ID 設定時）
  let driveFileId: string | undefined;
  let driveLink: string | undefined;
  if (config.drive.enabled) {
    log('6/7 drive', 'Google Drive へアップロード中…');
    try {
      const res = await uploadToDrive(videoPath, config.drive.folderId, basename(videoPath));
      driveFileId = res.id;
      driveLink = res.link;
      log('6/7 drive', `保存完了 → ${res.link}`);
    } catch (err) {
      log('6/7 drive', `⚠️ Drive 保存に失敗: ${(err as Error).message}`);
    }
  } else {
    log('6/7 drive', 'GOOGLE_DRIVE_FOLDER_ID 未設定のため Drive 保存はスキップ');
  }

  // ⑥-b YouTube へ自動アップロード（gws CLI 経由。YOUTUBE_UPLOAD=1 設定時）
  let youtubeVideoId: string | undefined;
  let youtubeLink: string | undefined;
  if (config.youtube.enabled) {
    log('7/7 youtube', `YouTube へアップロード中…（privacy=${config.youtube.privacy}）`);
    try {
      const res = await uploadToYouTube(videoPath, meta, config.youtube.privacy);
      youtubeVideoId = res.id;
      youtubeLink = res.link;
      log('7/7 youtube', `アップロード完了 → ${res.link}`);
    } catch (err) {
      log('7/7 youtube', `⚠️ YouTube アップロードに失敗: ${(err as Error).message}`);
    }
  } else {
    log('7/7 youtube', 'YOUTUBE_UPLOAD 未設定のため YouTube アップロードはスキップ');
  }

  // 進捗更新 + 成果物ID記録 + マニフェスト書き出し
  await store.markGenerated(term.id);
  await store.recordArtifacts(term.id, {
    youtube_video_id: youtubeVideoId ?? null,
    drive_link: driveLink ?? null,
  });
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
    youtubeVideoId,
    youtubeLink,
  };
  await writeFile(resolve(paths.output, 'last.json'), JSON.stringify(manifest, null, 2));

  log('done', `完了。動画: ${videoPath}${driveLink ? ` / Drive: ${driveLink}` : ''}${youtubeLink ? ` / YouTube: ${youtubeLink}` : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
