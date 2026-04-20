'use strict';

const { v4: uuidv4 }     = require('uuid');
const { SYNC_STATUS }     = require('../entities/SyncStatus');
const { ELIGIBILITY }     = require('../entities/EligibilityResult');
const { StockSyncRecord } = require('../entities/StockSyncRecord');
const { SyncBatch }       = require('../entities/SyncBatch');
const { ETLStep }         = require('../entities/ETLStep');
const { Result }          = require('../value_objects/Result');
const { ValidationError } = require('../errors/errors');
const logger             = require('../../../../config/logger');

// Emit a structured trace line for a specific product during sync.
// Format: [SYNC-TRACE][CP-{n}] PASS|FAIL|SKIP | {detail}
function _trace(cp, status, detail) {
  logger.info(`[SYNC-TRACE][CP-${cp}] ${status} | ${detail}`);
}

/**
 * ETL use case: full-refresh stock sync from SOS → Odoo.
 *
 * Six steps per batch run:
 *   1. EXTRACT   — load all active products from SOS DB
 *   2. TRANSFORM — map each to a StockSyncRecord (PENDING)
 *   3. TRUNCATE  — remove any stale PENDING records for this batchId (retry safety)
 *   4. INSERT    — for each mapped product:
 *                    a. Enforce product fields in Odoo (type / invoice_policy / is_storable)
 *                    b. Apply absolute inventory adjustment via stock.quant
 *                    c. Confirm qty_available back from Odoo
 *                    d. Post internal chatter note
 *   5. VALIDATE  — confirm every record reached a terminal status (SUCCESS / FAILED / SKIPPED)
 *   6. PERSIST   — atomic bulk-insert all records into stock_sync_log
 *
 * Design principles:
 *  • One failure never aborts the batch (resilience per product).
 *  • DB persist is transactional — either all audit records land or none do.
 *  • Every ETL step is a separate method — independently unit-testable.
 *  • All Odoo field writes go through IOdooProductRepository only.
 */
class SyncStockToOdooUseCase {
  /**
   * @param {object} deps
   * @param {import('../repositories/IProductRepository').IProductRepository}            deps.productRepo
   * @param {import('../repositories/IOdooProductRepository').IOdooProductRepository}    deps.odooProductRepo
   * @param {import('../repositories/IStockSyncRepository').IStockSyncRepository}        deps.syncRepo
   */
  constructor({ productRepo, odooProductRepo, syncRepo }) {
    this._productRepo     = productRepo;
    this._odooProductRepo = odooProductRepo;
    this._syncRepo        = syncRepo;
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  /**
   * @param {object}        request
   * @param {string}        request.triggeredBy
   * @param {string[]|null} [request.productIds]   — null = sync all active products
   * @returns {Promise<Result<SyncBatch>>}
   */
  async execute({ triggeredBy, productIds = null }) {
    if (!triggeredBy) {
      return Result.fail(new ValidationError('triggeredBy is required.', 'triggeredBy'));
    }

    const batchId     = uuidv4();
    const triggeredAt = new Date();
    const steps       = [];

    // ── STEP 1: EXTRACT ──────────────────────────────────────────────────────
    const s1 = new ETLStep('extract');
    let products;
    try {
      products = await this._extract(productIds);
      steps.push(s1.complete(products.length));
    } catch (err) {
      steps.push(s1.fail(err));
      return Result.fail(err);
    }

    // ── STEP 2: TRANSFORM ────────────────────────────────────────────────────
    const s2 = new ETLStep('transform');
    let records;
    try {
      records = this._transform(products, { batchId, triggeredBy, triggeredAt });
      steps.push(s2.complete(records.length));
    } catch (err) {
      steps.push(s2.fail(err));
      return Result.fail(err);
    }

    // ── STEP 3: TRUNCATE (idempotent retry safety) ───────────────────────────
    const s3 = new ETLStep('truncate');
    try {
      await this._truncate(batchId);
      steps.push(s3.complete(0));
    } catch (err) {
      steps.push(s3.fail(err));
      return Result.fail(err);
    }

    // ── STEP 4: INSERT (Odoo writes — best-effort per product) ───────────────
    const s4 = new ETLStep('insert');
    await this._insert(records);
    const insertedCount = records.filter(r => r.isSuccess()).length;
    steps.push(s4.complete(insertedCount));

    // ── STEP 5: VALIDATE (row-count completeness check) ──────────────────────
    const s5 = new ETLStep('validate');
    const { valid, message } = this._validate(records);
    steps.push(s5.complete(valid ? records.length : 0));
    if (!valid) {
      // Non-fatal: log the discrepancy but continue to persist partial results
      console.warn(`[ETL][${batchId}] Validation warning: ${message}`);
    }

    // ── STEP 6: PERSIST (atomic bulk insert) ─────────────────────────────────
    const s6 = new ETLStep('persist');
    try {
      await this._syncRepo.saveAll(records);
      steps.push(s6.complete(records.length));
    } catch (err) {
      steps.push(s6.fail(err));
      return Result.fail(err);
    }

    return Result.ok(new SyncBatch({ batchId, triggeredBy, triggeredAt, records, steps }));
  }

  // ── ETL Steps ──────────────────────────────────────────────────────────────

  /**
   * STEP 1 — Load products from SOS DB.
   *
   * @param {string[]|null} productIds
   * @returns {Promise<import('../entities/Product').Product[]>}
   */
  async _extract(productIds) {
    let products;
    if (productIds?.length) {
      const results = await Promise.all(
        productIds.map(id => this._productRepo.findById(id))
      );
      products = results.filter(Boolean);
    } else {
      products = await this._productRepo.findAllActive();
    }

    // CP-3 — verify the QC test product is present and has the expected qty
    const qcProduct = products.find(p => p.barcode === '8999999005002');
    if (qcProduct) {
      _trace(3, 'PASS',
        `barcode=8999999005002 found: productId=${qcProduct.productId} ` +
        `stock_quantity=${qcProduct.stockQuantity} odooProductId=${qcProduct.odooProductId}`);
    } else {
      _trace(3, 'FAIL',
        'barcode=8999999005002 NOT found in extracted products (inactive or missing from DB)');
    }

    return products;
  }

  /**
   * STEP 2 — Map each SOS Product to a StockSyncRecord with PENDING status.
   * Pure function — no I/O.
   *
   * @param {import('../entities/Product').Product[]} products
   * @param {{ batchId: string, triggeredBy: string, triggeredAt: Date }} meta
   * @returns {StockSyncRecord[]}
   */
  _transform(products, { batchId, triggeredBy, triggeredAt }) {
    return products.map(product => new StockSyncRecord({
      syncId:        uuidv4(),
      batchId,
      triggeredBy,
      triggeredAt,
      productId:     product.productId,
      odooProductId: product.odooProductId,
      qtySent:       product.stockQuantity,
      status:        SYNC_STATUS.PENDING,
    }));
  }

  /**
   * STEP 3 — Delete any PENDING records for this batchId (e.g. from a prior aborted run).
   * No-op on the first run; guards against duplicate rows on retry.
   *
   * @param {string} batchId
   */
  async _truncate(batchId) {
    await this._syncRepo.deletePendingByBatch(batchId);
  }

  /**
   * STEP 4 — Write each product to Odoo. One failure never aborts the loop.
   *
   * Per-product flow:
   *   a. Skip immediately if no odooProductId (UNMAPPED).
   *   b. Enforce type / invoice_policy / is_storable on product.template.
   *   c. Apply absolute inventory adjustment via stock.quant.
   *   d. Confirm qty_available after the adjustment.
   *   e. Post internal chatter note.
   *
   * @param {StockSyncRecord[]} records — mutated in place
   */
  async _insert(records) {
    for (const record of records) {
      const t0 = Date.now();
      try {
        const isQcProduct = record.productId === 'P012-T005';

        if (!record.odooProductId) {
          if (isQcProduct) {
            _trace(5, 'FAIL',
              `P012-T005 has no odooProductId — missing from integration_xref`);
          }
          record.status          = SYNC_STATUS.SKIPPED;
          record.eligibilityRule = ELIGIBILITY.UNMAPPED;
          record.errorCode       = 'UNMAPPED';
          record.errorMessage    = 'No Odoo product mapping found in integration_xref.';
          record.durationMs      = Date.now() - t0;
          continue;
        }

        // CP-5 — Odoo template ID resolved from integration_xref
        if (isQcProduct) {
          _trace(5, 'PASS',
            `P012-T005 odooProductId=${record.odooProductId} (from integration_xref)`);
        }

        // (b) enforce product fields — type=consu, invoice_policy=order, is_storable=true
        await this._odooProductRepo.ensureProductFields(record.odooProductId);

        // CP-4 — product fields enforced in Odoo
        if (isQcProduct) {
          _trace(4, 'PASS',
            `ensureProductFields(${record.odooProductId}) called: ` +
            `type=consu, invoice_policy=order, is_storable=true`);
        }

        // (c) stock.quant → action_apply_inventory
        const { quantId, qtyBefore, locationId } =
          await this._odooProductRepo.applyStockAdjustment(
            record.odooProductId, record.qtySent
          );
        record.odooQuantId = quantId;
        record.locationId  = locationId;
        record.qtyBefore   = qtyBefore;

        // CP-6 and CP-7 are confirmed if we reach here without exception
        if (isQcProduct) {
          _trace(6, 'PASS',
            `stock.quant write inventory_quantity=${record.qtySent} quantId=${quantId} locationId=${locationId}`);
          _trace(7, 'PASS',
            `action_apply_inventory([[${quantId}]]) called — adjustment applied`);
        }

        // (d) confirm
        record.qtyConfirmed = await this._odooProductRepo.readCurrentQty(record.odooProductId);

        // (e) chatter note
        await this._odooProductRepo.postNote(record.odooProductId, {
          batchId:      record.batchId,
          syncId:       record.syncId,
          qtyBefore,
          qtyConfirmed: record.qtyConfirmed,
          triggeredBy:  record.triggeredBy,
          triggeredAt:  record.triggeredAt,
        });

        record.status = SYNC_STATUS.SUCCESS;
      } catch (err) {
        record.status       = SYNC_STATUS.FAILED;
        record.errorCode    = err.code ?? 'SYNC_ERROR';
        record.errorMessage = err.message;
      }

      record.durationMs = Date.now() - t0;
    }
  }

  /**
   * STEP 5 — Confirm every record reached a terminal status (no orphaned PENDING).
   * Row-count equation: total == success + failed + skipped.
   *
   * @param {StockSyncRecord[]} records
   * @returns {{ valid: boolean, message: string }}
   */
  _validate(records) {
    const total   = records.length;
    const success = records.filter(r => r.isSuccess()).length;
    const failed  = records.filter(r => r.isFailed()).length;
    const skipped = records.filter(r => r.isSkipped()).length;
    const pending = records.filter(r => r.status === SYNC_STATUS.PENDING).length;

    if (pending > 0) {
      return {
        valid:   false,
        message: `${pending}/${total} records still in PENDING state after insert step.`,
      };
    }
    if (success + failed + skipped !== total) {
      return {
        valid:   false,
        message: `Row count mismatch: expected ${total}, got ${success + failed + skipped}.`,
      };
    }
    return { valid: true, message: `All ${total} records accounted for.` };
  }
}

module.exports = { SyncStockToOdooUseCase };
