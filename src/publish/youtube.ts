import { createReadStream } from 'node:fs';
import { google } from 'googleapis';
import { config } from '../config.js';
import type { Publisher, PublishResult, VideoFile, VideoMeta } from '../types.js';

/**
 * YouTube アダプタ（Data API v3 / videos.insert）。
 * 限定公開(unlisted)でアップ → 目視確認後に手動公開（README §3.6.1）。
 */
export class YouTubePublisher implements Publisher {
  name = 'youtube';

  async publish(video: VideoFile, meta: VideoMeta): Promise<PublishResult> {
    if (!config.youtube.enabled) {
      return { platform: this.name, status: 'skipped', message: 'YouTube 認証情報が未設定' };
    }
    try {
      const oauth2 = new google.auth.OAuth2(config.youtube.clientId, config.youtube.clientSecret);
      oauth2.setCredentials({ refresh_token: config.youtube.refreshToken });
      const youtube = google.youtube({ version: 'v3', auth: oauth2 });

      const description = `${meta.description}\n\n※ ${meta.disclaimer}`;
      const res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title: meta.title, description, tags: meta.tags, categoryId: '27' },
          status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
        },
        media: { body: createReadStream(video.path) },
      });

      const id = res.data.id ?? undefined;
      return {
        platform: this.name,
        status: 'ok',
        id,
        link: id ? `https://youtu.be/${id}` : undefined,
        message: '限定公開でアップロード完了',
      };
    } catch (err) {
      return { platform: this.name, status: 'error', message: (err as Error).message };
    }
  }
}
