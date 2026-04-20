'use strict';

const { IProductRepository } = require('../../domain/repositories/IProductRepository');
const { Product }             = require('../../domain/entities/Product');

/** @implements {IProductRepository} */
class ProductRepository extends IProductRepository {
  /** @param {{ query: Function }} db */
  constructor(db) {
    super();
    this._db = db;
  }

  /** @override */
  async findAllActive() {
    const result = await this._db.query(`
      SELECT p.product_id, p.product_name, p.stock_quantity, p.barcode, p.odoo_categ_id,
             x.odoo_id AS odoo_product_id
      FROM   products p
      LEFT JOIN integration_xref x
            ON  x.entity_type = 'product'
            AND x.sos_id      = p.product_id
            AND x.status      = 'ACTIVE'
      WHERE  p.is_active = TRUE
      ORDER  BY p.product_id
    `);
    return result.rows.map(r => this._toEntity(r));
  }

  /** @override */
  async findById(productId) {
    const result = await this._db.query(`
      SELECT p.product_id, p.product_name, p.stock_quantity, p.barcode, p.odoo_categ_id,
             x.odoo_id AS odoo_product_id
      FROM   products p
      LEFT JOIN integration_xref x
            ON  x.entity_type = 'product'
            AND x.sos_id      = p.product_id
            AND x.status      = 'ACTIVE'
      WHERE  p.product_id = $1
    `, [productId]);
    return result.rows[0] ? this._toEntity(result.rows[0]) : null;
  }

  /** @private */
  _toEntity(r) {
    return new Product({
      productId:     r.product_id,
      productName:   r.product_name,
      stockQuantity: r.stock_quantity,
      barcode:       r.barcode,
      odooCategId:   r.odoo_categ_id,
      odooProductId: r.odoo_product_id ? Number(r.odoo_product_id) : null,
    });
  }
}

module.exports = { ProductRepository };
