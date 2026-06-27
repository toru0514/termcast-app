import { describe, it, expect } from 'vitest';
import {
  createPublishers,
  resultsToPublishFields,
  publishAll,
} from '../src/publish/index.js';
import type { PublishResult } from '../src/types.js';

describe('publish router', () => {
  it('--only でアダプタを絞り込める', () => {
    expect(createPublishers(['youtube']).map((p) => p.name)).toEqual(['youtube']);
    expect(createPublishers().map((p) => p.name)).toEqual(['youtube', 'tiktok', 'instagram']);
  });

  it('成功結果のみ TermStore フィールドに反映', () => {
    const results: PublishResult[] = [
      { platform: 'youtube', status: 'ok', id: 'yt123' },
      { platform: 'tiktok', status: 'error', message: 'boom' },
      { platform: 'instagram', status: 'ok', link: 'https://drive/x' },
    ];
    expect(resultsToPublishFields(results)).toEqual({
      youtube_video_id: 'yt123',
      tiktok_draft_id: null,
      drive_link: 'https://drive/x',
    });
  });

  it('認証情報未設定なら全媒体 skipped（実通信なし）', async () => {
    const results = await publishAll(
      createPublishers(),
      { path: '/tmp/nonexistent.mp4' },
      { title: 't', description: 'd', tags: [], disclaimer: 'x' },
    );
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
  });
});
