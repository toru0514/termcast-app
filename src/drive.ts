import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface DriveUploadResult {
  id: string;
  name: string;
  link: string;
}

/**
 * Google Drive へ動画を保存する。ユーザーの強い希望により MCP ではなく `gws` CLI を使う。
 * 認証は gws 側（keyring）が持つため、folderId だけ分かれば保存できる。
 */
export async function uploadToDrive(
  filePath: string,
  folderId: string,
  name?: string,
): Promise<DriveUploadResult> {
  const args = ['drive', '+upload', filePath, '--parent', folderId, '--format', 'json'];
  if (name) args.push('--name', name);

  const { stdout } = await exec('gws', args, { maxBuffer: 10 * 1024 * 1024 });
  // gws は keyring 情報などを混ぜることがあるため、JSON 部分だけ取り出す
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`gws upload: unexpected output: ${stdout.slice(0, 200)}`);
  }
  const json = JSON.parse(stdout.slice(start, end + 1)) as { id: string; name: string };
  return {
    id: json.id,
    name: json.name,
    link: `https://drive.google.com/file/d/${json.id}/view`,
  };
}
