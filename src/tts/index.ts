import type { TtsEngine } from '../types.js';
import { VoicevoxEngine } from './voicevox.js';
import { MockTtsEngine } from './mock.js';

/** VOICEVOX に到達できれば実エンジン、ダメなら無音モックにフォールバック */
export async function createTtsEngine(): Promise<TtsEngine> {
  if (await VoicevoxEngine.isReachable()) {
    return new VoicevoxEngine();
  }
  return new MockTtsEngine();
}

export { VoicevoxEngine, MockTtsEngine };
