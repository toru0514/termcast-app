import { z } from 'zod';
import type { ScriptResult, Term } from '../types.js';

/**
 * ファクトチェック・ゲートの契約（設計書 docs/.../2026-07-13-factcheck-gate-design.md）。
 * 台本(ScriptResult)の事実誤りを独立AIで検出するためのインターフェースと結果型。
 */
export const FactCheckIssueSchema = z.object({
  /** 誤りのあったシーン種別（hook/definition/example/summary 等） */
  scene: z.string(),
  /** 何が事実として誤っているか */
  problem: z.string(),
  /** 正しくはどうあるべきか（再生成のヒントに使う） */
  correction: z.string().default(''),
});
export type FactCheckIssue = z.infer<typeof FactCheckIssueSchema>;

export const FactCheckVerdictSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  issues: z.array(FactCheckIssueSchema).default([]),
});
export type FactCheckVerdict = z.infer<typeof FactCheckVerdictSchema>;

/** 台本の事実確認を行う抽象（Gemini / Noop を差し替え可能に） */
export interface FactChecker {
  name: string;
  check(term: Term, script: ScriptResult): Promise<FactCheckVerdict>;
}

/** issues を再生成プロンプトへ渡す1行フィードバックに整形する */
export function issuesToFeedback(issues: FactCheckIssue[]): string {
  if (issues.length === 0) return '';
  const lines = issues.map(
    (i) => `- [${i.scene}] ${i.problem}${i.correction ? `（正: ${i.correction}）` : ''}`,
  );
  return ['前回の台本には次の事実誤りがありました。必ず修正してください:', ...lines].join('\n');
}
