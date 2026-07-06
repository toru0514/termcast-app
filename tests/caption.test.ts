import { describe, it, expect } from 'vitest';
import { buildSocialText, weightedLen, clampWeighted } from '../src/social/caption.js';
import { specOf } from '../src/social/platforms.js';
import { DISCLAIMER, type SceneFile } from '../src/types.js';

const sceneFile: SceneFile = {
  term: 'ローソク足',
  reading: 'ろうそくあし',
  category: 'チャート',
  disclaimer: DISCLAIMER,
  scenes: [
    { id: 1, type: 'hook', narration: 'ローソク足、説明できますか？', caption: 'なにこれ', visual: 'candle_intro' },
    { id: 2, type: 'definition', narration: '1本で4つの価格を表すチャートです。', caption: '4つの価格', visual: 'candle_anatomy' },
    { id: 3, type: 'example', narration: '始値・高値・安値・終値がひと目でわかります。', caption: '一目でわかる', visual: 'generic_term' },
    { id: 4, type: 'summary', narration: '以上、ローソク足でした！', caption: 'まとめ', visual: 'generic_term' },
  ],
};

describe('weightedLen / clampWeighted', () => {
  it('CJK を重み2で数える', () => {
    expect(weightedLen('abc', false)).toBe(3);
    expect(weightedLen('あいう', true)).toBe(6);
    expect(weightedLen('あいう', false)).toBe(3);
  });
  it('上限超過は末尾を … で丸める', () => {
    const out = clampWeighted('あいうえお', 6, true); // 6重み = 3文字ぶん
    expect(weightedLen(out, true)).toBeLessThanOrEqual(6);
    expect(out.endsWith('…')).toBe(true);
  });
  it('上限内はそのまま', () => {
    expect(clampWeighted('abc', 10, false)).toBe('abc');
  });
});

describe('buildSocialText', () => {
  it('TikTok: 口語キャプション＋インラインでハッシュタグ多め', () => {
    const t = buildSocialText(sceneFile, 'tiktok');
    expect(t.platform).toBe('tiktok');
    expect(t.hashtags.length).toBeLessThanOrEqual(specOf('tiktok').maxHashtags);
    expect(t.hashtags).toContain('#ローソク足');
    expect(t.body).toContain('サクッと解説');
    // ハッシュタグは本文と同じ塊に含まれる
    expect(t.body).toContain(t.hashtags[0]);
  });

  it('Instagram: 長文＋末尾ハッシュタグブロック＋免責', () => {
    const t = buildSocialText(sceneFile, 'instagram');
    expect(t.caption).toContain('ローソク足とは？');
    expect(t.caption).toContain(DISCLAIMER);
    // 本文とハッシュタグは空行で分離（末尾ブロック）
    const tagLine = t.hashtags.join(' ');
    expect(t.body.endsWith(tagLine)).toBe(true);
    expect(t.hashtags.length).toBeLessThanOrEqual(specOf('instagram').maxHashtags);
  });

  it('X: 280字（CJK重み付き）以内・ハッシュタグ最小限・既定でリンク無し', () => {
    const t = buildSocialText(sceneFile, 'x');
    expect(weightedLen(t.body, true)).toBeLessThanOrEqual(specOf('x').captionMaxLen);
    expect(t.hashtags.length).toBeLessThanOrEqual(specOf('x').maxHashtags);
    expect(t.body).not.toMatch(/https?:\/\//);
  });

  it('X: includeLinks 指定時のみプロフィールURLを付与', () => {
    const t = buildSocialText(sceneFile, 'x', { includeLinks: true, profileUrl: 'https://x.com/me' });
    expect(t.body).toContain('https://x.com/me');
    expect(weightedLen(t.body, true)).toBeLessThanOrEqual(specOf('x').captionMaxLen);
  });
});
