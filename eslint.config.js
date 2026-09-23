import js from '@eslint/js';
export default [
    { ignores: ['node_modules/**'] },
    js.configs.recommended,
    { files: ['**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module',
        globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly',
            setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', fetch: 'readonly' } },
      rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] } },
];
