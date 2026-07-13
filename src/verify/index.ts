import { config } from '../config.js';
import type { ScriptGenerator, ScriptResult, Term } from '../types.js';
import { issuesToFeedback, type FactChecker, type FactCheckVerdict } from './types.js';
import { GeminiFactChecker } from './gemini.js';
import { NoopFactChecker } from './noop.js';

/**
 * ファクトチェック・ゲートのオーケストレータ（設計書参照）。
 * 生成 → 検証 → (fail なら指摘つき再生成) を maxRegen 回まで繰り返す。純粋にDIで動くので
 * fake generator/checker で単体テストできる。
 */
export interface VerifiedGenerateResult {
  ok: boolean;
  script: ScriptResult;
  verdict?: FactCheckVerdict;
  attempts: number;
}

export async function verifiedGenerate(
  term: Term,
  generator: ScriptGenerator,
  checker: FactChecker,
  opts: { maxRegen?: number } = {},
): Promise<VerifiedGenerateResult> {
  const maxRegen = opts.maxRegen ?? config.verify.maxRegen;
  let feedback = '';
  let script = await generator.generate(term);
  for (let attempt = 1; ; attempt++) {
    const verdict = await checker.check(term, script);
    if (verdict.verdict === 'pass') {
      return { ok: true, script, verdict, attempts: attempt };
    }
    if (attempt > maxRegen) {
      return { ok: false, script, verdict, attempts: attempt };
    }
    feedback = issuesToFeedback(verdict.issues);
    script = await generator.generate(term, feedback);
  }
}

/** GEMINI_API_KEY と VERIFY_ENABLED が揃えば Gemini、なければ Noop（常にpass＋警告）。 */
export function createFactChecker(): FactChecker {
  return config.verify.enabled && config.gemini.enabled
    ? new GeminiFactChecker()
    : new NoopFactChecker();
}

export { GeminiFactChecker, NoopFactChecker };
export * from './types.js';
