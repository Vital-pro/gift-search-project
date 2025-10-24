// eslint.config.cjs
// [add] Базовый ESLint в "flat" стиле максимально мягкий.
module.exports = [
  {
    files: ['**/*.{js,ts}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-undef': 'error',
      'no-console': 'off',
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
    ignores: ['dist/**', 'telegram-gift-bot-yc/**'],
  },
];
