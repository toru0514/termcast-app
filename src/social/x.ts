import { config } from '../config.js';
import type { SceneFile } from '../types.js';
import { buildSocialText, weightedLen, type SocialText } from './caption.js';
import { specOf } from './platforms.js';

/**
 * 2-C: X(Twitter) 投稿モジュール（設計書 §3 Phase 2-C / 優先度低）。
 *
 * ★ 仮置き（現状このアプリでは未使用）: 既定ローテーション ACTIVE_SOCIAL_PLATFORMS からは外している。
 *   必要になったら platforms.ts の ACTIVE_SOCIAL_PLATFORMS に 'x' を足すだけで有効化できる。
 *   実装自体は残してあるため `npm run social -- --only x` で単体動作の確認は可能。
 *
 * X には「下書き」概念が無いため、完全自動投稿 or 自前スケジューラ予約のいずれか。
 * リンク付き投稿はコストが跳ねる（1件 $0.20）ため、既定はリンクを含めず
 * プロフィール欄への誘導のみとする運用を推奨。
 */

export interface XPostResult {
  tweetId: string;
  text: string;
}

/** scene.json から X 用の投稿テキストを組み立てる（コスト方針を config から反映） */
export function buildXText(sceneFile: SceneFile): SocialText {
  return buildSocialText(sceneFile, 'x', {
    includeLinks: config.x.includeLinks,
    profileUrl: config.x.profileUrl,
  });
}

/** 本文にURLが含まれるか（コスト警告用の簡易判定） */
export function containsLink(text: string): boolean {
  return /https?:\/\//i.test(text);
}

export class XPoster {
  private base = 'https://api.twitter.com/2';

  constructor(private accessToken: string = config.x.accessToken) {}

  get enabled(): boolean {
    return Boolean(this.accessToken);
  }

  /** POST /2/tweets で投稿する。280字（CJK重み付き）超過は事前に弾く。 */
  async post(text: string): Promise<XPostResult> {
    const max = specOf('x').captionMaxLen;
    if (weightedLen(text, true) > max) {
      throw new Error(`X post exceeds ${max} weighted chars`);
    }
    const res = await fetch(`${this.base}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    const json = (await res.json()) as {
      data?: { id?: string; text?: string };
      detail?: string;
      title?: string;
    };
    if (!res.ok || !json.data?.id) {
      throw new Error(json.detail ?? json.title ?? `tweet failed: ${res.status}`);
    }
    return { tweetId: json.data.id, text: json.data.text ?? text };
  }
}
