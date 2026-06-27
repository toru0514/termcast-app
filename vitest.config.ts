import { defineConfig } from 'vitest/config';

/**
 * ソースは NodeNext 流儀で相対 import に .js を付けている。
 * Vite はそのままだと .ts を解決できないため、.js → .ts/.tsx に橋渡しする。
 */
export default defineConfig({
  plugins: [
    {
      name: 'resolve-js-to-ts',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (importer && source.startsWith('.') && source.endsWith('.js')) {
          for (const ext of ['.ts', '.tsx']) {
            const candidate = source.replace(/\.js$/, ext);
            const resolved = await this.resolve(candidate, importer, { skipSelf: true });
            if (resolved) return resolved;
          }
        }
        return null;
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
