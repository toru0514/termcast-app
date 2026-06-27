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
    clientId: process.env.YOUTUBE_CLIENT_ID ?? '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? '',
    get enabled() {
      return Boolean(this.clientId && this.clientSecret && this.refreshToken);
    },
  },
  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN ?? '',
    get enabled() {
      return Boolean(this.accessToken);
    },
  },
  drive: {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '',
    get enabled() {
      return Boolean(this.folderId && this.credentials);
    },
  },
};

/** リポジトリルートからの主要パス */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
