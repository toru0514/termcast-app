import type { ScriptResult, Term } from '../types.js';
import type { FactChecker, FactCheckVerdict } from './types.js';

/**
 * GEMINI 未設定などで検証できないときのフォールバック。常に pass を返す（パイプラインを止めない）。
 * 事実確認は行われないので、呼び出し側で1度だけ警告する想定。
 */
export class NoopFactChecker implements FactChecker {
  name = 'noop';
  async check(_term: Term, _script: ScriptResult): Promise<FactCheckVerdict> {
    return { verdict: 'pass', issues: [] };
  }
}
