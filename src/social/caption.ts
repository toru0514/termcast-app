import type { SceneFile } from '../types.js';
import { specOf, type SocialPlatform } from './platforms.js';

/**
 * Phase 1: プラットフォーム別 キャプション/ハッシュタグ生成（設計書 §3 Phase 1・§5）。
 *
 * 生成ロジックは API 接続ロジックから完全に分離する。ここは scene.json だけを入力に取り、
 * 媒体ごとの流儀（口語/長文/要約、ハッシュタグの置き方）に分岐して投稿本文を組み立てる純関数。
 * 審査前後で API 接続先が変わっても、この生成インターフェースは不変に保つ（設計書 §5）。
 */
export interface SocialText {
  platform: SocialPlatform;
  /** 本文（ハッシュタグを除く） */
  caption: string;
  /** 付与するハッシュタグ（先頭 # 付き） */
  hashtags: string[];
  /** 実際に投稿へ流し込む完成文字列（媒体の流儀で caption と hashtags を結合済み） */
  body: string;
}

export interface SocialTextOptions {
  /** X でリンクを含めるか（設計書 §2.3: リンク付きは 1件 $0.20 と高額なので既定 false） */
  includeLinks?: boolean;
  /** リンク誘導に使うプロフィール等のURL（includeLinks 時のみ使用） */
  profileUrl?: string;
}

/** CJK を2文字として数える重み付き長さ（X の文字数計算に近似） */
export function weightedLen(text: string, cjkDouble: boolean): number {
  if (!cjkDouble) return [...text].length;
  let n = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK 統合漢字・ひらがな・カタカナ・全角記号などを 2 とみなす
    n += code > 0x1100 ? 2 : 1;
  }
  return n;
}

/** 重み付き長さで上限に収める（超過分は末尾を「…」で丸める） */
export function clampWeighted(text: string, max: number, cjkDouble: boolean): string {
  if (weightedLen(text, cjkDouble) <= max) return text;
  const chars = [...text];
  let acc = 0;
  const out: string[] = [];
  const budget = max - 1; // 末尾の「…」ぶん
  for (const ch of chars) {
    const w = cjkDouble ? ((ch.codePointAt(0) ?? 0) > 0x1100 ? 2 : 1) : 1;
    if (acc + w > budget) break;
    acc += w;
    out.push(ch);
  }
  return out.join('') + '…';
}

function sceneNarr(sceneFile: SceneFile, type: string): string {
  return sceneFile.scenes.find((s) => s.type === type)?.narration ?? '';
}

/** この題材のベースハッシュタグ（媒体側で本数を絞る） */
function baseHashtags(sceneFile: SceneFile): string[] {
  const raw = [
    '株式投資',
    '投資初心者',
    '株用語',
    sceneFile.term,
    sceneFile.category,
    'NISA',
    'お金の勉強',
    '資産運用',
    '新NISA',
  ].filter(Boolean);
  // 記号や空白を除去してタグとして正規化し、重複排除
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const r of raw) {
    const tag = '#' + r.replace(/[\s#、。・()（）]/g, '');
    if (tag.length > 1 && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

/** Phase 1 本体: 媒体別に投稿テキストを生成する */
export function buildSocialText(
  sceneFile: SceneFile,
  platform: SocialPlatform,
  opts: SocialTextOptions = {},
): SocialText {
  const spec = specOf(platform);
  const hashtags = baseHashtags(sceneFile).slice(0, spec.maxHashtags);
  const term = sceneFile.term;
  const definition = sceneNarr(sceneFile, 'definition');
  const example = sceneNarr(sceneFile, 'example');
  const summary = sceneNarr(sceneFile, 'summary');

  switch (platform) {
    case 'tiktok': {
      // 口語的・キャプション短め・ハッシュタグ多めをインラインで
      const caption = clampWeighted(
        `${term}ってなに？サクッと解説👀 ${definition}`.trim(),
        spec.captionMaxLen,
        spec.cjkDoubleWeight,
      );
      const body = [caption, hashtags.join(' ')].filter(Boolean).join('\n');
      return { platform, caption, hashtags, body };
    }

    case 'instagram': {
      // キャプション長め・改行を活用・ハッシュタグは末尾ブロックにまとめる
      const caption = [
        `【サクッと株用語】${term}とは？`,
        '',
        definition,
        example,
        '',
        summary,
        '',
        sceneFile.disclaimer,
      ]
        .filter((l) => l !== undefined)
        .join('\n');
      const clamped = clampWeighted(caption, spec.captionMaxLen, spec.cjkDoubleWeight);
      // 本文とハッシュタグを空行で分離（IG の作法）
      const body = [clamped, '', hashtags.join(' ')].join('\n');
      return { platform, caption: clamped, hashtags, body };
    }

    case 'x': {
      // 大幅要約・280字（CJK重み付き）に収める・ハッシュタグ最小限
      const link = opts.includeLinks && opts.profileUrl ? `\n${opts.profileUrl}` : '';
      const tagLine = hashtags.length ? '\n' + hashtags.join(' ') : '';
      // まず本文候補、次にタグ・リンクを足しても収まるよう本文側を丸める
      const reserve = weightedLen(tagLine + link, spec.cjkDoubleWeight);
      const bodyMax = Math.max(0, spec.captionMaxLen - reserve);
      const caption = clampWeighted(`${term}とは：${definition || summary}`, bodyMax, spec.cjkDoubleWeight);
      const body = caption + tagLine + link;
      return { platform, caption, hashtags, body };
    }
  }
}
