import { config } from '../config.js';
import type { SceneFile } from '../types.js';
import { buildSocialText } from './caption.js';
import { writeInstagramDraft } from './instagram.js';
import { ALL_SOCIAL_PLATFORMS, type SocialPlatform } from './platforms.js';
import { SocialStatusStore, type SocialStage } from './status.js';
import { TikTokUploader } from './tiktok.js';
import { buildXText, XPoster } from './x.js';

/**
 * SNS投稿自動化オーケストレータ（設計書 §3 全体）。
 * scene.json + 動画から、媒体別に「下書き送信 / 公開 / 生成」を実行し、共通ステータスへ記録する。
 * 資格情報が無い媒体は skipped で返し、パイプラインは止めない（既存 publish 層と同じ思想）。
 */

export type SocialOutcome = 'ok' | 'skipped' | 'error';

export interface SocialResult {
  platform: SocialPlatform;
  outcome: SocialOutcome;
  stage?: SocialStage;
  targetId?: string | null;
  link?: string | null;
  message?: string;
}

export interface RunSocialInput {
  contentId: string;
  videoPath: string;
  sceneFile: SceneFile;
  platforms?: SocialPlatform[];
  dryRun?: boolean;
  statusStore?: SocialStatusStore;
}

export async function runSocial(input: RunSocialInput): Promise<SocialResult[]> {
  const platforms = input.platforms?.length ? input.platforms : [...ALL_SOCIAL_PLATFORMS];
  const store = input.statusStore ?? new SocialStatusStore();
  const results: SocialResult[] = [];

  for (const platform of platforms) {
    const r = await runOne(platform, input);
    if (r.outcome !== 'skipped' && r.stage && !input.dryRun) {
      await store.set(input.contentId, {
        platform,
        stage: r.stage,
        targetId: r.targetId ?? null,
        link: r.link ?? null,
        message: r.message,
      });
    }
    results.push(r);
  }
  return results;
}

async function runOne(platform: SocialPlatform, input: RunSocialInput): Promise<SocialResult> {
  const { contentId, videoPath, sceneFile, dryRun } = input;
  try {
    switch (platform) {
      case 'instagram': {
        // 審査完了までは下書きJSON生成（設計書 §2-B）。dry-run では本文だけ組み立てる。
        if (dryRun) {
          const s = buildSocialText(sceneFile, 'instagram');
          return { platform, outcome: 'ok', stage: 'material_ready', message: preview(s.body) };
        }
        const draft = await writeInstagramDraft(contentId, videoPath, sceneFile);
        return {
          platform,
          outcome: 'ok',
          stage: 'draft_sent',
          link: draft.dir,
          message: `下書きJSON生成: ${draft.dir}`,
        };
      }

      case 'tiktok': {
        const uploader = new TikTokUploader();
        if (!uploader.enabled) {
          return { platform, outcome: 'skipped', message: 'TIKTOK_ACCESS_TOKEN 未設定' };
        }
        if (dryRun) {
          return { platform, outcome: 'ok', stage: 'material_ready', message: `mode=${config.tiktok.mode}` };
        }
        // creator_info は best-effort（失敗しても送信自体は試みる）
        try {
          await uploader.queryCreatorInfo();
        } catch {
          /* 権限や審査状況により失敗しうるので握りつぶす */
        }
        const social = config.tiktok.mode === 'direct' ? buildSocialText(sceneFile, 'tiktok') : undefined;
        const res = await uploader.upload(videoPath, social, config.tiktok.mode);
        return {
          platform,
          outcome: 'ok',
          stage: res.mode === 'direct' ? 'published' : 'draft_sent',
          targetId: res.publishId,
          message: res.message,
        };
      }

      case 'x': {
        const poster = new XPoster();
        const text = buildXText(sceneFile);
        if (!poster.enabled) {
          return { platform, outcome: 'skipped', message: `X_ACCESS_TOKEN 未設定（本文案: ${preview(text.body)}）` };
        }
        if (dryRun) {
          return { platform, outcome: 'ok', stage: 'material_ready', message: preview(text.body) };
        }
        const res = await poster.post(text.body);
        return {
          platform,
          outcome: 'ok',
          stage: 'published',
          targetId: res.tweetId,
          link: `https://x.com/i/status/${res.tweetId}`,
          message: '投稿完了',
        };
      }
    }
  } catch (err) {
    return { platform, outcome: 'error', message: (err as Error).message };
  }
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 60 ? oneLine.slice(0, 60) + '…' : oneLine;
}

export * from './platforms.js';
export * from './caption.js';
export * from './status.js';
export { writeInstagramDraft } from './instagram.js';
export { TikTokUploader } from './tiktok.js';
export { XPoster, buildXText } from './x.js';
