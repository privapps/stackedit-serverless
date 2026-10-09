import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const rawLoaderPrefix = '\0raw-loader:';
const rawContentPattern = /\.(html|md|yml)$/;

const rawContent = {
  name: 'raw-content',
  enforce: 'pre',
  async resolveId(source, importer) {
    if (!source.startsWith('!raw-loader!')) {
      return null;
    }
    const resolved = await this.resolve(source.slice('!raw-loader!'.length), importer, {
      skipSelf: true,
    });
    return resolved && `${rawLoaderPrefix}${resolved.id}`;
  },
  load(id) {
    if (id.startsWith(rawLoaderPrefix)) {
      return `export default ${JSON.stringify(fs.readFileSync(id.slice(rawLoaderPrefix.length), 'utf8'))};`;
    }
    if (rawContentPattern.test(id.split('?')[0])) {
      return `export default ${JSON.stringify(fs.readFileSync(id.split('?')[0], 'utf8'))};`;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [
    rawContent,
    vue({
      template: {
        compilerOptions: {
          compatConfig: { MODE: 2 },
        },
      },
    }),
  ],
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    alias: [
      { find: /^vue$/, replacement: '@vue/compat' },
      { find: '@', replacement: path.resolve(rootDir, 'src') },
    ],
  },
  define: {
    NODE_ENV: JSON.stringify('production'),
    VERSION: JSON.stringify(packageJson.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    setupFiles: ['./test/unit/setup.js'],
    restoreMocks: true,
  },
});
