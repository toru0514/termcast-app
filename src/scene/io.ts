import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { paths } from '../config.js';
import { SceneFileSchema, type SceneFile } from '../types.js';

export async function writeSceneFile(sceneFile: SceneFile, fileName = 'scene.json'): Promise<string> {
  await mkdir(paths.scene, { recursive: true });
  const out = resolve(paths.scene, fileName);
  await writeFile(out, JSON.stringify(sceneFile, null, 2));
  return out;
}

export async function readSceneFile(fileName = 'scene.json'): Promise<SceneFile> {
  const p = resolve(paths.scene, fileName);
  const raw = JSON.parse(await readFile(p, 'utf8'));
  return SceneFileSchema.parse(raw);
}
