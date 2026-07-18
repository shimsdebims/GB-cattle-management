module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['routes/**/*.js', 'middleware/**/*.js', 'models/**/*.js'],
  testTimeout: 10000,
};
