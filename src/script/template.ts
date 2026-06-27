import type { ScriptGenerator, ScriptResult, Term } from '../types.js';
import { suggestVisual } from '../scene/visuals.js';

/**
 * API不要の決定的な台本生成。Gemini未設定時のフォールバック兼テスト用。
 * README §3.2 の固定構成（フック→定義→具体例→まとめ）に沿う。
 */
export class TemplateScriptGenerator implements ScriptGenerator {
  name = 'template';

  async generate(term: Term): Promise<ScriptResult> {
    const t = term.term;
    const cat = term.category || '株式投資';

    return {
      term: t,
      scenes: [
        {
          type: 'hook',
          narration: `${t}って説明できますか？30秒でサクッと理解しましょう。`,
          caption: `${t}って何？`,
          visual: suggestVisual(t, 'hook'),
        },
        {
          type: 'definition',
          narration: `${t}は、${cat}でよく使う基本用語です。意味をシンプルに押さえましょう。`,
          caption: `${cat}の基本用語`,
          visual: suggestVisual(t, 'definition'),
        },
        {
          type: 'example',
          narration: `チャートや決算を見るとき、${t}を知っていると判断のヒントになります。`,
          caption: `判断のヒントに`,
          visual: suggestVisual(t, 'example'),
        },
        {
          type: 'summary',
          narration: `以上、${t}でした。明日は別の用語を解説します。`,
          caption: `今日のまとめ`,
          visual: suggestVisual(t, 'summary'),
        },
      ],
    };
  }
}
