import { basename } from 'node:path';
import { config } from '../config.js';
import { uploadToDrive } from '../drive.js';
import type { Publisher, PublishResult, VideoFile, VideoMeta } from '../types.js';

/**
 * Instagram アダプタ（Google Drive 経由 / README §3.6.3）。
 * プロアカウント前提を避け、Drive 指定フォルダへ保存し共有リンクを返す薄い実装。
 * 認証は gws CLI（keyring）が持つため folderId だけでよい。
 * ※ generate 側で既に自動保存される場合は、publish 実行時はもう1コピー作られる点に注意。
 */
export class InstagramDrivePublisher implements Publisher {
  name = 'instagram';

  async publish(video: VideoFile, meta: VideoMeta): Promise<PublishResult> {
    if (!config.drive.enabled) {
      return { platform: this.name, status: 'skipped', message: 'GOOGLE_DRIVE_FOLDER_ID 未設定' };
    }
    try {
      const name = `${meta.title}_${basename(video.path)}`;
      const res = await uploadToDrive(video.path, config.drive.folderId, name);
      return {
        platform: this.name,
        status: 'ok',
        id: res.id,
        link: res.link,
        message: 'Drive に保存（DLして手動アップ）',
      };
    } catch (err) {
      return { platform: this.name, status: 'error', message: (err as Error).message };
    }
  }
}
