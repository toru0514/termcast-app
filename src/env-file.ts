import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { paths } from './config.js';

const DEFAULT_ENV_PATH = resolve(paths.root, '.env');

/**
 * .env の該当キーを上書き（無ければ追記）する upsert。
 * OAuth トークンのように「取得したら保存」「ローテーションされたら更新」する値を
 * 一箇所で扱うためのユーティリティ（tiktok:auth と実行時の自動リフレッシュで共用）。
 *
 * 純粋な文字列変換部分は updateEnvContent に分離してテスト可能にしている。
 */
export function updateEnv(vars: Record<string, string>, envPath: string = DEFAULT_ENV_PATH): void {
  let current = '';
  try {
    current = readFileSync(envPath, 'utf8');
  } catch {
    /* 無ければ新規作成 */
  }
  writeFileSync(envPath, updateEnvContent(current, vars));
}

/** 既存の .env 文字列に対しキーを upsert して新しい内容を返す（副作用なし）。 */
export function updateEnvContent(current: string, vars: Record<string, string>): string {
  let out = current;
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
    if (re.test(out)) {
      out = out.replace(re, line);
    } else {
      out += (out === '' || out.endsWith('\n') ? '' : '\n') + line + '\n';
    }
  }
  if (out && !out.endsWith('\n')) out += '\n';
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
