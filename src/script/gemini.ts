import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config.js';
import { ScriptResultSchema, type ScriptGenerator, type ScriptResult, type Term } from '../types.js';
import { normalizeVisual } from '../scene/visuals.js';

/**
 * ②台本生成: Gemini Flash アダプタ（README §3.2）。
 * - Flash系のみ使用（Pro系は2026年4月以降有料専用）。
 * - JSON モードで構造化出力を安定させる。
 */
export class GeminiScriptGenerator implements ScriptGenerator {
  name = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  async generate(term: Term, feedback?: string): Promise<ScriptResult> {
    const model = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            scenes: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  type: {
                    type: SchemaType.STRING,
                    enum: ['hook', 'definition', 'example', 'summary'],
                    format: 'enum',
                  },
                  narration: { type: SchemaType.STRING },
                  caption: { type: SchemaType.STRING },
                },
                required: ['type', 'narration', 'caption'],
              },
            },
          },
          required: ['scenes'],
        },
      },
    });

    const prompt = this.buildPrompt(term, feedback);
    const res = await model.generateContent(prompt);
    const json = JSON.parse(res.response.text()) as {
      scenes: Array<{ type: string; narration: string; caption: string; visual?: string }>;
    };

    const scenes = json.scenes.map((s) => ({
      type: s.type as ScriptResult['scenes'][number]['type'],
      narration: s.narration,
      caption: s.caption,
      visual: normalizeVisual(term.term, s.type as ScriptResult['scenes'][number]['type'], s.visual),
    }));

    return ScriptResultSchema.parse({ term: term.term, scenes });
  }

  private buildPrompt(term: Term, feedback?: string): string {
    return [
      'あなたは株式投資初心者向けのショート動画の構成作家です。',
      `次の株用語を、約15〜20秒でサクッと解説する台本を作ってください。とにかく短くテンポよく。`,
      `用語: ${term.term}（読み: ${term.reading}、カテゴリ: ${term.category}、難易度: ${term.difficulty}）`,
      '',
      '構成は次の4シーン固定です:',
      '1. hook … 1文で興味を引く',
      '2. definition … 平易な言葉で一言定義',
      '3. example … 数字や身近な例で説明',
      '4. summary … 一言で締め',
      '',
      '制約（厳守）:',
      '- narration は読み上げ用の自然な話し言葉。1シーン20〜30字、合計90〜110字程度。',
      '- 冗長な前置き・修飾・繰り返しは禁止。要点だけを一息で言い切る。',
      '- caption は画面テロップ用の短い一言（最大12字）。',
      '- 投資助言と誤認される断定（「買うべき」等）は避け、教育目的に徹する。',
      '- 事実に正確であること。特に始値/終値・高値/安値・上昇/下落など方向や大小関係を間違えない。',
      '- 各シーンに type / narration / caption を必ず含めること。',
      // ファクトチェック不合格からの再生成時は、指摘された誤りを最優先で修正する。
      ...(feedback ? ['', feedback] : []),
    ].join('\n');
  }
}
