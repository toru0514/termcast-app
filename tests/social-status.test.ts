import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { SocialStatusStore } from '../src/social/status.js';
import { RateLimiter } from '../src/social/platforms.js';

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('SocialStatusStore', () => {
  it('media横断で3段階ステータスを記録・上書きする', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'status-'));
    dirs.push(root);
    const store = new SocialStatusStore(resolve(root, 'social-status.json'));

    await store.set('c1', { platform: 'tiktok', stage: 'draft_sent', targetId: 'pub_1' });
    await store.set('c1', { platform: 'instagram', stage: 'material_ready' });

    let s = await store.get('c1');
    expect(s?.tiktok?.stage).toBe('draft_sent');
    expect(s?.tiktok?.targetId).toBe('pub_1');
    expect(s?.instagram?.stage).toBe('material_ready');

    // 同 platform は上書き（審査後 published へ昇格）
    await store.set('c1', { platform: 'instagram', stage: 'published', link: 'https://insta/x' });
    s = await store.get('c1');
    expect(s?.instagram?.stage).toBe('published');
    expect(s?.instagram?.link).toBe('https://insta/x');
    // 別 platform は保持
    expect(s?.tiktok?.stage).toBe('draft_sent');
  });

  it('未知 content_id は undefined', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'status2-'));
    dirs.push(root);
    const store = new SocialStatusStore(resolve(root, 's.json'));
    expect(await store.get('none')).toBeUndefined();
  });
});

describe('RateLimiter', () => {
  it('perMinute から最短間隔を導き、初回は待たない', () => {
    const rl = new RateLimiter(6); // 6/min = 10000ms間隔
    expect(rl.waitMs(0)).toBe(0); // lastAt=0 の初回
  });

  it('間隔未満なら残り時間を返す', async () => {
    const rl = new RateLimiter(6);
    let clock = 1_000_000;
    const now = () => clock;
    const sleeps: number[] = [];
    const sleep = async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
    };
    await rl.acquire(sleep, now); // 1回目: 待たない
    clock += 3000; // 3秒後
    await rl.acquire(sleep, now); // 10秒間隔に満たない → 7秒待つ
    expect(sleeps).toEqual([7000]);
  });

  it('perMinute 未指定なら待たない', () => {
    const rl = new RateLimiter(undefined);
    expect(rl.waitMs(999999)).toBe(0);
  });
});
