import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config.js';
import type { ScriptResult, Term } from '../types.js';
import { FactCheckVerdictSchema, type FactChecker, type FactCheckVerdict } from './types.js';

/**
 * Gemini による独立ファクトチェッカー。
 *
 * 生成側のプロンプトは一切見せず、「用語＋生成ナレーション」だけを渡して、モデル自身の知識で
 * 事実の正誤を批判的に判定させる（同じ勘違いの伝播を防ぐ）。明確な事実誤り・投資助言的断定のみを
 * fail とし、文体や細かな表現は不問（正しい台本の誤検出を避ける）。
 */
export class GeminiFactChecker implements FactChecker {
  name = 'gemini-factcheck';
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  async check(term: Term, script: ScriptResult): Promise<FactCheckVerdict> {
    const model = this.genAI.getGenerativeModel({
      model: config.verify.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            verdict: { type: SchemaType.STRING, enum: ['pass', 'fail'], format: 'enum' },
            issues: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  scene: { type: SchemaType.STRING },
                  problem: { type: SchemaType.STRING },
                  correction: { type: SchemaType.STRING },
                },
                required: ['scene', 'problem', 'correction'],
              },
            },
          },
          required: ['verdict', 'issues'],
        },
      },
    });

    const res = await model.generateContent(this.buildPrompt(term, script));
    const parsed = JSON.parse(res.response.text());
    return FactCheckVerdictSchema.parse(parsed);
  }

  private buildPrompt(term: Term, script: ScriptResult): string {
    const scenes = script.scenes.map((s) => `- ${s.type}: ${s.narration}`).join('\n');
    return [
      'あなたは株式・投資分野の厳格なファクトチェッカーです。',
      '以下は、ある株用語を解説するショート動画のナレーション原稿です。',
      '各文が「事実として正しいか」だけを、あなた自身の知識で批判的に検証してください。',
      '',
      `【用語】${term.term}（読み: ${term.reading} / カテゴリ: ${term.category}）`,
      '【ナレーション】',
      scenes,
      '',
      '判定ルール（厳守）:',
      '- 明確な事実誤りがある場合のみ verdict を "fail" にする。例:',
      '  定義そのものの誤り／別用語の説明になっている／数値・方向・大小関係の取り違え',
      '  （始値と終値、高値と安値、上がる/下がる 等の逆転）／投資助言的な断定（「買うべき」等）。',
      '- 言い回し・テンポ・省略など文体上の問題は指摘しない（fail にしない）。',
      '- 判断に迷う程度（軽微・曖昧）は "pass" に倒す。',
      '- fail の場合、issues に {scene, problem, correction} を挙げる。correction は正しい内容。',
      '- 誤りが無ければ verdict は "pass"、issues は空配列。',
    ].join('\n');
  }
}
