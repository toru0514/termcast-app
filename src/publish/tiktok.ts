import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { config } from '../config.js';
import type { Publisher, PublishResult, VideoFile, VideoMeta } from '../types.js';

/**
 * TikTok アダプタ（Content Posting API / 下書きモード）。
 * 動画をアプリの編集画面(inbox)へ送り込み、最後の投稿だけ人手（README §3.6.2）。
 */
export class TikTokPublisher implements Publisher {
  name = 'tiktok';
  private base = 'https://open.tiktokapis.com/v2';

  async publish(video: VideoFile, _meta: VideoMeta): Promise<PublishResult> {
    if (!config.tiktok.enabled) {
      return { platform: this.name, status: 'skipped', message: 'TikTok アクセストークンが未設定' };
    }
    try {
      const size = statSync(video.path).size;

      // 1) 下書き(inbox)アップロードの初期化
      const initRes = await fetch(`${this.base}/post/publish/inbox/video/init/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.tiktok.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: size,
            chunk_size: size,
            total_chunk_count: 1,
          },
        }),
      });
      const initJson = (await initRes.json()) as {
        data?: { publish_id?: string; upload_url?: string };
        error?: { message?: string; code?: string };
      };
      if (!initRes.ok || !initJson.data?.upload_url) {
        throw new Error(initJson.error?.message ?? `init failed: ${initRes.status}`);
      }

      // 2) 動画バイト列をアップロード
      const bytes = await readFile(video.path);
      const putRes = await fetch(initJson.data.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${size - 1}/${size}`,
        },
        body: bytes,
      });
      if (!putRes.ok) throw new Error(`upload failed: ${putRes.status}`);

      return {
        platform: this.name,
        status: 'ok',
        id: initJson.data.publish_id,
        message: 'アプリの下書きに送信完了（最後の投稿は人手）',
      };
    } catch (err) {
      return { platform: this.name, status: 'error', message: (err as Error).message };
    }
  }
}
