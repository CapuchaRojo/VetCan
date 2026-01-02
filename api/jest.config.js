/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],

  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  clearMocks: true,
  detectOpenHandles: true
};
