const js = require('@eslint/js');
const globals = require('globals');
const { importX } = require('eslint-plugin-import-x');
const pluginVue = require('eslint-plugin-vue');

module.exports = [
  {
    // Files that were never linted under the previous eslintrc/eslintignore
    // setup. Preserved as-is to avoid introducing unrelated lint churn.
    ignores: [
      'dist/**',
      'build/**',
      'config/**',
      'src/libs/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/vue2-recommended'],
  importX.flatConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // webpack's module wrapper provides CJS semantics (module/exports/require)
        // in every bundled file regardless of target, and a few vendored files
        // (e.g. markdown-it plugins) use that syntax directly.
        ...globals.commonjs,
        NODE_ENV: false,
        VERSION: false,
      },
    },
    settings: {
      'import-x/resolver': {
        node: {
          extensions: ['.js', '.vue', '.json'],
        },
      },
    },
    rules: {
      'no-param-reassign': ['error', { props: false }],
      // The bundler aliases Vue to @vue/compat; the package's export map
      // confuses import-x's default-export check for these valid imports.
      'import-x/default': 'off',
      // don't require .vue/.js extension when importing
      'import-x/extensions': ['error', 'always', {
        js: 'never',
        vue: 'never',
      }],
      // These ESLint 10 rules flag legacy patterns unrelated to this upgrade.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      // allow debugger during development only
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      // matches the codebase's long-standing "catch (e) { /* ignored */ }"
      // pattern used throughout for best-effort/fallback error handling
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    // Vue-specific rules below flag genuine pre-existing application-logic
    // patterns (not introduced by the build-tooling migration and out of its
    // scope). Keep them visible as warnings rather than erroring the build;
    // candidates for cleanup in later phases (e.g. the Vue 3 migration).
    rules: {
      'vue/no-side-effects-in-computed-properties': 'warn',
      'vue/no-arrow-functions-in-watch': 'warn',
      'vue/no-use-v-if-with-v-for': 'warn',
      'vue/valid-next-tick': 'warn',
      'vue/no-unused-components': 'warn',
    },
  },
  {
    // This codebase consistently uses single-word names for its top-level
    // components (Editor, Explorer, Layout, Modal, Preview, Toc, Tour, etc.)
    // and icons (Table, Undo, ...). None collide with reserved/native HTML
    // element names, so the multi-word convention this rule enforces doesn't
    // apply here; renaming would be pure, risky, cross-file churn.
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
];
