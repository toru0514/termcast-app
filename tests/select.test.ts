import { describe, it, expect } from 'vitest';
import { selectTerm } from '../src/pick/select.js';
import type { Term } from '../src/types.js';

const t = (term: string, category: string, difficulty: number): Term => ({
  id: term,
  term,
  reading: '',
  category,
  difficulty,
  status: 'pending',
});

describe('selectTerm', () => {
  it('空配列なら null', () => {
    expect(selectTerm([])).toBeNull();
  });

  it('difficulty が最小の語を優先する', () => {
    const picked = selectTerm([t('A', 'X', 3), t('B', 'Y', 1), t('C', 'Z', 2)]);
    expect(picked?.term).toBe('B');
  });

  it('同難易度では直近使用カテゴリを避ける（分散）', () => {
    const pending = [t('A', 'チャート', 1), t('B', '指標', 1)];
    // 直近に「チャート」を使った → 指標を選ぶはず
    const picked = selectTerm(pending, ['チャート']);
    expect(picked?.term).toBe('B');
  });

  it('決定的（同条件なら term 昇順で安定）', () => {
    const pending = [t('かきく', 'X', 1), t('あいう', 'X', 1)];
    const a = selectTerm(pending, []);
    const b = selectTerm([...pending].reverse(), []);
    expect(a?.term).toBe(b?.term);
  });
});
