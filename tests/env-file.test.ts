import { describe, it, expect } from 'vitest';
import { updateEnvContent } from '../src/env-file.js';

describe('updateEnvContent', () => {
  it('既存キーは値だけ差し替え、他行は保持する', () => {
    const src = 'A=1\nTIKTOK_REFRESH_TOKEN=old\nB=2\n';
    const out = updateEnvContent(src, { TIKTOK_REFRESH_TOKEN: 'new' });
    expect(out).toBe('A=1\nTIKTOK_REFRESH_TOKEN=new\nB=2\n');
  });

  it('無いキーは末尾に追記する', () => {
    const out = updateEnvContent('A=1\n', { TIKTOK_ACCESS_TOKEN: 'tok' });
    expect(out).toBe('A=1\nTIKTOK_ACCESS_TOKEN=tok\n');
  });

  it('空ファイルにも追記でき、改行が壊れない', () => {
    const out = updateEnvContent('', { A: '1', B: '2' });
    expect(out).toBe('A=1\nB=2\n');
  });

  it('末尾改行が無い既存ファイルでも崩れない', () => {
    const out = updateEnvContent('A=1', { B: '2' });
    expect(out).toBe('A=1\nB=2\n');
  });

  it('複数キーを一度に upsert（片方は上書き・片方は追記）', () => {
    const src = 'TIKTOK_ACCESS_TOKEN=a0\n';
    const out = updateEnvContent(src, { TIKTOK_ACCESS_TOKEN: 'a1', TIKTOK_REFRESH_TOKEN: 'r1' });
    expect(out).toBe('TIKTOK_ACCESS_TOKEN=a1\nTIKTOK_REFRESH_TOKEN=r1\n');
  });
});
