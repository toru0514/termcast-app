/**
 * テキストからおおよその読み上げ秒数を推定（モック用 / 尺見積もり）。
 * 日本語の体感速度 ≒ 1モーラ約0.15秒 + 文ごとの息継ぎ。
 */
export function estimateDurationSec(text: string): number {
  const cleaned = text.replace(/\s/g, '');
  const moras = [...cleaned].filter((ch) => !/[、。！？「」（）()・]/.test(ch)).length;
  const pauses = (text.match(/[。！？]/g) ?? []).length;
  const seconds = moras * 0.15 + pauses * 0.35 + 0.5;
  return Math.max(1.2, Math.round(seconds * 100) / 100);
}
