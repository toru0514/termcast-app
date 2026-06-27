import { readFileSync, createReadStream } from 'node:fs';
import { google } from 'googleapis';
import type { VideoMeta } from './types.js';
import { config } from './config.js';

export interface YouTubeUploadResult {
  id: string;
  link: string;
}

/** gws の Desktop OAuth クライアント(client_secret.json)から client_id/secret を読む */
function loadOAuthClient() {
  const raw = JSON.parse(readFileSync(config.youtube.clientSecretPath, 'utf8'));
  const c = raw.installed ?? raw.web;
  if (!c?.client_id || !c?.client_secret) {
    throw new Error(`OAuth client が読めません: ${config.youtube.clientSecretPath}`);
  }
  const auth = new google.auth.OAuth2(c.client_id, c.client_secret);
  auth.setCredentials({ refresh_token: config.youtube.refreshToken });
  return auth;
}

/**
 * YouTube Data API v3 の videos.insert で動画をアップロードする。
 * 認証は gws の OAuth クライアント流用 + youtube.upload の refresh token（npm run youtube:auth で取得）。
 * ※ 未審査の OAuth アプリでは privacyStatus 指定に関わらず private で上がる（YouTube 仕様）。
 */
export async function uploadToYouTube(
  filePath: string,
  meta: VideoMeta,
  privacy: string = config.youtube.privacy,
): Promise<YouTubeUploadResult> {
  const auth = loadOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: meta.title.slice(0, 100),
        description: `${meta.description}\n\n※ ${meta.disclaimer}`,
        tags: meta.tags,
        categoryId: config.youtube.categoryId,
      },
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
    },
    media: { body: createReadStream(filePath) },
  });

  const id = res.data.id;
  if (!id) throw new Error('videos.insert が id を返しませんでした');
  return { id, link: `https://youtu.be/${id}` };
}
