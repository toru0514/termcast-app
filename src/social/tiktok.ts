import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { config } from '../config.js';
import type { SocialText } from './caption.js';
import { RateLimiter, specOf } from './platforms.js';

/**
 * 2-A: TikTok アップロードモジュール（設計書 §3 Phase 2-A）。
 *
 * OAuth(video.upload スコープ) → creator_info 取得 → Upload(MEDIA_UPLOAD, inbox 下書き) の流れ。
 * 審査不要で使える inbox 下書き送信を既定とし、審査通過後は同構造で Direct Post に差し替えられるよう
 * mode で切り替える設計にしておく。レート制限(6req/min)は RateLimiter で吸収する。
 */

export type TikTokMode = 'inbox' | 'direct';

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  openId?: string;
  scope?: string;
}

/** OAuth トークンエンドポイントの共通呼び出し（application/x-www-form-urlencoded）。 */
async function tokenRequest(params: Record<string, string>): Promise<TikTokTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || json.error || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description ?? json.error ?? `token request failed: ${res.status}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    openId: json.open_id,
    scope: json.scope,
  };
}

/** 認可コードをアクセストークン/リフレッシュトークンに交換する（tiktok:auth 用）。 */
export function exchangeCode(code: string): Promise<TikTokTokens> {
  return tokenRequest({
    client_key: config.tiktok.clientKey,
    client_secret: config.tiktok.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.tiktok.redirectUri,
  });
}

/** refresh_token から新しいアクセストークンを取得する（実行時の自動更新用）。 */
export function refreshAccessToken(
  refreshToken: string = config.tiktok.refreshToken,
): Promise<TikTokTokens> {
  return tokenRequest({
    client_key: config.tiktok.clientKey,
    client_secret: config.tiktok.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

export interface CreatorInfo {
  creatorNickname?: string;
  /** 直接公開が許可された公開範囲オプション（審査状況で変わる） */
  privacyOptions?: string[];
  maxVideoPostDurationSec?: number;
  raw: unknown;
}

export interface TikTokUploadResult {
  publishId: string;
  mode: TikTokMode;
  message: string;
}

/** TikTok Content Posting API クライアント（レート制限は 1 インスタンスで共有） */
export class TikTokUploader {
  private base = 'https://open.tiktokapis.com/v2';
  private limiter: RateLimiter;

  private cachedToken?: string;

  constructor(private accessToken: string = config.tiktok.accessToken) {
    this.limiter = new RateLimiter(specOf('tiktok').rateLimit.perMinute);
  }

  get enabled(): boolean {
    const { clientKey, clientSecret, refreshToken } = config.tiktok;
    return Boolean(this.accessToken || (clientKey && clientSecret && refreshToken));
  }

  /**
   * 有効なアクセストークンを解決する。refresh 用の資格情報があれば毎回リフレッシュして
   * 24時間失効を回避する（access_token 直指定より優先）。1インスタンス内ではキャッシュ。
   */
  private async resolveToken(): Promise<string> {
    if (this.cachedToken) return this.cachedToken;
    const { clientKey, clientSecret, refreshToken } = config.tiktok;
    if (clientKey && clientSecret && refreshToken) {
      this.cachedToken = (await refreshAccessToken(refreshToken)).accessToken;
      return this.cachedToken;
    }
    if (this.accessToken) {
      this.cachedToken = this.accessToken;
      return this.accessToken;
    }
    throw new Error(
      'TikTokの認証情報がありません（TIKTOK_ACCESS_TOKEN、または CLIENT_KEY/SECRET/REFRESH_TOKEN）。npm run tiktok:auth を先に実行してください。',
    );
  }

  private headers(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    };
  }

  /** creator_info 取得。Direct Post 可否や公開範囲オプションの確認に使う。 */
  async queryCreatorInfo(): Promise<CreatorInfo> {
    const token = await this.resolveToken();
    await this.limiter.acquire();
    const res = await fetch(`${this.base}/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: this.headers(token),
    });
    const json = (await res.json()) as {
      data?: {
        creator_nickname?: string;
        privacy_level_options?: string[];
        max_video_post_duration_sec?: number;
      };
      error?: { message?: string; code?: string };
    };
    if (!res.ok || (json.error && json.error.code && json.error.code !== 'ok')) {
      throw new Error(json.error?.message ?? `creator_info failed: ${res.status}`);
    }
    return {
      creatorNickname: json.data?.creator_nickname,
      privacyOptions: json.data?.privacy_level_options,
      maxVideoPostDurationSec: json.data?.max_video_post_duration_sec,
      raw: json.data,
    };
  }

  /**
   * 動画を送信する。
   *  - mode='inbox'  : アプリ下書き(inbox)へ送信。以降はTikTok側で完結（審査不要）。
   *  - mode='direct' : プロフィールへ直接投稿（審査済みクリエイターのみ・social.body をキャプションに使用）。
   */
  async upload(
    videoPath: string,
    social?: SocialText,
    mode: TikTokMode = 'inbox',
  ): Promise<TikTokUploadResult> {
    const size = statSync(videoPath).size;
    const endpoint =
      mode === 'direct'
        ? `${this.base}/post/publish/video/init/`
        : `${this.base}/post/publish/inbox/video/init/`;

    const sourceInfo = {
      source: 'FILE_UPLOAD',
      video_size: size,
      chunk_size: size,
      total_chunk_count: 1,
    };
    const initBody =
      mode === 'direct'
        ? {
            post_info: {
              // 審査通過後に privacy_level を creator_info の候補から選ぶ。既定は自分のみ。
              title: social?.body ?? '',
              privacy_level: 'SELF_ONLY',
              disable_comment: false,
            },
            source_info: sourceInfo,
          }
        : { source_info: sourceInfo };

    // 1) 初期化
    const token = await this.resolveToken();
    await this.limiter.acquire();
    const initRes = await fetch(endpoint, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify(initBody),
    });
    const initJson = (await initRes.json()) as {
      data?: { publish_id?: string; upload_url?: string };
      error?: { message?: string; code?: string };
    };
    if (!initRes.ok || !initJson.data?.upload_url || !initJson.data.publish_id) {
      throw new Error(initJson.error?.message ?? `init failed: ${initRes.status}`);
    }

    // 2) 動画バイト列をアップロード
    const bytes = await readFile(videoPath);
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
      publishId: initJson.data.publish_id,
      mode,
      message:
        mode === 'direct'
          ? 'プロフィールへ投稿処理を開始（Direct Post）'
          : 'アプリの下書き(inbox)へ送信完了（最後の投稿は人手）',
    };
  }
}
