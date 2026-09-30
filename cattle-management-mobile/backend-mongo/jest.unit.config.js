// Tests that need no database: run anywhere with `npm run test:unit`.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  testTimeout: 10000,
};
