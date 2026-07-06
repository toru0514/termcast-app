import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths } from '../config.js';
import type { SceneFile } from '../types.js';
import { buildSocialText, type SocialText } from './caption.js';

/**
 * 2-B: Instagram 下書きJSON出力モジュール（設計書 §3 Phase 2-B / 審査完了までの暫定運用）。
 *
 * Meta 公式の下書き保存APIは存在しないため、審査通過後にそのまま Graph API パラメータへ
 * 流用できるキー構造で下書きを吐き出す。移行時の変更点は「JSON生成 → API呼び出し」の接続部のみ。
 *
 *   output/instagram/{content_id}/
 *     ├── video.mp4
 *     ├── caption.txt
 *     ├── hashtags.txt
 *     └── meta.json   ← Graph API 互換（media_type / caption / video_url / cover_url / share_to_feed）
 */

/** meta.json のトップレベルは Graph API の POST /{ig-user-id}/media パラメータと同じキーに揃える */
export interface InstagramMedia {
  media_type: 'REELS';
  caption: string;
  /** 公開URL（Graph API は公開URLを要求）。下書き段階では未確定なので null。 */
  video_url: string | null;
  cover_url: string | null;
  share_to_feed: boolean;
  /** API に渡さないローカル運用メタ（審査後は無視される） */
  _draft: {
    content_id: string;
    term: string;
    local_video: string;
    generated_at: string;
  };
}

export interface InstagramDraftResult {
  contentId: string;
  dir: string;
  metaPath: string;
  videoPath: string;
  media: InstagramMedia;
  social: SocialText;
}

export interface InstagramDraftOptions {
  /** 出力ルート（既定: output/instagram） */
  outRoot?: string;
  /** 動画をコピーするか（false ならパス参照のみ・テスト用） */
  copyVideo?: boolean;
  /** meta.json の video_url を先に埋める場合（Drive 公開URL等） */
  videoUrl?: string | null;
  /** 生成時刻の注入（テスト用） */
  now?: () => Date;
}

/**
 * scene.json と動画ファイルから Instagram 下書き一式を生成する。
 * caption/hashtags は Phase 1 の buildSocialText を通すため、審査後の API 実装でも同じ本文が使える。
 */
export async function writeInstagramDraft(
  contentId: string,
  videoPath: string,
  sceneFile: SceneFile,
  opts: InstagramDraftOptions = {},
): Promise<InstagramDraftResult> {
  const outRoot = opts.outRoot ?? resolve(paths.output, 'instagram');
  const dir = resolve(outRoot, sanitizeId(contentId));
  await mkdir(dir, { recursive: true });

  const social = buildSocialText(sceneFile, 'instagram');
  const now = (opts.now ?? (() => new Date()))();

  const localVideoName = 'video.mp4';
  const destVideo = resolve(dir, localVideoName);
  if (opts.copyVideo !== false) {
    await copyFile(videoPath, destVideo);
  }

  const media: InstagramMedia = {
    media_type: 'REELS',
    caption: social.body, // 本文＋末尾ハッシュタグブロック（IG の作法どおり）
    video_url: opts.videoUrl ?? null,
    cover_url: null,
    share_to_feed: true,
    _draft: {
      content_id: contentId,
      term: sceneFile.term,
      local_video: localVideoName,
      generated_at: now.toISOString(),
    },
  };

  const metaPath = resolve(dir, 'meta.json');
  await Promise.all([
    writeFile(resolve(dir, 'caption.txt'), social.caption + '\n'),
    writeFile(resolve(dir, 'hashtags.txt'), social.hashtags.join(' ') + '\n'),
    writeFile(metaPath, JSON.stringify(media, null, 2) + '\n'),
  ]);

  return {
    contentId,
    dir,
    metaPath,
    videoPath: opts.copyVideo === false ? videoPath : destVideo,
    media,
    social,
  };
}

function sanitizeId(id: string): string {
  return id.replace(/[\\/:*?"<>|]/g, '_');
}
