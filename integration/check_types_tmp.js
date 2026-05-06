'use strict';
const odoo = require('./src/clients/odoo.client');
(async () => {
  await odoo.authenticate();
  const products = await odoo.searchRead('product.template',
    [['name', 'in', ['Board Game Monopoly Classic', 'Outdoor Bubble Kit XL', 'Gundam RX-78-2 MG']]],
    ['id', 'name', 'type']);
  console.log(JSON.stringify(products, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
