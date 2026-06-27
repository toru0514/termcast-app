import { describe, it, expect } from 'vitest';
import { buildSceneFile, applyDurations } from '../src/scene/build.js';
import { suggestVisual, normalizeVisual } from '../src/scene/visuals.js';
import { DISCLAIMER, type ScriptResult, type Term } from '../src/types.js';

const term: Term = {
  id: 'rousokuashi',
  term: 'ローソク足',
  reading: 'ろうそくあし',
  category: 'チャート',
  difficulty: 1,
  status: 'pending',
};

const script: ScriptResult = {
  term: 'ローソク足',
  scenes: [
    { type: 'hook', narration: 'n1', caption: 'c1' },
    { type: 'definition', narration: 'n2', caption: 'c2' },
  ],
};

describe('buildSceneFile', () => {
  it('id 連番・disclaimer・visual を付与する', () => {
    const sf = buildSceneFile(term, script);
    expect(sf.scenes.map((s) => s.id)).toEqual([1, 2]);
    expect(sf.disclaimer).toBe(DISCLAIMER);
    expect(sf.scenes[0].visual).toBe('candle_intro');
    expect(sf.scenes[1].visual).toBe('candle_anatomy');
  });
});

describe('applyDurations', () => {
  it('尺と audioFile を書き戻す', () => {
    const sf = buildSceneFile(term, script);
    const out = applyDurations(sf, [3.2, 4.1], 'narration.wav');
    expect(out.audioFile).toBe('narration.wav');
    expect(out.scenes.map((s) => s.durationSec)).toEqual([3.2, 4.1]);
  });

  it('尺の数がシーン数と一致しないと例外', () => {
    const sf = buildSceneFile(term, script);
    expect(() => applyDurations(sf, [1], 'x.wav')).toThrow();
  });
});

describe('visuals', () => {
  it('比率系は ratio_calc', () => {
    expect(suggestVisual('PER', 'definition')).toBe('ratio_calc');
  });
  it('クロス系は cross_animation', () => {
    expect(suggestVisual('ゴールデンクロス', 'example')).toBe('cross_animation');
  });
  it('未知用語は汎用にフォールバック', () => {
    expect(suggestVisual('謎用語', 'hook')).toBe('generic_term');
    expect(suggestVisual('謎用語', 'definition')).toBe('bullet_points');
  });
  it('不正な visual は推定値に置換', () => {
    expect(normalizeVisual('PER', 'definition', 'not_a_visual')).toBe('ratio_calc');
    expect(normalizeVisual('PER', 'definition', 'ratio_calc')).toBe('ratio_calc');
  });
});
