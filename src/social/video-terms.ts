import { readFile } from 'node:fs/promises';
import { paths } from '../config.js';
import { TermSchema, type Term } from '../types.js';

/**
 * 生成済み動画ファイル名から用語/Termを復元するヘルパ（backfill と captions:page で共用）。
 * 過去動画は scene.json が残っていないため、ファイル名の用語＋seedメタから Term を組み立てる。
 */

/** `PBR_2026-06-27-...mp4` / `NISA_final.mp4` → 用語部分を取り出す */
export function termFromFilename(file: string): string {
  return file.replace(/\.mp4$/i, '').replace(/_(\d{4}-\d{2}-\d{2}.*|final)$/i, '');
}

/** seed の用語メタ（id/reading/category/difficulty）を用語名で引ける Map にする */
export async function loadSeedByTerm(): Promise<Map<string, Partial<Term>>> {
  const map = new Map<string, Partial<Term>>();
  try {
    const seed = JSON.parse(await readFile(paths.seed, 'utf8')) as Array<Record<string, unknown>>;
    seed.forEach((s, i) => {
      if (typeof s.term === 'string') {
        map.set(s.term, {
          id: (s.id as string) ?? `seed-${i}`,
          term: s.term,
          reading: (s.reading as string) ?? '',
          category: (s.category as string) ?? '',
          difficulty: (s.difficulty as number) ?? 1,
        });
      }
    });
  } catch {
    /* seed が無ければ用語名だけで進める */
  }
  return map;
}

export function toTerm(termStr: string, seed?: Partial<Term>): Term {
  return TermSchema.parse({
    id: seed?.id ?? termStr,
    term: termStr,
    reading: seed?.reading ?? '',
    category: seed?.category ?? '',
    difficulty: seed?.difficulty ?? 1,
  });
}
