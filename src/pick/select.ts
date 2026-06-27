import type { Term } from '../types.js';

/**
 * 選定ロジック（純粋関数・テスト対象）。
 * README §3.1: status='pending' から difficulty 昇順・カテゴリ分散を考慮して1語 pick。
 *
 * @param pending  status='pending' の候補
 * @param recentCategories 直近に published したカテゴリ（新しい順）。分散のため避ける。
 */
export function selectTerm(pending: Term[], recentCategories: string[] = []): Term | null {
  if (pending.length === 0) return null;

  const minDifficulty = Math.min(...pending.map((t) => t.difficulty));
  const easiest = pending.filter((t) => t.difficulty === minDifficulty);

  // カテゴリの「直近使用ペナルティ」。recentCategories の先頭ほど新しい＝避けたい。
  // 直近に使っていないカテゴリは 0（最優先）。
  const penalty = (category: string): number => {
    const idx = recentCategories.indexOf(category);
    return idx === -1 ? 0 : recentCategories.length - idx;
  };

  // ペナルティ最小（=最も使っていない）カテゴリを優先。同点は term 昇順で決定的に。
  return [...easiest].sort((a, b) => {
    const diff = penalty(a.category) - penalty(b.category);
    if (diff !== 0) return diff;
    return a.term.localeCompare(b.term, 'ja');
  })[0];
}
