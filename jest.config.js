module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'background.js',
    'popup.js',
    'fullpage.js',
    '!**/tests/**',
    '!**/node_modules/**',
    '!**/designsystem/**'
  ],

  // Coverage thresholds - start at 50%, increase over time
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/designsystem/'
  ],

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Collect coverage from all tests
  collectCoverage: false, // Enable with --coverage flag

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Module paths
  moduleFileExtensions: ['js', 'json'],

  // Timeout for tests (Chrome extension operations can be slow)
  testTimeout: 10000
};
