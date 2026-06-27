import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { paths } from '../config.js';
import type { SceneFile } from '../types.js';

/**
 * ⑤動画レンダリング。scene.json を inputProps として渡し MP4 を出力する。
 * 音声は src/remotion/public 配下に置かれた audioFile を staticFile で参照する。
 */
export async function renderShort(
  sceneFile: SceneFile,
  outputLocation: string,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const serveUrl = await bundle({
    entryPoint: paths.remotionEntry,
    publicDir: paths.remotionPublic,
    // ソースは NodeNext 流儀で相対 import に .js を付けている。
    // webpack に .js → .ts/.tsx の解決を教える。
    webpackOverride: (cfg) => ({
      ...cfg,
      resolve: {
        ...cfg.resolve,
        extensionAlias: {
          ...(cfg.resolve?.extensionAlias ?? {}),
          '.js': ['.ts', '.tsx', '.js'],
          '.jsx': ['.tsx', '.jsx'],
        },
      },
    }),
  });

  const inputProps = sceneFile as unknown as Record<string, unknown>;

  const composition = await selectComposition({
    serveUrl,
    id: 'Short',
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps,
    onProgress: onProgress ? ({ progress }) => onProgress(progress) : undefined,
  });

  return outputLocation;
}
