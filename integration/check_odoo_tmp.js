'use strict';
const odoo = require('./src/clients/odoo.client');

(async () => {
  await odoo.authenticate();
  
  const variants3052 = await odoo.searchRead('product.product', [['product_tmpl_id', '=', 3052]], ['id', 'name', 'barcode']);
  console.log('product.product for tmpl 3052:', JSON.stringify(variants3052));

  const tmpl3052 = await odoo.searchRead('product.template', [['id', '=', 3052]], ['id', 'name', 'barcode']);
  console.log('product.template 3052:', JSON.stringify(tmpl3052));

  const byName = await odoo.searchRead('product.product', [['name', 'ilike', 'Barang berharga']], ['id', 'name', 'barcode', 'product_tmpl_id']);
  console.log('By name "Barang berharga":', JSON.stringify(byName));

  // Check total product.product count
  const count = await odoo.searchRead('product.product', [], ['id'], 0, 1);
  console.log('Total product.product (sample):', count.length ? count[0].id : 'none');

  process.exit(0);
})().catch(e => { console.error(e.message, e.stack); process.exit(1); });

// Check product types for the failing products
const byName2 = await odoo.searchRead('product.template', 
  [['name', 'in', ['Board Game Monopoly Classic', 'Outdoor Bubble Kit XL', 'Gundam RX-78-2 MG']]], 
  ['id', 'name', 'type', 'detailed_type', 'is_storable']);
console.log('Product types:', JSON.stringify(byName2, null, 2));
