export function groupByTenant(items = []) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.tenant_id)) {
      map.set(item.tenant_id, {
        tenant_id: item.tenant_id,
        tenant_name: item.tenant_name,
        booth_location: item.booth_location,
        items: [],
      });
    }
    map.get(item.tenant_id).items.push(item);
  }
  return Array.from(map.values());
}
