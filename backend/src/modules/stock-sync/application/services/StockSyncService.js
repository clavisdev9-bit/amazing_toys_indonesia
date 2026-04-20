'use strict';

const { query, withTransaction }   = require('../../../../config/database');
const { SyncStockToOdooUseCase }   = require('../../domain/use_cases/SyncStockToOdooUseCase');
const { GetSyncHistoryUseCase }    = require('../../domain/use_cases/GetSyncHistoryUseCase');
const { OdooHttpClient }           = require('../../infrastructure/http/OdooHttpClient');
const { OdooProductAdapter }       = require('../../infrastructure/odoo/OdooProductAdapter');
const { OdooStockAdapter }         = require('../../infrastructure/odoo/OdooStockAdapter');
const { OdooChatterAdapter }       = require('../../infrastructure/odoo/OdooChatterAdapter');
const { OdooProductRepository }    = require('../../infrastructure/odoo/OdooProductRepository');
const { StockSyncRepository }      = require('../../infrastructure/persistence/StockSyncRepository');
const { ProductRepository }        = require('../../infrastructure/persistence/ProductRepository');
const { SyncResultDTO }            = require('../dtos/SyncResultDTO');

const db = { query, withTransaction };

class StockSyncService {
  async _loadOdooConfig() {
    const result = await db.query(
      "SELECT value FROM system_settings WHERE key = 'integration_config'"
    );
    const cfg      = result.rows[0]?.value ? JSON.parse(result.rows[0].value) : {};
    const baseUrl  = cfg.odoo_base_url || process.env.ODOO_URL;
    const database = cfg.odoo_db       || process.env.ODOO_DB;
    const login    = cfg.odoo_login    || process.env.ODOO_LOGIN;
    const password = cfg.odoo_password || process.env.ODOO_PASSWORD;

    if (!baseUrl || !database || !login || !password) {
      throw Object.assign(
        new Error('Odoo credentials not configured. Set via Admin → Integrasi.'),
        { statusCode: 502 }
      );
    }
    return { baseUrl, db: database, login, password };
  }

  /**
   * @param {object}        request
   * @param {string}        request.triggeredBy
   * @param {string[]|null} [request.productIds]
   * @returns {Promise<SyncResultDTO>}
   */
  async syncStock({ triggeredBy, productIds = null }) {
    const config          = await this._loadOdooConfig();
    const httpClient      = new OdooHttpClient(config);
    const productAdapter  = new OdooProductAdapter(httpClient);
    const stockAdapter    = new OdooStockAdapter(httpClient);
    const chatterAdapter  = new OdooChatterAdapter(httpClient);

    // All Odoo writes flow through OdooProductRepository (single entry point).
    const odooProductRepo = new OdooProductRepository({
      httpClient,
      productAdapter,
      stockAdapter,
      chatterAdapter,
    });

    const syncRepo    = new StockSyncRepository(db);
    const productRepo = new ProductRepository(db);

    const useCase = new SyncStockToOdooUseCase({
      productRepo,
      odooProductRepo,
      syncRepo,
    });

    const result = await useCase.execute({ triggeredBy, productIds });
    if (result.isFailure) throw result.error;
    return SyncResultDTO.fromBatch(result.value);
  }

  /**
   * @param {object} opts
   * @param {string} [opts.productId]
   * @param {number} [opts.limit]
   * @param {number} [opts.offset]
   * @returns {Promise<{records, total}>}
   */
  async getSyncHistory({ productId, limit = 50, offset = 0 } = {}) {
    const syncRepo = new StockSyncRepository(db);
    const useCase  = new GetSyncHistoryUseCase(syncRepo);
    const result   = await useCase.execute({ productId, limit, offset });
    if (result.isFailure) throw result.error;
    return result.value;
  }
}

module.exports = { StockSyncService };
