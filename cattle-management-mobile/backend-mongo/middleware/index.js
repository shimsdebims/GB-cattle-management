/**
 * Central export for all middleware and route helpers.
 * Routes should import from here, not from the individual files.
 */

module.exports = {
  ...require('./validation'),
  ...require('./responses'),
};
