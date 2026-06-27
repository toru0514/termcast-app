import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { google } from 'googleapis';
import { config } from '../config.js';
import type { Publisher, PublishResult, VideoFile, VideoMeta } from '../types.js';

/**
 * Instagram アダプタ（Google Drive 経由 / README §3.6.3）。
 * プロアカウント前提を避け、Drive 指定フォルダへ保存し共有リンクを返す薄い実装。
 * ユーザーがDLしてアプリから手動アップ。将来 Graph API 版に差し替え可能。
 */
export class InstagramDrivePublisher implements Publisher {
  name = 'instagram';

  async publish(video: VideoFile, meta: VideoMeta): Promise<PublishResult> {
    if (!config.drive.enabled) {
      return { platform: this.name, status: 'skipped', message: 'Google Drive 設定が未設定' };
    }
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: config.drive.credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      const drive = google.drive({ version: 'v3', auth });

      const created = await drive.files.create({
        requestBody: {
          name: `${meta.title}_${basename(video.path)}`,
          parents: [config.drive.folderId],
          description: meta.disclaimer,
        },
        media: { mimeType: 'video/mp4', body: createReadStream(video.path) },
        fields: 'id, webViewLink',
      });

      const fileId = created.data.id ?? undefined;
      if (fileId) {
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
      }

      return {
        platform: this.name,
        status: 'ok',
        id: fileId,
        link: created.data.webViewLink ?? undefined,
        message: 'Drive に保存（DLして手動アップ）',
      };
    } catch (err) {
      return { platform: this.name, status: 'error', message: (err as Error).message };
    }
  }
}
