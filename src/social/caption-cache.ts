import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { paths } from '../config.js';

/**
 * 動画ファイル名 → 生成済みキャプションのキャッシュ。
 *
 * キャプションは生成のたびに文言が揺れる（＝毎回作り直すと captions.html の差分が荒れ、
 * 既にコピー済みの文面も変わる）。一度作ったキャプションをここに固定しておき、日次の
 * ページ更新では新規動画ぶんだけ足す。generate は「ファクトチェック済みシーン」から作った
 * 正規のキャプションをここへ保存する。
 */
export interface CachedCaption {
  term: string;
  body: string;
}
export type CaptionCache = Record<string, CachedCaption>;

const DEFAULT_PATH = resolve(paths.output, 'tiktok-captions.json');

export async function loadCaptionCache(path: string = DEFAULT_PATH): Promise<CaptionCache> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CaptionCache;
  } catch {
    return {};
  }
}

export async function saveCaptionCache(cache: CaptionCache, path: string = DEFAULT_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2));
}

/** 1件ぶんキャッシュへ upsert して保存する（generate から呼ぶ用の薄いヘルパ）。 */
export async function cacheCaption(file: string, term: string, body: string): Promise<void> {
  const cache = await loadCaptionCache();
  cache[file] = { term, body };
  await saveCaptionCache(cache);
}
