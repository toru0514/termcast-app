import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Scene, TtsEngine, TtsResult } from '../types.js';
import { concatWavs } from './wav.js';

const exec = promisify(execFile);

/**
 * macOS 標準の `say` コマンドによる日本語TTS（VOICEVOX 未起動時の実音声フォールバック）。
 * 無音モックより遥かに良く、ネット不要で即座に本物のナレーションが得られる。
 */
export class MacSayEngine implements TtsEngine {
  name = 'macos-say';
  constructor(private voice = 'Kyoko') {}

  /** darwin かつ say に日本語音声があるか */
  static async isAvailable(voice = 'Kyoko'): Promise<boolean> {
    if (process.platform !== 'darwin') return false;
    try {
      const { stdout } = await exec('say', ['-v', '?']);
      return stdout.includes(voice);
    } catch {
      return false;
    }
  }

  private async synthesizeOne(text: string, outPath: string): Promise<Buffer> {
    // 24kHz/16bit リトルエンディアン WAV で出力（concatWavs が前提とする形式に揃える）
    await exec('say', [
      '-v',
      this.voice,
      '--data-format=LEI16@24000',
      '--file-format=WAVE',
      '-o',
      outPath,
      text,
    ]);
    return readFile(outPath);
  }

  async synthesize(scenes: Scene[], outDir: string, fileName: string): Promise<TtsResult> {
    await mkdir(outDir, { recursive: true });
    const parts: Buffer[] = [];
    const tmpFiles: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const tmp = resolve(outDir, `._say_${i}.wav`);
      tmpFiles.push(tmp);
      parts.push(await this.synthesizeOne(scenes[i].narration, tmp));
    }
    const { wav, durations } = concatWavs(parts);
    await writeFile(resolve(outDir, fileName), wav);
    await Promise.all(tmpFiles.map((f) => rm(f, { force: true })));
    return {
      audioFile: fileName,
      durations: durations.map((d) => Math.round(d * 100) / 100),
      totalSec: durations.reduce((a, b) => a + b, 0),
      mocked: false,
    };
  }
}
