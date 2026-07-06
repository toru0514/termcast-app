import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { paths } from '../config.js';
import { SocialPlatform } from './platforms.js';

/**
 * 共通ステータス管理（設計書 §5「ステータス管理」）。
 *
 * 「素材生成済み(material_ready)」「下書き送信済み(draft_sent)」「公開済み(published)」の3段階を
 * 媒体横断の共通スキーマで管理する。プラットフォームごとに API 実装が変わっても、この管理層は使い回す。
 * Instagram のように審査前(JSON下書き=draft_sent)→審査後(API公開=published)で接続先が変わっても段階表現は不変。
 */
export const SocialStage = z.enum(['material_ready', 'draft_sent', 'published']);
export type SocialStage = z.infer<typeof SocialStage>;

export const SocialStatusEntrySchema = z.object({
  platform: SocialPlatform,
  stage: SocialStage,
  /** 下書きID / 投稿ID など媒体側の識別子 */
  targetId: z.string().nullable().optional(),
  /** 生成物や投稿へのリンク（下書きフォルダ・ツイートURL 等） */
  link: z.string().nullable().optional(),
  message: z.string().optional(),
  updatedAt: z.string(),
});
export type SocialStatusEntry = z.infer<typeof SocialStatusEntrySchema>;

/** content_id -> platform -> entry */
export const SocialStatusFileSchema = z.record(
  z.string(),
  z.record(SocialPlatform, SocialStatusEntrySchema),
);
export type SocialStatusFile = z.infer<typeof SocialStatusFileSchema>;

const DEFAULT_PATH = resolve(paths.output, 'social-status.json');

/**
 * output/social-status.json を読み書きする軽量ストア。
 * Supabase 等へ差し替える場合もこのインターフェースを保てばよい（TermStore と同じ思想）。
 */
export class SocialStatusStore {
  constructor(private filePath: string = DEFAULT_PATH) {}

  async load(): Promise<SocialStatusFile> {
    if (!existsSync(this.filePath)) return {};
    const raw = JSON.parse(await readFile(this.filePath, 'utf8'));
    return SocialStatusFileSchema.parse(raw);
  }

  private async save(data: SocialStatusFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  /** 1媒体ぶんの段階を記録（同 content_id / platform は上書き） */
  async set(
    contentId: string,
    entry: Omit<SocialStatusEntry, 'updatedAt'> & { updatedAt?: string },
  ): Promise<SocialStatusEntry> {
    const data = await this.load();
    const full = SocialStatusEntrySchema.parse({
      ...entry,
      updatedAt: entry.updatedAt ?? new Date().toISOString(),
    });
    data[contentId] = { ...(data[contentId] ?? {}), [entry.platform]: full };
    await this.save(data);
    return full;
  }

  async get(contentId: string): Promise<Partial<Record<SocialPlatform, SocialStatusEntry>> | undefined> {
    const data = await this.load();
    return data[contentId];
  }
}
