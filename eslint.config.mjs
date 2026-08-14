import config from '@iobroker/eslint-config';

export default [
  {
    ignores: [
      'build/**',
      'node_modules/**',
    ],
  },
  ...config,
  {
    files: ['src/**/*.{ts,js}', 'test/**/*.js', 'scripts/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'prettier/prettier': 'off',
      'curly': 'off',
      'brace-style': 'off',
      'prefer-template': 'off',
    },
  },
];
