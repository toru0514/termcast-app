import { describe, it, expect } from 'vitest';
import { silentWav, wavDurationSec, concatWavs, parseWav } from '../src/tts/wav.js';
import { estimateDurationSec } from '../src/tts/duration.js';

describe('wav util', () => {
  it('silentWav の尺がほぼ指定通り', () => {
    const w = silentWav(2);
    expect(wavDurationSec(w)).toBeCloseTo(2, 1);
  });

  it('mono 16bit のフォーマットになる', () => {
    const info = parseWav(silentWav(1));
    expect(info.channels).toBe(1);
    expect(info.bitsPerSample).toBe(16);
    expect(info.sampleRate).toBe(24000);
  });

  it('concatWavs は尺を保ち各尺を返す', () => {
    const a = silentWav(1);
    const b = silentWav(1.5);
    const { wav, durations } = concatWavs([a, b]);
    expect(durations[0]).toBeCloseTo(1, 1);
    expect(durations[1]).toBeCloseTo(1.5, 1);
    expect(wavDurationSec(wav)).toBeCloseTo(2.5, 1);
  });
});

describe('estimateDurationSec', () => {
  it('最低でも 1.2 秒', () => {
    expect(estimateDurationSec('あ')).toBeGreaterThanOrEqual(1.2);
  });
  it('長い文ほど長い', () => {
    const short = estimateDurationSec('短い文です。');
    const long = estimateDurationSec('これはとても長い文章で、読み上げにそれなりの時間がかかります。');
    expect(long).toBeGreaterThan(short);
  });
});
