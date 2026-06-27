import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Scene, TtsEngine, TtsResult } from '../types.js';
import { concatWavs, silentWav } from './wav.js';
import { estimateDurationSec } from './duration.js';

/**
 * VOICEVOX 未起動時のフォールバック。各シーンの推定尺ぶんの無音WAVを生成し、
 * レンダリング段を資格情報・エンジンなしでも完走可能にする。
 */
export class MockTtsEngine implements TtsEngine {
  name = 'mock-silence';

  async synthesize(scenes: Scene[], outDir: string, fileName: string): Promise<TtsResult> {
    const parts = scenes.map((s) => silentWav(estimateDurationSec(s.narration)));
    const { wav, durations } = concatWavs(parts);
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, fileName), wav);
    return {
      audioFile: fileName,
      durations: durations.map((d) => Math.round(d * 100) / 100),
      totalSec: durations.reduce((a, b) => a + b, 0),
      mocked: true,
    };
  }
}
