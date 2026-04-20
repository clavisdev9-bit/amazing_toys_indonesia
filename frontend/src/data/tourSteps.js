// All 16 steps for the SOS customer tour guide.
// Steps with targetSelector: null render as centered modals.
// Steps with navigateTo trigger automatic page navigation before rendering.

export const tourSteps = [
  // 0 — Welcome
  {
    id: 'step-welcome',
    page: 'any',
    targetSelector: null,
    title: 'Selamat Datang di SOS! 👋',
    description: 'Kami akan memandumu mengenal cara memesan barangmu mu di sistem ini. Ikuti langkah-langkah berikut — hanya butuh ~1 menit!',
    position: 'center',
  },

  // 1 — Search bar
  {
    id: 'step-katalog-search',
    page: 'katalog',
    targetSelector: '#tour-search',
    title: 'Cari Produk',
    description: 'Ketik nama produk di sini untuk mencarinya. Hasil pencarian langsung tampil secara otomatis saat kamu mengetik.',
    position: 'bottom',
    spotlightPadding: 8,
  },

  // 2 — Category filter
  {
    id: 'step-katalog-categories',
    page: 'katalog',
    targetSelector: '#tour-categories',
    title: 'Filter Kategori',
    description: 'Gunakan tombol ini untuk menyaring produk berdasarkan kategori. Ketuk salah satu untuk melihat menu dari jenis tersebut.',
    position: 'bottom',
    spotlightPadding: 6,
  },

  // 3 — Product card
  {
    id: 'step-katalog-product',
    page: 'katalog',
    targetSelector: '[data-tour="product-card"]',
    title: 'Kartu Produk',
    description: 'Setiap kartu menampilkan nama, harga, nama stan, dan foto produk. Ketuk gambar atau nama untuk melihat detail lengkap.',
    position: 'bottom',
    spotlightPadding: 8,
  },

  // 4 — Add-to-cart button
  {
    id: 'step-katalog-add-cart',
    page: 'katalog',
    targetSelector: '[data-tour="add-to-cart"]',
    title: 'Tambah ke Keranjang',
    description: 'Ketuk tombol ini untuk menambahkan produk ke keranjang belanjamu. Tombol berubah hijau sebagai tanda berhasil ditambahkan.',
    position: 'top',
    spotlightPadding: 6,
  },

  // 5 — Cart icon in bottom nav
  {
    id: 'step-katalog-cart-icon',
    page: 'katalog',
    targetSelector: '#tour-cart-nav',
    title: 'Ikon Keranjang',
    description: 'Angka merah ini menunjukkan jumlah item di keranjangmu. Ketuk ikon ini untuk melihat dan mengelola pesananmu.',
    position: 'top',
    spotlightPadding: 10,
  },

  // 6 — Navigate to /keranjang (center intro)
  {
    id: 'step-keranjang-intro',
    page: 'keranjang',
    targetSelector: null,
    title: 'Halaman Keranjang',
    description: 'Ini adalah halaman keranjang belanjamu. Di sini kamu bisa meninjau semua produk yang sudah dipilih sebelum melakukan checkout.',
    position: 'center',
    navigateTo: '/keranjang',
  },

  // 7 — Cart item list
  {
    id: 'step-keranjang-items',
    page: 'keranjang',
    targetSelector: '#tour-cart-items',
    title: 'Daftar Item Pesanan',
    description: 'Semua produk yang kamu pilih ditampilkan di sini. Kamu bisa tambah, kurangi jumlah, atau hapus item yang tidak diinginkan.',
    position: 'bottom',
    spotlightPadding: 8,
    waitForSelector: '#tour-cart-items',
  },

  // 8 — Order total
  {
    id: 'step-keranjang-total',
    page: 'keranjang',
    targetSelector: '#tour-cart-total',
    title: 'Total Pembayaran',
    description: 'Total biaya pesananmu ditampilkan di sini. Periksa kembali semua item sebelum melanjutkan ke tahap pembayaran.',
    position: 'top',
    spotlightPadding: 8,
  },

  // 9 — Checkout button
  {
    id: 'step-keranjang-checkout',
    page: 'keranjang',
    targetSelector: '#tour-checkout-btn',
    title: 'Buat Pesanan',
    description: 'Ketuk tombol ini untuk membuat pesanan dan menghasilkan QR Code pembayaran. Pesanan berlaku selama 30 menit.',
    position: 'top',
    spotlightPadding: 8,
  },

  // 10 — Navigate to /pesanan (center intro)
  {
    id: 'step-pesanan-intro',
    page: 'pesanan',
    targetSelector: null,
    title: 'Riwayat Pesanan',
    description: 'Setelah checkout, pesananmu muncul di halaman ini. Kamu bisa memantau status pembayaran dan pengambilan makanan di sini.',
    position: 'center',
    navigateTo: '/pesanan',
  },

  // 11 — Order list
  {
    id: 'step-pesanan-list',
    page: 'pesanan',
    targetSelector: '#tour-order-list',
    title: 'Daftar Transaksi',
    description: 'Setiap kartu mewakili satu transaksi. Ketuk kartu untuk melihat detail pesanan termasuk QR Code dan status terkini.',
    position: 'bottom',
    spotlightPadding: 8,
    waitForSelector: '#tour-order-list',
  },

  // 12 — QR code explanation
  {
    id: 'step-pesanan-qr',
    page: 'pesanan',
    targetSelector: null,
    title: 'QR Code Pembayaran',
    description: 'Setelah checkout, kamu mendapat QR Code unik. Tunjukkan kepada kasir — mereka akan memindainya untuk memproses pembayaran.',
    position: 'center',
  },

  // 13 — Status badge explanation
  {
    id: 'step-pesanan-status',
    page: 'pesanan',
    targetSelector: null,
    title: 'Status Pesanan Real-Time',
    description: 'Status pesananmu diperbarui otomatis: PENDING (menunggu bayar) → PAID (sudah dibayar) → DONE (selesai). Update dikirim via koneksi real-time.',
    position: 'center',
  },

  // 14 — Receipt & pickup explanation
  {
    id: 'step-pesanan-receipt',
    page: 'pesanan',
    targetSelector: null,
    title: 'Struk & Status Ambil',
    description: 'Setelah pembayaran dikonfirmasi, struk digital tersedia di detail pesanan. Pantau juga status persiapan makanan di setiap stan secara langsung.',
    position: 'center',
  },

  // 15 — Finish
  {
    id: 'step-finish',
    page: 'any',
    targetSelector: null,
    title: 'Siap Memesan! 🎉',
    description: 'Kamu sudah menguasai cara memesan di SOS! Jelajahi katalog, tambah ke keranjang, dan nikmati makananmu. Selamat makan!',
    position: 'center',
  },
];
