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

// eslint.config.cjs

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 'latest', // Поддерживаем последнюю версию ES
    sourceType: 'module', // Используем модули
    project: './tsconfig.json' // Для поддержки TypeScript, укажите путь к вашему файлу tsconfig.json
  },
  env: {
    browser: true, // Браузерная среда
    es6: true,     // Включаем поддержку ES6+
    node: true      // Серверная среда Node.js
  },
  extends: [
    'eslint:recommended',          // Базовые правила ESLint
    'plugin:@typescript-eslint/recommended', // Рекомендации для TypeScript
    'prettier'                     // Интеграция Prettier для стилизации кода
  ],
  plugins: ['@typescript-eslint'], // Подключаем plugin для TypeScript
  rules: {                         // Настраиваемые правила
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  },
  overrides: [{
    files: ["*.html"],            // Проверяем HTML-файлы
    processor: "@typescript-eslint/processor/html",
    parserOptions: {
      extraFileExtensions: [".html"]
    }
  },{
    files: ["*.css"],              // Проверяем CSS-файлы
    processor: "@typescript-eslint/processor/css",
    parserOptions: {
      extraFileExtensions: [".css"]
    }
  }]
};

