/**
 * TikTok 下書き公開用キャプションのモバイル向け閲覧ページ生成。
 *
 * 下書き(inbox)はAPIで説明文を埋め込めないため、公開時にスマホから本文をコピペできるよう、
 * 各動画のキャプションにコピーボタンを付けた自己完結HTMLを出力する（GitHub Pages 等で配信）。
 */
export interface CaptionItem {
  term: string;
  file: string;
  draftId: string;
  body: string;
  error?: string;
}

export interface CaptionPageMeta {
  total: number;
  ok: number;
  skipped: number;
  failed: number;
  generatedAt: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderCaptionsHtml(items: CaptionItem[], meta: CaptionPageMeta): string {
  const cards = items
    .map((it) => {
      const sent = it.draftId
        ? '<span class="badge sent">下書き済</span>'
        : it.error
          ? '<span class="badge err">未送信</span>'
          : '<span class="badge pending">未送信</span>';
      const body = escapeHtml(it.body);
      return `
    <article class="card">
      <header>
        <h2>${escapeHtml(it.term)}</h2>
        ${sent}
      </header>
      <pre id="c${escapeHtml(it.file)}">${body}</pre>
      <button class="copy" data-target="c${escapeHtml(it.file)}">コピー</button>
      <p class="file">${escapeHtml(it.file)}</p>
    </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>TikTok 公開用キャプション — termcast</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; background:#0f1014; color:#f2f2f2;
         margin:0; padding:16px; max-width:720px; margin:0 auto; }
  h1 { font-size:20px; }
  .meta { color:#8a8f98; font-size:13px; margin-bottom:16px; }
  .card { background:#1a1c22; border-radius:14px; padding:16px; margin-bottom:14px; }
  .card header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .card h2 { font-size:17px; margin:0; }
  pre { white-space:pre-wrap; word-break:break-word; background:#000; border-radius:10px;
        padding:12px; font-size:14px; line-height:1.5; margin:12px 0 10px; }
  button.copy { background:#fe2c55; color:#fff; border:0; border-radius:10px; padding:11px 18px;
                font-size:15px; width:100%; cursor:pointer; }
  button.copy.done { background:#25f4ee; color:#000; }
  .file { color:#6b7078; font-size:12px; margin:8px 0 0; }
  .badge { font-size:11px; padding:3px 8px; border-radius:999px; white-space:nowrap; }
  .badge.sent { background:#123; color:#25f4ee; }
  .badge.pending, .badge.err { background:#2a2030; color:#ff8fa3; }
</style>
</head>
<body>
  <h1>TikTok 公開用キャプション</h1>
  <p class="meta">全${meta.total}本 / 下書き済 ${meta.ok + meta.skipped} / 未送信 ${meta.failed}<br />
     更新: ${escapeHtml(meta.generatedAt)}<br />
     公開時に「コピー」で本文＋ハッシュタグをコピーし、TikTokアプリに貼り付けてください。</p>
${cards}
<script>
  document.querySelectorAll('button.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = document.getElementById(btn.dataset.target);
      try {
        await navigator.clipboard.writeText(el.textContent);
        btn.textContent = 'コピーしました';
        btn.classList.add('done');
        setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('done'); }, 1500);
      } catch (e) {
        const r = document.createRange(); r.selectNode(el);
        getSelection().removeAllRanges(); getSelection().addRange(r);
      }
    });
  });
</script>
</body>
</html>
`;
}
