import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config.js';
import type { Scene, TtsEngine, TtsResult } from '../types.js';
import { concatWavs } from './wav.js';

/** ④音声合成: VOICEVOX ローカルエンジン連携（README §3.4） */
export class VoicevoxEngine implements TtsEngine {
  name = 'voicevox';
  constructor(
    private url = config.voicevox.url,
    private speaker = config.voicevox.speaker,
    private speed = config.voicevox.speed,
  ) {}

  /** エンジンが起動しているか（factory のフォールバック判定に使う） */
  static async isReachable(url = config.voicevox.url): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${url}/version`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  private async synthesizeOne(text: string): Promise<Buffer> {
    const queryRes = await fetch(
      `${this.url}/audio_query?speaker=${this.speaker}&text=${encodeURIComponent(text)}`,
      { method: 'POST' },
    );
    if (!queryRes.ok) throw new Error(`audio_query failed: ${queryRes.status}`);
    const query = await queryRes.json();
    // 話速を反映（30秒に収めるため）
    query.speedScale = this.speed;

    const synthRes = await fetch(`${this.url}/synthesis?speaker=${this.speaker}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!synthRes.ok) throw new Error(`synthesis failed: ${synthRes.status}`);
    return Buffer.from(await synthRes.arrayBuffer());
  }

  async synthesize(scenes: Scene[], outDir: string, fileName: string): Promise<TtsResult> {
    const parts: Buffer[] = [];
    for (const scene of scenes) {
      parts.push(await this.synthesizeOne(scene.narration));
    }
    const { wav, durations } = concatWavs(parts);
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, fileName), wav);
    return {
      audioFile: fileName,
      durations: durations.map((d) => Math.round(d * 100) / 100),
      totalSec: durations.reduce((a, b) => a + b, 0),
      mocked: false,
    };
  }
}
