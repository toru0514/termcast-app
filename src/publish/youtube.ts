import { config } from '../config.js';
import { uploadToYouTube } from '../youtube.js';
import type { Publisher, PublishResult, VideoFile, VideoMeta } from '../types.js';

/**
 * YouTube アダプタ（Data API v3 videos.insert を gws CLI 経由で実行）。
 * 認証は gws（keyring）。未審査アプリでは private で上がり、公開は Studio で手動（README §3.6.1）。
 */
export class YouTubePublisher implements Publisher {
  name = 'youtube';

  async publish(video: VideoFile, meta: VideoMeta): Promise<PublishResult> {
    if (!config.youtube.enabled) {
      return { platform: this.name, status: 'skipped', message: 'YOUTUBE_UPLOAD 未設定' };
    }
    try {
      const res = await uploadToYouTube(video.path, meta, config.youtube.privacy);
      return {
        platform: this.name,
        status: 'ok',
        id: res.id,
        link: res.link,
        message: `アップロード完了（privacy=${config.youtube.privacy}）`,
      };
    } catch (err) {
      return { platform: this.name, status: 'error', message: (err as Error).message };
    }
  }
}
