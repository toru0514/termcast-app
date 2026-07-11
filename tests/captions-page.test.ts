import { describe, it, expect } from 'vitest';
import { renderCaptionsHtml, type CaptionItem } from '../src/social/captions-page.js';

const meta = { total: 2, ok: 1, skipped: 0, failed: 0, generatedAt: '2026-07-12 00:00 UTC' };

describe('renderCaptionsHtml', () => {
  it('各アイテムをカード化しコピーボタンを付ける', () => {
    const items: CaptionItem[] = [
      { term: 'PBR', file: 'PBR.mp4', draftId: 'v_1', body: 'PBRとは…\n#株用語' },
      { term: 'PER', file: 'PER.mp4', draftId: '', body: 'PERとは…\n#株用語' },
    ];
    const html = renderCaptionsHtml(items, meta);
    expect((html.match(/class="card"/g) ?? []).length).toBe(2);
    expect((html.match(/button class="copy"/g) ?? []).length).toBe(2);
    expect(html).toContain('PBR');
    expect(html).toContain('#株用語');
  });

  it('送信済みは下書き済バッジ、未送信は未送信バッジ', () => {
    const html = renderCaptionsHtml(
      [
        { term: 'A', file: 'a.mp4', draftId: 'v_1', body: 'x' },
        { term: 'B', file: 'b.mp4', draftId: '', body: 'y' },
      ],
      meta,
    );
    expect(html).toContain('badge sent');
    expect(html).toContain('badge pending');
  });

  it('HTML特殊文字をエスケープしてXSSを防ぐ', () => {
    const html = renderCaptionsHtml(
      [{ term: 'X', file: 'x.mp4', draftId: '', body: '<script>alert(1)</script>' }],
      meta,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
