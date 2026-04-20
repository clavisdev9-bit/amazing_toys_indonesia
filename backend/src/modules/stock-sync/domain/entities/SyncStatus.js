'use strict';

/** @enum {string} */
const SYNC_STATUS = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED:  'failed',
  SKIPPED: 'skipped',
});

module.exports = { SYNC_STATUS };
