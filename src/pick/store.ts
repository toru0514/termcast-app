import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, paths } from '../config.js';
import { TermSchema, type Term } from '../types.js';
import { selectTerm } from './select.js';

export interface PublishFields {
  youtube_video_id?: string | null;
  tiktok_draft_id?: string | null;
  drive_link?: string | null;
}

/** ①ネタ管理の抽象。Supabase 本番 / ローカルJSON フォールバックを差し替え可能に。 */
export interface TermStore {
  name: string;
  /** 次に動画化する1語を選定（pending → difficulty昇順・カテゴリ分散） */
  pickNext(): Promise<Term | null>;
  markGenerated(id: string): Promise<void>;
  markPublished(id: string, fields: PublishFields): Promise<void>;
}

// ===== ローカルJSON ストア（Supabase未設定時のフォールバック） =====
interface UsedRecord {
  status: 'generated' | 'published';
  published_at?: string;
  category: string;
  youtube_video_id?: string | null;
  tiktok_draft_id?: string | null;
  drive_link?: string | null;
}
type UsedMap = Record<string, UsedRecord>;

function slug(term: string): string {
  return `local-${Buffer.from(term).toString('hex').slice(0, 16)}`;
}

export class LocalTermStore implements TermStore {
  name = 'local-json';

  private async loadSeed(): Promise<Term[]> {
    const raw = JSON.parse(await readFile(paths.seed, 'utf8')) as unknown[];
    return raw.map((r) => {
      const obj = r as Record<string, unknown>;
      return TermSchema.parse({
        id: slug(String(obj.term)),
        term: obj.term,
        reading: obj.reading ?? '',
        category: obj.category ?? '',
        difficulty: obj.difficulty ?? 1,
        status: 'pending',
      });
    });
  }

  private async loadUsed(): Promise<UsedMap> {
    if (!existsSync(paths.used)) return {};
    return JSON.parse(await readFile(paths.used, 'utf8')) as UsedMap;
  }

  private async saveUsed(used: UsedMap): Promise<void> {
    await writeFile(paths.used, JSON.stringify(used, null, 2));
  }

  async pickNext(): Promise<Term | null> {
    const seed = await this.loadSeed();
    const used = await this.loadUsed();
    const pending = seed.filter((t) => !used[t.id]);

    // 直近 published のカテゴリを新しい順に（カテゴリ分散用）
    const recentCategories = Object.values(used)
      .filter((u) => u.published_at)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      .map((u) => u.category);

    return selectTerm(pending, recentCategories);
  }

  async markGenerated(id: string): Promise<void> {
    const seed = await this.loadSeed();
    const term = seed.find((t) => t.id === id);
    const used = await this.loadUsed();
    used[id] = { ...used[id], status: 'generated', category: term?.category ?? '' };
    await this.saveUsed(used);
  }

  async markPublished(id: string, fields: PublishFields): Promise<void> {
    const used = await this.loadUsed();
    const prev = used[id] ?? { category: '' };
    used[id] = {
      ...prev,
      status: 'published',
      published_at: new Date().toISOString(),
      ...fields,
    };
    await this.saveUsed(used);
  }
}

// ===== Supabase ストア（本番） =====
export class SupabaseTermStore implements TermStore {
  name = 'supabase';
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.key, {
      auth: { persistSession: false },
    });
  }

  async pickNext(): Promise<Term | null> {
    const { data: pendingRows, error } = await this.client
      .from(config.supabase.table)
      .select('*')
      .eq('status', 'pending');
    if (error) throw new Error(`Supabase pickNext failed: ${error.message}`);

    const { data: publishedRows } = await this.client
      .from(config.supabase.table)
      .select('category, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);

    const pending = (pendingRows ?? []).map((r) => TermSchema.parse(r));
    const recentCategories = (publishedRows ?? []).map((r) => String(r.category ?? ''));
    return selectTerm(pending, recentCategories);
  }

  async markGenerated(id: string): Promise<void> {
    const { error } = await this.client
      .from(config.supabase.table)
      .update({ status: 'generated' })
      .eq('id', id);
    if (error) throw new Error(`Supabase markGenerated failed: ${error.message}`);
  }

  async markPublished(id: string, fields: PublishFields): Promise<void> {
    const { error } = await this.client
      .from(config.supabase.table)
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        ...fields,
      })
      .eq('id', id);
    if (error) throw new Error(`Supabase markPublished failed: ${error.message}`);
  }
}

export function createTermStore(): TermStore {
  return config.supabase.enabled ? new SupabaseTermStore() : new LocalTermStore();
}
