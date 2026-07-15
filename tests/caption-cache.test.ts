import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadCaptionCache, saveCaptionCache } from '../src/social/caption-cache.js';

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('caption-cache', () => {
  it('存在しないファイルは空オブジェクト', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'cap-'));
    dirs.push(root);
    expect(await loadCaptionCache(resolve(root, 'none.json'))).toEqual({});
  });

  it('保存した内容をそのまま読み戻せる', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'cap2-'));
    dirs.push(root);
    const path = resolve(root, 'c.json');
    await saveCaptionCache({ 'a.mp4': { term: 'PBR', body: 'x #株用語' } }, path);
    const loaded = await loadCaptionCache(path);
    expect(loaded['a.mp4'].body).toBe('x #株用語');
    expect(loaded['a.mp4'].term).toBe('PBR');
  });

  it('壊れたJSONは空オブジェクトにフォールバック', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'cap3-'));
    dirs.push(root);
    const path = resolve(root, 'broken.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, '{ not json');
    expect(await loadCaptionCache(path)).toEqual({});
  });
});
