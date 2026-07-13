import { describe, it, expect } from 'vitest';
import { verifiedGenerate } from '../src/verify/index.js';
import { issuesToFeedback, type FactChecker, type FactCheckVerdict } from '../src/verify/types.js';
import type { ScriptGenerator, ScriptResult, Term } from '../src/types.js';

const term: Term = {
  id: 't1',
  term: '陰線',
  reading: 'いんせん',
  category: 'チャート',
  difficulty: 1,
  status: 'pending',
};

function scriptWith(text: string): ScriptResult {
  return {
    term: term.term,
    scenes: [
      { type: 'hook', narration: 'h', caption: 'h', visual: 'generic_term' },
      { type: 'definition', narration: text, caption: 'd', visual: 'generic_term' },
      { type: 'example', narration: 'e', caption: 'e', visual: 'generic_term' },
      { type: 'summary', narration: 's', caption: 's', visual: 'generic_term' },
    ],
  };
}

/** feedback を受け取ったら「正しい」台本を返す fake generator */
function fakeGenerator(): ScriptGenerator & { calls: (string | undefined)[] } {
  const calls: (string | undefined)[] = [];
  return {
    name: 'fake',
    calls,
    async generate(_t: Term, feedback?: string) {
      calls.push(feedback);
      return scriptWith(feedback ? '終値が始値より安い' : '終値が始値より高い');
    },
  };
}

/** definition に「終値が始値より安い」が含まれれば pass、なければ fail を返す fake checker */
function factCheckerByKeyword(): FactChecker {
  return {
    name: 'fake-check',
    async check(_t, script): Promise<FactCheckVerdict> {
      const def = script.scenes.find((s) => s.type === 'definition')?.narration ?? '';
      return def.includes('終値が始値より安い')
        ? { verdict: 'pass', issues: [] }
        : { verdict: 'fail', issues: [{ scene: 'definition', problem: '陰線の説明が逆', correction: '終値<始値' }] };
    },
  };
}

describe('verifiedGenerate', () => {
  it('一発で pass すれば再生成しない', async () => {
    const gen = fakeGenerator();
    const checker: FactChecker = { name: 'ok', async check() { return { verdict: 'pass', issues: [] }; } };
    const r = await verifiedGenerate(term, gen, checker, { maxRegen: 2 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
    expect(gen.calls.length).toBe(1);
  });

  it('fail したら issues を添えて再生成し、pass で成功する', async () => {
    const gen = fakeGenerator();
    const r = await verifiedGenerate(term, gen, factCheckerByKeyword(), { maxRegen: 2 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    // 1回目は feedback なし、2回目は feedback あり
    expect(gen.calls[0]).toBeUndefined();
    expect(gen.calls[1]).toContain('事実誤り');
  });

  it('maxRegen を超えても通らなければ ok:false と最後の verdict を返す', async () => {
    const gen: ScriptGenerator = { name: 'bad', async generate() { return scriptWith('終値が始値より高い'); } };
    const r = await verifiedGenerate(term, gen, factCheckerByKeyword(), { maxRegen: 2 });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(3); // 初回 + 再生成2回
    expect(r.verdict?.verdict).toBe('fail');
  });
});

describe('issuesToFeedback', () => {
  it('issues 無しは空文字', () => {
    expect(issuesToFeedback([])).toBe('');
  });
  it('issues を修正指示の文面に整形する', () => {
    const fb = issuesToFeedback([{ scene: 'definition', problem: '逆です', correction: '終値<始値' }]);
    expect(fb).toContain('事実誤り');
    expect(fb).toContain('definition');
    expect(fb).toContain('終値<始値');
  });
});
