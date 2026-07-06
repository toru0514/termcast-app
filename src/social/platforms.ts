import { z } from 'zod';

/**
 * SNS投稿自動化のプラットフォーム定義とレート制限（設計書 §5「レート制限の一元管理」）。
 *
 * 制限方式が媒体ごとに異なる（TikTok=req/min・投稿/日、Instagram=投稿/24h、X=従量課金）ため、
 * ここで一元管理し、環境変数で上書き可能にしておく。API接続ロジックはこの表を参照するだけにする。
 *
 * YouTube は既存パイプライン（scripts/generate.ts）で自動アップロード済みのため対象外。
 */
export const SocialPlatform = z.enum(['tiktok', 'instagram', 'x']);
export type SocialPlatform = z.infer<typeof SocialPlatform>;

/**
 * 定義済みの全媒体（`--only x` の検証等に使用）。X はコード上の実装は残すが、
 * 現状このアプリでは使わない「仮置き」扱い（下記 ACTIVE から除外）。
 */
export const ALL_SOCIAL_PLATFORMS: readonly SocialPlatform[] = ['tiktok', 'instagram', 'x'];

/**
 * 既定で配信する媒体（`npm run social` のローテーション）。
 * X を使いたくなったら 'x' をこの配列へ追加するだけで有効化できる。
 */
export const ACTIVE_SOCIAL_PLATFORMS: readonly SocialPlatform[] = ['tiktok', 'instagram'];

/** ハッシュタグの流儀（媒体ごとに文化が違う） */
export type HashtagStyle =
  | 'inline-many' // TikTok: 口語キャプションの後ろに多めに並べる
  | 'trailing-block' // Instagram: 本文と改行で分け末尾にまとめる
  | 'minimal'; // X: 文字数が厳しいので最小限

export interface RateLimit {
  /** 1分あたりのリクエスト上限（TikTok user access_token = 6） */
  perMinute?: number;
  /** 24時間あたりの投稿上限（Instagram=100 / TikTok≈15） */
  perDay?: number;
}

export interface PlatformSpec {
  platform: SocialPlatform;
  /** キャプション最大文字数（X は 280、IG/TikTok は 2200 目安） */
  captionMaxLen: number;
  /** X は CJK を2文字として数える重み付けが必要 */
  cjkDoubleWeight: boolean;
  hashtagStyle: HashtagStyle;
  /** 付与するハッシュタグの最大数 */
  maxHashtags: number;
  rateLimit: RateLimit;
  /** この媒体が「公式な下書きAPI」を持つか（Instagram は持たない） */
  hasDraftApi: boolean;
}

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * 既定値は 2026年7月時点の各API仕様に基づく。運用中の調整は環境変数で行う（コード変更不要）。
 *   SOCIAL_TIKTOK_RPM / SOCIAL_TIKTOK_PER_DAY
 *   SOCIAL_INSTAGRAM_PER_DAY
 *   SOCIAL_X_CAPTION_MAX
 */
export const PLATFORM_SPECS: Record<SocialPlatform, PlatformSpec> = {
  tiktok: {
    platform: 'tiktok',
    captionMaxLen: 2200,
    cjkDoubleWeight: false,
    hashtagStyle: 'inline-many',
    maxHashtags: 8,
    rateLimit: {
      perMinute: numEnv('SOCIAL_TIKTOK_RPM', 6),
      perDay: numEnv('SOCIAL_TIKTOK_PER_DAY', 15),
    },
    hasDraftApi: true,
  },
  instagram: {
    platform: 'instagram',
    captionMaxLen: 2200,
    cjkDoubleWeight: false,
    hashtagStyle: 'trailing-block',
    maxHashtags: 15,
    rateLimit: {
      perDay: numEnv('SOCIAL_INSTAGRAM_PER_DAY', 100),
    },
    hasDraftApi: false, // 公式下書きAPIなし → JSON下書きで暫定運用（設計書 §2-B）
  },
  x: {
    platform: 'x',
    captionMaxLen: numEnv('SOCIAL_X_CAPTION_MAX', 280),
    cjkDoubleWeight: true,
    hashtagStyle: 'minimal',
    maxHashtags: 2,
    rateLimit: {}, // 従量課金制。件数上限ではなくコストで管理（設計書 §2.3）
    hasDraftApi: false, // 下書き概念自体が存在しない
  },
};

export function specOf(platform: SocialPlatform): PlatformSpec {
  return PLATFORM_SPECS[platform];
}

/**
 * レート制限に沿ってリクエスト間隔を空ける最小限のリミッター。
 * perMinute から最短間隔(ms)を導出し、直前の実行からの経過が足りなければ待つ。
 * 単一プロセス内のキュー実行を想定（設計書 §2-A「投稿キューイング機構が必須」）。
 */
export class RateLimiter {
  private minIntervalMs: number;
  private lastAt = 0;

  constructor(perMinute?: number) {
    this.minIntervalMs = perMinute && perMinute > 0 ? Math.ceil(60_000 / perMinute) : 0;
  }

  /** 次のリクエストまで待つべきミリ秒（テスト可能なよう純関数として分離） */
  waitMs(now: number): number {
    if (this.minIntervalMs === 0 || this.lastAt === 0) return 0;
    const elapsed = now - this.lastAt;
    return elapsed >= this.minIntervalMs ? 0 : this.minIntervalMs - elapsed;
  }

  /** 実際に間隔を空けて実行する。sleep は注入可能（テストでは即時解決を渡す）。 */
  async acquire(sleep: (ms: number) => Promise<void> = defaultSleep, now: () => number = Date.now): Promise<void> {
    const wait = this.waitMs(now());
    if (wait > 0) await sleep(wait);
    this.lastAt = now();
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
