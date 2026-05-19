// TODO: replace PRODUCTS with API call to GET /api/products
export const PRODUCTS = [
  { id: 'p1',  name: 'Barbie Dreamhouse',  price: 450000,  category: 'Doll',     colorHex: '#EEEDFE', storeIds: ['s1', 's3'], stock: 12 },
  { id: 'p2',  name: 'BJD Articulated',    price: 820000,  category: 'Doll',     colorHex: '#FBEAF0', storeIds: ['s5'],       stock: 4  },
  { id: 'p3',  name: 'Plush Bunny XL',     price: 210000,  category: 'Doll',     colorHex: '#E1F5EE', storeIds: ['s1', 's6'], stock: 0  },
  { id: 'p4',  name: 'Fashion Doll Set',   price: 320000,  category: 'Doll',     colorHex: '#FAEEDA', storeIds: ['s3'],       stock: 7  },
  { id: 'p5',  name: 'LEGO City 500pcs',   price: 680000,  category: 'Brick',    colorHex: '#E6F1FB', storeIds: ['s3', 's5'], stock: 15 },
  { id: 'p6',  name: 'Nanoblock Tower',    price: 290000,  category: 'Brick',    colorHex: '#FAEEDA', storeIds: ['s2'],       stock: 0  },
  { id: 'p7',  name: 'Magnetic Tiles 60',  price: 380000,  category: 'Brick',    colorHex: '#E1F5EE', storeIds: ['s1'],       stock: 3  },
  { id: 'p8',  name: 'Technic Expert',     price: 1200000, category: 'Brick',    colorHex: '#EEEDFE', storeIds: ['s5'],       stock: 9  },
  { id: 'p9',  name: 'Molly Series 1',     price: 540000,  category: 'Art toys', colorHex: '#FAECE7', storeIds: ['s7'],       stock: 6  },
  { id: 'p10', name: 'Dunny Blind Box',    price: 180000,  category: 'Art toys', colorHex: '#EEEDFE', storeIds: ['s7', 's5'], stock: 0  },
  { id: 'p11', name: 'Qee Designer',       price: 420000,  category: 'Art toys', colorHex: '#FBEAF0', storeIds: ['s7'],       stock: 2  },
  { id: 'p12', name: 'Gundam MG 1/100',   price: 920000,  category: 'Hobbies',  colorHex: '#E6F1FB', storeIds: ['s5'],       stock: 11 },
  { id: 'p13', name: 'RC Car Drift',       price: 650000,  category: 'Hobbies',  colorHex: '#FAEEDA', storeIds: ['s2', 's3'], stock: 5  },
  { id: 'p14', name: 'Puzzle 1000pcs',     price: 185000,  category: 'Hobbies',  colorHex: '#E1F5EE', storeIds: ['s1'],       stock: 8  },
  { id: 'p15', name: 'Die-cast Mini',      price: 340000,  category: 'Hobbies',  colorHex: '#FAECE7', storeIds: ['s2'],       stock: 0  },
];

// TODO: replace STORES with API call to GET /api/stores
export const STORES = [
  { id: 's1', name: 'ToyWorld LG',   meta: 'Toys & games · North wing',       floor: 'LG', colorHex: '#EEEDFE', textColorHex: '#3C3489', booth: 'ToysWorld',    lokasi: 'Hall A, Stand A1' },
  { id: 's2', name: 'Kiddo UG',      meta: 'Toys & RC · West wing',            floor: 'UG', colorHex: '#FAEEDA', textColorHex: '#633806', booth: 'KiddoStore',   lokasi: 'Hall C, Stand C3' },
  { id: 's3', name: 'KidZone 1F',    meta: 'Kids fashion & toys · Main hall',  floor: '1F', colorHex: '#FBEAF0', textColorHex: '#72243E', booth: 'KidZone',      lokasi: 'Hall B, Stand B2' },
  { id: 's4', name: 'Snack Arcade',  meta: 'Food & beverage · East wing',      floor: 'UG', colorHex: '#E1F5EE', textColorHex: '#085041', booth: 'SnackArcade',  lokasi: 'Hall D, Stand D1' },
  { id: 's5', name: 'Hobby Hub 2F',  meta: 'Scale models & collectibles',      floor: '2F', colorHex: '#E6F1FB', textColorHex: '#0C447C', booth: 'HobbyHub',     lokasi: 'Hall B, Stand B7' },
  { id: 's6', name: 'PlayLab 1F',    meta: 'Interactive play · East',          floor: '1F', colorHex: '#E1F5EE', textColorHex: '#085041', booth: 'PlayLab',      lokasi: 'Hall A, Stand A4' },
  { id: 's7', name: 'ArtToy 3F',     meta: 'Designer toys · South',            floor: '3F', colorHex: '#FAECE7', textColorHex: '#712B13', booth: 'ArtToySpace',  lokasi: 'Hall C, Stand C1' },
  { id: 's8', name: 'Gallery Space', meta: 'Exhibitions · North',              floor: '3F', colorHex: '#F1EFE8', textColorHex: '#444441', booth: 'GallerySpace', lokasi: 'Hall D, Stand D5' },
];

export const CATEGORIES = ['All', 'Doll', 'Brick', 'Art toys', 'Hobbies'];
export const FLOORS     = ['UG', 'LG', '1F', '2F', '3F'];

export const FLOOR_NAMES = {
  UG:  'Underground (UG)',
  LG:  'Lower ground (LG)',
  '1F':'First floor (1F)',
  '2F':'Second floor (2F)',
  '3F':'Third floor (3F)',
};

export const STORE_MAP   = Object.fromEntries(STORES.map(s => [s.id, s]));
export const PRODUCT_MAP = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

export function formatPrice(price) {
  return 'Rp ' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
