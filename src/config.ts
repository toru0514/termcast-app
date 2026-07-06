import 'dotenv/config';

/** 環境変数を一箇所に集約。未設定はフォールバック判定に使う。 */
export const config = {
  supabase: {
    // 借用プロジェクトでは NEXT_PUBLIC_SUPABASE_URL 名で持っていることが多いので両対応
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    // 間借り先の既存テーブルと衝突しないよう名前空間化（既定はそのまま terms）
    table: process.env.SUPABASE_TERMS_TABLE ?? 'terms',
    get enabled() {
      return Boolean(this.url && this.key);
    },
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },
  voicevox: {
    url: process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021',
    speaker: Number(process.env.VOICEVOX_SPEAKER ?? '3'),
    // 話速（1.0=標準）。15〜20秒のテンポ重視で速め。
    speed: Number(process.env.VOICEVOX_SPEED ?? '1.15'),
  },
  youtube: {
    // YouTube Data API v3（OAuth）。gws は YouTube 非対応のため別経路。
    // 認証クライアントは gws の Desktop OAuth クライアントを流用、refresh token は npm run youtube:auth で取得。
    upload: ['1', 'true', 'yes'].includes((process.env.YOUTUBE_UPLOAD ?? '').toLowerCase()),
    privacy: process.env.YOUTUBE_PRIVACY ?? 'public',
    categoryId: process.env.YOUTUBE_CATEGORY_ID ?? '27', // 27 = Education
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? '',
    clientSecretPath:
      process.env.YOUTUBE_CLIENT_SECRET_FILE ?? resolve(homedir(), '.config/gws/client_secret.json'),
    get enabled() {
      return this.upload && Boolean(this.refreshToken);
    },
  },
  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN ?? '',
    // 'inbox'（審査不要・下書き送信）/ 'direct'（審査後・直接投稿）
    mode: (process.env.TIKTOK_MODE ?? 'inbox') as 'inbox' | 'direct',
    get enabled() {
      return Boolean(this.accessToken);
    },
  },
  instagram: {
    // 審査通過後の Graph API 本実装用。未設定なら下書きJSON生成のみ（設計書 §3 Phase 2-B）。
    igUserId: process.env.INSTAGRAM_IG_USER_ID ?? '',
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
    get enabled() {
      return Boolean(this.igUserId && this.accessToken);
    },
  },
  x: {
    // X API v2 の OAuth2 ユーザーコンテキスト Bearer（投稿権限つき）。
    accessToken: process.env.X_ACCESS_TOKEN ?? '',
    // リンク付き投稿は 1件 $0.20 と高額なため既定でリンクを含めない（設計書 §2.3）。
    includeLinks: ['1', 'true', 'yes'].includes((process.env.X_INCLUDE_LINKS ?? '').toLowerCase()),
    profileUrl: process.env.X_PROFILE_URL ?? '',
    get enabled() {
      return Boolean(this.accessToken);
    },
  },
  drive: {
    // 認証は gws CLI（keyring）が持つため folderId だけでよい
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
    get enabled() {
      return Boolean(this.folderId);
    },
  },
};

/** リポジトリルートからの主要パス */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..');
export const paths = {
  root: ROOT,
  output: resolve(ROOT, 'output'),
  video: resolve(ROOT, 'video'),
  scene: resolve(ROOT, 'scene'),
  remotionEntry: resolve(ROOT, 'src/remotion/index.ts'),
  remotionPublic: resolve(ROOT, 'src/remotion/public'),
  seed: resolve(ROOT, 'data/terms.seed.json'),
  used: resolve(ROOT, 'data/used.json'),
};
