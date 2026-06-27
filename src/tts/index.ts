import type { TtsEngine } from '../types.js';
import { VoicevoxEngine } from './voicevox.js';
import { MacSayEngine } from './macsay.js';
import { MockTtsEngine } from './mock.js';

/**
 * 音声エンジンの選択（優先順位）:
 * 1. VOICEVOX（README §3.4 / 到達可能なら最優先）
 * 2. macOS say（Mac の実音声フォールバック）
 * 3. 無音モック（最終フォールバック・資格情報/エンジン無しでも完走）
 */
export async function createTtsEngine(): Promise<TtsEngine> {
  if (await VoicevoxEngine.isReachable()) {
    return new VoicevoxEngine();
  }
  if (await MacSayEngine.isAvailable()) {
    return new MacSayEngine();
  }
  return new MockTtsEngine();
}

export { VoicevoxEngine, MacSayEngine, MockTtsEngine };
