'use strict';
const odoo = require('./src/clients/odoo.client');
(async () => {
  await odoo.authenticate();
  // Check product routes for Monopoly
  const p = await odoo.searchRead('product.template', [['id', '=', 56]], ['id', 'name', 'type', 'route_ids']);
  console.log('Product:', JSON.stringify(p));
  
  // Check warehouse routes
  const wh = await odoo.searchRead('stock.warehouse', [], ['id', 'name', 'route_ids']);
  console.log('Warehouses:', JSON.stringify(wh));
  
  // Check what routes exist
  const routes = await odoo.searchRead('stock.route', [], ['id', 'name', 'supplied_wh_id'], 0, 20);
  console.log('Routes:', JSON.stringify(routes));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
