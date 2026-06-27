import { readFile } from 'node:fs/promises';
import { paths } from '../src/config.js';

/** data/terms.seed.json を Supabase 投入用の INSERT 文として出力する */
async function main() {
  const seed = JSON.parse(await readFile(paths.seed, 'utf8')) as Array<{
    term: string;
    reading?: string;
    category?: string;
    difficulty?: number;
  }>;

  const esc = (s: string) => s.replace(/'/g, "''");
  const values = seed
    .map(
      (t) =>
        `  ('${esc(t.term)}', '${esc(t.reading ?? '')}', '${esc(t.category ?? '')}', ${t.difficulty ?? 1})`,
    )
    .join(',\n');

  console.log('insert into terms (term, reading, category, difficulty) values');
  console.log(values);
  console.log('on conflict (term) do nothing;');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
