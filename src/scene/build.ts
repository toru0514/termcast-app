import {
  DISCLAIMER,
  SceneFileSchema,
  type ScriptResult,
  type SceneFile,
  type Term,
} from '../types.js';
import { normalizeVisual } from './visuals.js';

/**
 * ③シーン定義生成（純粋関数）。
 * 台本(ScriptResult) + term を、レンダラー非依存の中間表現 scene.json に展開する。
 */
export function buildSceneFile(term: Term, script: ScriptResult): SceneFile {
  const scenes = script.scenes.map((draft, i) => ({
    id: i + 1,
    type: draft.type,
    narration: draft.narration,
    caption: draft.caption,
    visual: normalizeVisual(term.term, draft.type, draft.visual),
  }));

  return SceneFileSchema.parse({
    term: term.term,
    reading: term.reading,
    category: term.category,
    disclaimer: DISCLAIMER,
    scenes,
  });
}

/** ④音声合成で得た各シーンの尺を scene.json に書き戻す */
export function applyDurations(sceneFile: SceneFile, durations: number[], audioFile: string): SceneFile {
  if (durations.length !== sceneFile.scenes.length) {
    throw new Error(
      `durations length (${durations.length}) != scenes length (${sceneFile.scenes.length})`,
    );
  }
  return SceneFileSchema.parse({
    ...sceneFile,
    audioFile,
    scenes: sceneFile.scenes.map((s, i) => ({ ...s, durationSec: durations[i] })),
  });
}
