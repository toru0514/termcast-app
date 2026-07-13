import type { ScriptGenerator, ScriptResult, Term } from '../types.js';
import { suggestVisual } from '../scene/visuals.js';

/**
 * API不要の決定的な台本生成。Gemini未設定時のフォールバック兼テスト用。
 * README §3.2 の固定構成（フック→定義→具体例→まとめ）に沿う。
 */
export class TemplateScriptGenerator implements ScriptGenerator {
  name = 'template';

  // feedback はテンプレ生成では使わない（決定的な内容のため）。引数は互換のため受け取る。
  async generate(term: Term, _feedback?: string): Promise<ScriptResult> {
    const t = term.term;
    const cat = term.category || '株式投資';

    return {
      term: t,
      scenes: [
        {
          type: 'hook',
          narration: `${t}、説明できますか？`,
          caption: `${t}って何？`,
          visual: suggestVisual(t, 'hook'),
        },
        {
          type: 'definition',
          narration: `${cat}でよく使う基本用語です。`,
          caption: `${cat}の基本用語`,
          visual: suggestVisual(t, 'definition'),
        },
        {
          type: 'example',
          narration: `チャートや決算を読むヒントになります。`,
          caption: `判断のヒントに`,
          visual: suggestVisual(t, 'example'),
        },
        {
          type: 'summary',
          narration: `以上、${t}でした！`,
          caption: `今日のまとめ`,
          visual: suggestVisual(t, 'summary'),
        },
      ],
    };
  }
}
