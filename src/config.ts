import 'dotenv/config';

/** 環境変数を一箇所に集約。未設定はフォールバック判定に使う。 */
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
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
  scene: resolve(ROOT, 'scene'),
  remotionEntry: resolve(ROOT, 'src/remotion/index.ts'),
  remotionPublic: resolve(ROOT, 'src/remotion/public'),
  seed: resolve(ROOT, 'data/terms.seed.json'),
  used: resolve(ROOT, 'data/used.json'),
};
