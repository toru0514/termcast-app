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
          narration: `${t}って、なんとなく聞いたことはあるけど説明できますか？30秒でスッキリ理解しましょう。`,
          caption: `${t}って何？`,
          visual: suggestVisual(t, 'hook'),
        },
        {
          type: 'definition',
          narration: `${t}は、${cat}の世界でよく使われる基本用語のひとつです。まずは言葉の意味をシンプルに押さえましょう。`,
          caption: `${t}＝${cat}の基本用語`,
          visual: suggestVisual(t, 'definition'),
        },
        {
          type: 'example',
          narration: `たとえば株価のチャートや決算の数字を見るとき、${t}を知っていると判断のヒントになります。身近な例でイメージするのがコツです。`,
          caption: `具体例でイメージ`,
          visual: suggestVisual(t, 'example'),
        },
        {
          type: 'summary',
          narration: `というわけで${t}でした。明日は別の用語を解説します。チャンネル登録で一緒に学んでいきましょう。`,
          caption: `今日のまとめ`,
          visual: suggestVisual(t, 'summary'),
        },
      ],
    };
  }
}
