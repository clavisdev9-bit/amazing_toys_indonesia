export function getStockStatus(stock) {
  if (stock === 0) return { label: 'Habis',         level: 'out'       };
  if (stock <= 3)  return { label: 'Stok Terbatas', level: 'low'       };
  return              { label: 'Tersedia',      level: 'available' };
}

export function getStockBadgeStyle(level) {
  switch (level) {
    case 'out':       return { bg: '#FCEBEB', text: '#A32D2D' };
    case 'low':       return { bg: '#FAEEDA', text: '#633806' };
    case 'available': return { bg: '#E1F5EE', text: '#085041' };
    default:          return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

export function canAddToCart(stock) {
  return stock > 0;
}
