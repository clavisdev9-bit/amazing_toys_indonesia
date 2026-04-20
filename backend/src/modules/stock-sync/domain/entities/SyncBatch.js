'use strict';

const { SYNC_STATUS } = require('./SyncStatus');

class SyncBatch {
  /**
   * @param {object}   props
   * @param {string}   props.batchId
   * @param {string}   props.triggeredBy
   * @param {Date}     props.triggeredAt
   * @param {object[]} [props.records]
   */
  /**
   * @param {object}                                       props
   * @param {string}                                       props.batchId
   * @param {string}                                       props.triggeredBy
   * @param {Date}                                         props.triggeredAt
   * @param {object[]}                                     [props.records]
   * @param {import('./ETLStep').ETLStep[]}                [props.steps]
   */
  constructor({ batchId, triggeredBy, triggeredAt, records = [], steps = [] }) {
    this.batchId     = batchId;
    this.triggeredBy = triggeredBy;
    this.triggeredAt = triggeredAt;
    this.records     = records;
    this.steps       = steps;
  }

  get total()   { return this.records.length; }
  get success() { return this.records.filter(r => r.status === SYNC_STATUS.SUCCESS).length; }
  get failed()  { return this.records.filter(r => r.status === SYNC_STATUS.FAILED).length;  }
  get skipped() { return this.records.filter(r => r.status === SYNC_STATUS.SKIPPED).length; }
}

module.exports = { SyncBatch };
