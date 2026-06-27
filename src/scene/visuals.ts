import type { SceneType } from '../types.js';

/** Remotion 側に実装が存在する図解コンポーネント名の集合 */
export const VISUAL_NAMES = [
  'candle_intro',
  'candle_anatomy',
  'cross_animation',
  'ratio_calc',
  'generic_term',
  'bullet_points',
] as const;
export type VisualName = (typeof VISUAL_NAMES)[number];

export function isVisualName(v: string): v is VisualName {
  return (VISUAL_NAMES as readonly string[]).includes(v);
}

const CANDLE_TERMS = ['ローソク足', '陽線', '陰線', '始値', '終値', '高値', '安値', 'ヒゲ'];
const CROSS_TERMS = ['ゴールデンクロス', 'デッドクロス', '移動平均線'];
const RATIO_TERMS = ['PER', 'PBR', 'ROE', 'ROA', 'EPS', 'BPS', '配当利回り', 'PEGレシオ', 'ROIC', '配当性向'];

/**
 * 用語とシーン種別から図解コンポーネントを推定する。
 * 未知の visual を Gemini が返しても、ここで安全な既定にフォールバックさせる。
 */
export function suggestVisual(term: string, type: SceneType): VisualName {
  if (CANDLE_TERMS.includes(term)) {
    return type === 'hook' ? 'candle_intro' : 'candle_anatomy';
  }
  if (CROSS_TERMS.includes(term)) {
    return 'cross_animation';
  }
  if (RATIO_TERMS.includes(term)) {
    return type === 'definition' || type === 'example' ? 'ratio_calc' : 'generic_term';
  }
  return type === 'hook' || type === 'summary' ? 'generic_term' : 'bullet_points';
}

/** Gemini 等が返した visual を検証し、不正なら推定値に置換する */
export function normalizeVisual(term: string, type: SceneType, visual?: string): VisualName {
  if (visual && isVisualName(visual)) return visual;
  return suggestVisual(term, type);
}
