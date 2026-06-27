import type { Publisher, PublishResult, VideoFile, VideoMeta } from '../types.js';
import type { PublishFields } from '../pick/store.js';
import { YouTubePublisher } from './youtube.js';
import { TikTokPublisher } from './tiktok.js';
import { InstagramDrivePublisher } from './instagram.js';

export const ALL_PLATFORMS = ['youtube', 'tiktok', 'instagram'] as const;
export type Platform = (typeof ALL_PLATFORMS)[number];

export function createPublishers(only?: Platform[]): Publisher[] {
  const all: Publisher[] = [
    new YouTubePublisher(),
    new TikTokPublisher(),
    new InstagramDrivePublisher(),
  ];
  if (!only || only.length === 0) return all;
  return all.filter((p) => only.includes(p.name as Platform));
}

/** 全アダプタへ分配。媒体間で1本の動画を使い回す。 */
export async function publishAll(
  publishers: Publisher[],
  video: VideoFile,
  meta: VideoMeta,
): Promise<PublishResult[]> {
  return Promise.all(publishers.map((p) => p.publish(video, meta)));
}

/** 配信結果を TermStore 更新用フィールドへ変換 */
export function resultsToPublishFields(results: PublishResult[]): PublishFields {
  const byPlatform = (name: string) => results.find((r) => r.platform === name && r.status === 'ok');
  return {
    youtube_video_id: byPlatform('youtube')?.id ?? null,
    tiktok_draft_id: byPlatform('tiktok')?.id ?? null,
    drive_link: byPlatform('instagram')?.link ?? null,
  };
}

export { YouTubePublisher, TikTokPublisher, InstagramDrivePublisher };
