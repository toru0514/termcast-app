import { Config } from '@remotion/cli/config';

// `npm run remotion:studio` 用。プログラム的レンダリング(render.ts)と同じく
// .js → .ts/.tsx の解決を webpack に教える。
Config.overrideWebpackConfig((cfg) => ({
  ...cfg,
  resolve: {
    ...cfg.resolve,
    extensionAlias: {
      ...(cfg.resolve?.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    },
  },
}));
