'use strict';

/**
 * Input DTO for a stock sync request from the presentation layer.
 */
class SyncRequestDTO {
  /**
   * @param {object}        props
   * @param {string}        props.triggeredBy  — user_id or 'system'
   * @param {string[]|null} props.productIds   — null = sync all active
   */
  constructor({ triggeredBy, productIds = null }) {
    this.triggeredBy = triggeredBy;
    this.productIds  = productIds;
  }
}

module.exports = { SyncRequestDTO };
