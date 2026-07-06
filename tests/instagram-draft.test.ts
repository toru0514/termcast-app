import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeInstagramDraft } from '../src/social/instagram.js';
import { DISCLAIMER, type SceneFile } from '../src/types.js';

const sceneFile: SceneFile = {
  term: 'PER',
  reading: 'ぴーいーあーる',
  category: '指標',
  disclaimer: DISCLAIMER,
  scenes: [
    { id: 1, type: 'hook', narration: 'PERって何の略？', caption: 'PER?', visual: 'ratio_calc' },
    { id: 2, type: 'definition', narration: '株価が割高か割安かを見る指標です。', caption: '割高割安', visual: 'ratio_calc' },
    { id: 3, type: 'example', narration: '株価÷1株利益で計算します。', caption: '計算式', visual: 'ratio_calc' },
    { id: 4, type: 'summary', narration: '以上、PERでした！', caption: 'まとめ', visual: 'generic_term' },
  ],
};

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('writeInstagramDraft', () => {
  it('Graph API 互換の meta.json と caption/hashtags を出力する', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'igdraft-'));
    dirs.push(root);
    const videoPath = resolve(root, 'src.mp4');
    await writeFile(videoPath, 'dummy-bytes');

    const res = await writeInstagramDraft('per-content', videoPath, sceneFile, {
      outRoot: root,
      now: () => new Date('2026-07-06T00:00:00Z'),
    });

    // meta.json は Graph API のキー構造
    const meta = JSON.parse(await readFile(res.metaPath, 'utf8'));
    expect(meta.media_type).toBe('REELS');
    expect(meta.video_url).toBeNull();
    expect(meta.cover_url).toBeNull();
    expect(meta.share_to_feed).toBe(true);
    expect(typeof meta.caption).toBe('string');
    expect(meta._draft.content_id).toBe('per-content');
    expect(meta._draft.local_video).toBe('video.mp4');

    // 付随ファイル
    const caption = await readFile(resolve(res.dir, 'caption.txt'), 'utf8');
    const hashtags = await readFile(resolve(res.dir, 'hashtags.txt'), 'utf8');
    expect(caption).toContain('PERとは？');
    expect(hashtags).toContain('#PER');

    // 動画がコピーされている
    const copied = await readFile(resolve(res.dir, 'video.mp4'), 'utf8');
    expect(copied).toBe('dummy-bytes');
  });

  it('copyVideo=false ならコピーせず元パスを参照する', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'igdraft2-'));
    dirs.push(root);
    const res = await writeInstagramDraft('x', '/nonexistent/video.mp4', sceneFile, {
      outRoot: root,
      copyVideo: false,
    });
    expect(res.videoPath).toBe('/nonexistent/video.mp4');
  });
});
