import { config } from '../config.js';
import type { ScriptGenerator } from '../types.js';
import { TemplateScriptGenerator } from './template.js';
import { GeminiScriptGenerator } from './gemini.js';

/**
 * script-generator の選択。GEMINI_API_KEY があれば Gemini、なければテンプレ。
 * 抽象化により将来 Claude 等へ差し替えてもパイプラインは無傷（README §3.2）。
 */
export function createScriptGenerator(): ScriptGenerator {
  return config.gemini.enabled ? new GeminiScriptGenerator() : new TemplateScriptGenerator();
}

export { TemplateScriptGenerator, GeminiScriptGenerator };
