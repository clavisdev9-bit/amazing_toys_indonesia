import React, { createContext, useContext, useState } from 'react';

// ── Translation dictionary ────────────────────────────────────────────────────

const T = {
  ID: {
    // Map modal
    mapTitle:  'Lokasi Kami',
    mapEmpty:  'Peta belum dikonfigurasi. Hubungi administrator.',
    mapClose:  'Tutup',

    // Nav (bottom bar)
    'nav.catalog': 'Katalog',
    'nav.cart':    'Keranjang',
    'nav.orders':  'Pesanan',

    // Browse page
    'search.placeholder':    'Cari produk...',
    'filter.all':            'Semua',
    'filter.inStockOnly':    'Stok tersedia saja',
    'filter.productCount':   '{count} produk',
    'product.notFound':      'Produk tidak ditemukan',
    'product.tryOther':      'Coba kata kunci lain',
    'product.added':         '✓ Ditambah',
    'product.addToCart':     '+ Keranjang',
    'product.loadMore':      'Muat lebih banyak',

    // Product detail
    'product.notFoundDetail': 'Produk tidak ditemukan.',
    'back':                   '← Kembali',
    'product.booth':          'Booth',
    'product.location':       'Lokasi',
    'product.stock':          'Stok',
    'product.addedFull':      '✓ Ditambahkan ke Keranjang',
    'product.addToCartFull':  'Tambah ke Keranjang',

    // Cart
    'cart.title':         'Keranjang ({count} item)',
    'cart.empty.title':   'Keranjang kosong',
    'cart.empty.desc':    'Tambahkan produk dari katalog',
    'cart.toCatalog':     'Ke Katalog →',
    'cart.total':         'Total Pembayaran',
    'cart.pendingNote':   'Pesanan akan berlaku selama 30 menit. Segera bayar ke kasir.',
    'cart.checkout':      'Buat Pesanan',
    'cart.checkoutError': 'Checkout gagal. Coba lagi.',

    // Order history
    'orders.title':       'Riwayat Pesanan',
    'orders.empty.title': 'Belum ada pesanan',
    'orders.empty.desc':  'Yuk, mulai belanja di katalog!',
    'orders.toCatalog':   'Ke Katalog →',

    // Order tracking
    'order.notFound':     'Pesanan tidak ditemukan.',
    'order.backHistory':  '← Riwayat Pesanan',
    'order.showQR':       'Tunjukkan QR ini ke kasir',
    'order.cancelBtn':    'Batalkan Pesanan',
    'order.cancelTitle':  'Batalkan Pesanan?',
    'order.cancelBody':   'Pesanan {id} akan dibatalkan dan stok dikembalikan.',
    'order.cancelNo':     'Tidak',
    'order.cancelYes':    'Ya, Batalkan',
    'order.refresh':      'Perbarui',
    'order.refreshing':   'Memperbarui...',

    // Payment confirmed (C7)
    'confirmed.title':         'Pembayaran Berhasil!',
    'confirmed.subtitle':      'Barang Anda sedang disiapkan di booth',
    'confirmed.txnId':         'ID Transaksi',
    'confirmed.totalPaid':     'Total Dibayar',
    'confirmed.payment':       'Metode Bayar',
    'confirmed.datetime':      'Tanggal & Waktu',
    'confirmed.nonReturnable': 'Semua penjualan bersifat final dan tidak dapat dikembalikan.',
    'confirmed.cta':           'Lihat Struk & Slip Pengambilan',
    'confirmed.ctaHint':       'Ambil barang di booth tenant',

    // Receipt & pickup (C8)
    'receipt.sectionReceipt': 'STRUK PEMBAYARAN',
    'receipt.sectionPickup':  'INSTRUKSI PENGAMBILAN',
    'receipt.total':          'Total',
    'receipt.done':           'Selesai ✓',
    'receipt.ready':          'Siap',
    'receipt.cta':            'Lacak Pengambilan Barang',

    // Pickup status (C9)
    'pickup.infoBanner':   'Kunjungi setiap booth dan tunjukkan kode QR Anda. Status diperbarui otomatis.',
    'pickup.done':         'Selesai ✓',
    'pickup.ready':        'Siap',
    'pickup.preparing':    'Menyiapkan',
    'pickup.collected':    'Sudah Diambil',
    'pickup.items':        'barang',
    'pickup.allDone':      'Semua barang sudah diambil! 🎉',
    'pickup.showBarcode':  'Tampilkan Barcode Transaksi',
    'pickup.modalTitle':   'Barcode Transaksi',

    // Checkout success
    'checkout.created':  'Pesanan Dibuat!',
    'checkout.showQR':   'Tunjukkan kode QR ini ke kasir untuk pembayaran',
    'checkout.qrMissing':'QR Code tidak tersedia',
    'checkout.txnId':    'ID Transaksi',
    'checkout.total':    'Total',
    'checkout.payIn':    '⏰ Bayar dalam {mins}:{secs} menit',
    'checkout.expired':  '⚠️ Pesanan telah kadaluarsa',
    'checkout.track':    'Lacak Pesanan',
    'checkout.continue': 'Lanjut Belanja',

    // Login
    'login.title':        'Masuk',
    'login.subtitle':     'Amazing Toys Fair 2026',
    'login.phone':        'Nomor Telepon',
    'login.phonePh':      '08xxxxxxxxxx',
    'login.submit':       'Masuk',
    'login.noAccount':    'Belum punya akun?',
    'login.register':     'Daftar',
    'login.staffLink':    'Login sebagai Staff →',
    'login.error':        'Login gagal. Coba lagi.',

    // Register
    'register.title':     'Daftar Akun Baru',
    'register.subtitle':  'Amazing Toys Fair 2026',
    'register.name':      'Nama Lengkap',
    'register.namePh':    'Masukkan nama lengkap',
    'register.phone':     'Nomor Telepon',
    'register.phonePh':   '08xxxxxxxxxx',
    'register.email':     'Email (opsional)',
    'register.emailPh':   'email@contoh.com',
    'register.gender':    'Jenis Kelamin',
    'register.male':      'Laki-laki',
    'register.female':    'Perempuan',
    'register.other':     'Tidak disebutkan',
    'register.submit':    'Daftar Sekarang',
    'register.hasAccount':'Sudah punya akun?',
    'register.login':     'Masuk',
    'register.error':     'Pendaftaran gagal. Coba lagi.',

    // Badge status labels
    'badge.PENDING':      'Menunggu',
    'badge.PAID':         'Dibayar',
    'badge.DONE':         'Selesai',
    'badge.CANCELLED':    'Dibatalkan',
    'badge.EXPIRED':      'Kadaluarsa',
    'badge.AVAILABLE':    'Tersedia',
    'badge.LOW_STOCK':    'Stok Terbatas',
    'badge.OUT_OF_STOCK': 'Habis',
    'badge.APPROVED':     'Disetujui',
    'badge.REJECTED':     'Ditolak',
    'badge.READY':        'Siap',
    'badge.PREPARING':    'Menyiapkan',

    // Tenant — order queue
    'tenantOrders.title':       'Antrian Pesanan',
    'tenantOrders.refresh':     'Refresh',
    'tenantOrders.empty.title': 'Belum ada pesanan',
    'tenantOrders.empty.desc':  'Pesanan yang sudah dibayar akan muncul di sini',
    'tenantOrders.waiting':     'Menunggu Serah Terima ({count})',
    'tenantOrders.done':        'Selesai ({count})',
    'tenantOrders.handover':    'Serah Terima ✓',
    'tenantOrders.newOrder':    'Pesanan baru masuk: {id}',
    'tenantOrders.handoverOk':  'Serah terima berhasil!',
    'tenantOrders.handoverErr': 'Gagal serah terima',

    // Tenant — dashboard
    'tenantDash.title':       'Dashboard Tenant',
    'tenantDash.revenue':     'Pendapatan Hari Ini',
    'tenantDash.orders':      'Total Pesanan',
    'tenantDash.done':        'Selesai',
    'tenantDash.pending':     'Menunggu',
    'tenantDash.topProducts': 'Produk Terlaris',
    'tenantDash.sold':        '{n} terjual',

    // Tenant — daily report
    'laporan.title':        'Laporan Harian',
    'laporan.from':         'Dari',
    'laporan.to':           'Sampai',
    'laporan.show':         'Tampilkan',
    'laporan.dateError':    "Tanggal 'Dari' tidak boleh melebihi 'Sampai'.",
    'laporan.sectionA':     'Detail Penjualan per Produk',
    'laporan.sectionB':     'Penjualan Harian',
    'laporan.tenant':       'Tenant: {name}',
    'laporan.noData':       'Tidak ada data untuk periode yang dipilih.',
    'laporan.col.no':       'No',
    'laporan.col.product':  'Nama Produk',
    'laporan.col.category': 'Kategori',
    'laporan.col.qtySold':  'Terjual',
    'laporan.col.price':    'Harga (IDR)',
    'laporan.col.total':    'Total (IDR)',
    'laporan.col.date':     'Tanggal',
    'laporan.col.txnCount': 'Total Transaksi',
    'laporan.col.revenue':  'Pendapatan (IDR)',

    // Tenant — stock report
    'stock.title':        'Laporan Stok Terakhir',
    'stock.search':       'Cari produk / ID / barcode...',
    'stock.showInactive': 'Tampilkan nonaktif',
    'stock.updatedAt':    'Diperbarui pukul',
    'stock.empty':        'Tidak ada produk ditemukan.',
    'stock.col.name':     'Nama',
    'stock.col.category': 'Kategori',
    'stock.col.price':    'Harga',
    'stock.col.status':   'Status',
    'stock.col.stock':    'Stok',
    'stock.col.photo':    'Foto',

    // Cashier — payment
    'cashier.title':      'Proses Pembayaran',
    'cashier.search':     'Cari Transaksi',
    'cashier.searchBtn':  'Cari',
    'cashier.recent':     'Transaksi Terakhir',
    'cashier.err409':     'Transaksi sudah dibayar.',
    'cashier.err410':     'Transaksi telah kadaluarsa.',
    'cashier.err404':     'Transaksi tidak ditemukan.',
    'cashier.errDefault': 'Gagal mencari transaksi.',

    // Cashier — recap
    'recap.title':      'Rekap Harian',
    'recap.txnCount':   'Total Transaksi',
    'recap.grandTotal': 'Grand Total',
    'recap.cash':       'Tunai (CASH)',
    'recap.qris':       'QRIS',
    'recap.edc':        'EDC',
    'recap.transfer':   'Transfer',
    'recap.txnList':    'Daftar Transaksi ({count})',
  },

  EN: {
    mapTitle:  'Our Location',
    mapEmpty:  'Map has not been configured yet. Contact the administrator.',
    mapClose:  'Close',

    'nav.catalog': 'Catalog',
    'nav.cart':    'Cart',
    'nav.orders':  'Orders',

    'search.placeholder':    'Search products...',
    'filter.all':            'All',
    'filter.inStockOnly':    'In stock only',
    'filter.productCount':   '{count} products',
    'product.notFound':      'No products found',
    'product.tryOther':      'Try different keywords',
    'product.added':         '✓ Added',
    'product.addToCart':     '+ Cart',
    'product.loadMore':      'Load more',

    'product.notFoundDetail': 'Product not found.',
    'back':                   '← Back',
    'product.booth':          'Booth',
    'product.location':       'Location',
    'product.stock':          'Stock',
    'product.addedFull':      '✓ Added to Cart',
    'product.addToCartFull':  'Add to Cart',

    'cart.title':         'Cart ({count} item)',
    'cart.empty.title':   'Cart is empty',
    'cart.empty.desc':    'Add products from the catalog',
    'cart.toCatalog':     'To Catalog →',
    'cart.total':         'Total Payment',
    'cart.pendingNote':   'Order valid for 30 minutes. Please pay at the cashier.',
    'cart.checkout':      'Place Order',
    'cart.checkoutError': 'Checkout failed. Please try again.',

    'orders.title':       'Order History',
    'orders.empty.title': 'No orders yet',
    'orders.empty.desc':  'Start shopping in the catalog!',
    'orders.toCatalog':   'To Catalog →',

    'order.notFound':     'Order not found.',
    'order.backHistory':  '← Order History',
    'order.showQR':       'Show this QR code to the cashier',
    'order.cancelBtn':    'Cancel Order',
    'order.cancelTitle':  'Cancel Order?',
    'order.cancelBody':   'Order {id} will be cancelled and stock restored.',
    'order.cancelNo':     'No',
    'order.cancelYes':    'Yes, Cancel',
    'order.refresh':      'Refresh',
    'order.refreshing':   'Refreshing...',

    // Payment confirmed (C7)
    'confirmed.title':         'Payment Successful!',
    'confirmed.subtitle':      'Your items are being prepared at the booths',
    'confirmed.txnId':         'Transaction ID',
    'confirmed.totalPaid':     'Total Paid',
    'confirmed.payment':       'Payment',
    'confirmed.datetime':      'Date & Time',
    'confirmed.nonReturnable': 'All sales are final and non-returnable.',
    'confirmed.cta':           'View Receipt & Pickup Slip',
    'confirmed.ctaHint':       'Collect items at tenant booths',

    // Receipt & pickup (C8)
    'receipt.sectionReceipt': 'PAYMENT RECEIPT',
    'receipt.sectionPickup':  'PICKUP INSTRUCTIONS',
    'receipt.total':          'Total',
    'receipt.done':           'Done ✓',
    'receipt.ready':          'Ready',
    'receipt.cta':            'Track Item Pickup',

    // Pickup status (C9)
    'pickup.infoBanner':   'Visit each booth and show your QR code. Items update automatically.',
    'pickup.done':         'Done ✓',
    'pickup.ready':        'Ready',
    'pickup.preparing':    'Preparing',
    'pickup.collected':    'Collected',
    'pickup.items':        'items',
    'pickup.allDone':      'All items collected! 🎉',
    'pickup.showBarcode':  'Show Transaction Barcode',
    'pickup.modalTitle':   'Transaction Barcode',

    'checkout.created':  'Order Created!',
    'checkout.showQR':   'Show this QR code to the cashier for payment',
    'checkout.qrMissing':'QR Code unavailable',
    'checkout.txnId':    'Transaction ID',
    'checkout.total':    'Total',
    'checkout.payIn':    '⏰ Pay in {mins}:{secs} minutes',
    'checkout.expired':  '⚠️ Order has expired',
    'checkout.track':    'Track Order',
    'checkout.continue': 'Continue Shopping',

    'login.title':        'Login',
    'login.subtitle':     'Amazing Toys Fair 2026',
    'login.phone':        'Phone Number',
    'login.phonePh':      '08xxxxxxxxxx',
    'login.submit':       'Login',
    'login.noAccount':    "Don't have an account?",
    'login.register':     'Register',
    'login.staffLink':    'Login as Staff →',
    'login.error':        'Login failed. Please try again.',

    'register.title':     'Create New Account',
    'register.subtitle':  'Amazing Toys Fair 2026',
    'register.name':      'Full Name',
    'register.namePh':    'Enter full name',
    'register.phone':     'Phone Number',
    'register.phonePh':   '08xxxxxxxxxx',
    'register.email':     'Email (optional)',
    'register.emailPh':   'email@example.com',
    'register.gender':    'Gender',
    'register.male':      'Male',
    'register.female':    'Female',
    'register.other':     'Prefer not to say',
    'register.submit':    'Register Now',
    'register.hasAccount':'Already have an account?',
    'register.login':     'Login',
    'register.error':     'Registration failed. Please try again.',

    'badge.PENDING':      'Pending',
    'badge.PAID':         'Paid',
    'badge.DONE':         'Done',
    'badge.CANCELLED':    'Cancelled',
    'badge.EXPIRED':      'Expired',
    'badge.AVAILABLE':    'Available',
    'badge.LOW_STOCK':    'Limited Stock',
    'badge.OUT_OF_STOCK': 'Out of Stock',
    'badge.APPROVED':     'Approved',
    'badge.REJECTED':     'Rejected',
    'badge.READY':        'Ready',
    'badge.PREPARING':    'Preparing',

    // Tenant — order queue
    'tenantOrders.title':       'Order Queue',
    'tenantOrders.refresh':     'Refresh',
    'tenantOrders.empty.title': 'No orders yet',
    'tenantOrders.empty.desc':  'Paid orders will appear here',
    'tenantOrders.waiting':     'Awaiting Handover ({count})',
    'tenantOrders.done':        'Done ({count})',
    'tenantOrders.handover':    'Hand Over ✓',
    'tenantOrders.newOrder':    'New order received: {id}',
    'tenantOrders.handoverOk':  'Handover successful!',
    'tenantOrders.handoverErr': 'Handover failed',

    // Tenant — dashboard
    'tenantDash.title':       'Tenant Dashboard',
    'tenantDash.revenue':     "Today's Revenue",
    'tenantDash.orders':      'Total Orders',
    'tenantDash.done':        'Done',
    'tenantDash.pending':     'Pending',
    'tenantDash.topProducts': 'Top Products',
    'tenantDash.sold':        '{n} sold',

    // Tenant — daily report
    'laporan.title':        'Daily Report',
    'laporan.from':         'From',
    'laporan.to':           'To',
    'laporan.show':         'Show',
    'laporan.dateError':    "'From' date cannot be later than 'To' date.",
    'laporan.sectionA':     'Sales Detail by Product',
    'laporan.sectionB':     'Daily Sales',
    'laporan.tenant':       'Tenant: {name}',
    'laporan.noData':       'No data for the selected period.',
    'laporan.col.no':       'No',
    'laporan.col.product':  'Product Name',
    'laporan.col.category': 'Category',
    'laporan.col.qtySold':  'Qty Sold',
    'laporan.col.price':    'Price (IDR)',
    'laporan.col.total':    'Total (IDR)',
    'laporan.col.date':     'Date',
    'laporan.col.txnCount': 'Transactions',
    'laporan.col.revenue':  'Revenue (IDR)',

    // Tenant — stock report
    'stock.title':        'Last Stock Update Report',
    'stock.search':       'Search product / ID / barcode...',
    'stock.showInactive': 'Show inactive',
    'stock.updatedAt':    'Updated at',
    'stock.empty':        'No products found.',
    'stock.col.name':     'Name',
    'stock.col.category': 'Category',
    'stock.col.price':    'Price',
    'stock.col.status':   'Status',
    'stock.col.stock':    'Stock',
    'stock.col.photo':    'Photo',

    // Cashier — payment
    'cashier.title':      'Process Payment',
    'cashier.search':     'Find Transaction',
    'cashier.searchBtn':  'Search',
    'cashier.recent':     'Recent Transactions',
    'cashier.err409':     'Transaction already paid.',
    'cashier.err410':     'Transaction has expired.',
    'cashier.err404':     'Transaction not found.',
    'cashier.errDefault': 'Failed to find transaction.',

    // Cashier — recap
    'recap.title':      'Daily Recap',
    'recap.txnCount':   'Total Transactions',
    'recap.grandTotal': 'Grand Total',
    'recap.cash':       'Cash',
    'recap.qris':       'QRIS',
    'recap.edc':        'EDC',
    'recap.transfer':   'Transfer',
    'recap.txnList':    'Transactions ({count})',
  },

  ZH: {
    mapTitle:  '我们的位置',
    mapEmpty:  '地图尚未配置，请联系管理员。',
    mapClose:  '关闭',

    'nav.catalog': '目录',
    'nav.cart':    '购物车',
    'nav.orders':  '订单',

    'search.placeholder':    '搜索产品...',
    'filter.all':            '全部',
    'filter.inStockOnly':    '仅有库存',
    'filter.productCount':   '{count} 件产品',
    'product.notFound':      '未找到产品',
    'product.tryOther':      '请换个关键词',
    'product.added':         '✓ 已添加',
    'product.addToCart':     '+ 加购',
    'product.loadMore':      '加载更多',

    'product.notFoundDetail': '未找到产品。',
    'back':                   '← 返回',
    'product.booth':          '摊位',
    'product.location':       '位置',
    'product.stock':          '库存',
    'product.addedFull':      '✓ 已加入购物车',
    'product.addToCartFull':  '加入购物车',

    'cart.title':         '购物车 ({count} 件)',
    'cart.empty.title':   '购物车是空的',
    'cart.empty.desc':    '从目录添加产品',
    'cart.toCatalog':     '去目录 →',
    'cart.total':         '付款总额',
    'cart.pendingNote':   '订单有效期为30分钟，请尽快到收银台付款。',
    'cart.checkout':      '下单',
    'cart.checkoutError': '结账失败，请重试。',

    'orders.title':       '订单历史',
    'orders.empty.title': '暂无订单',
    'orders.empty.desc':  '快去目录购物吧！',
    'orders.toCatalog':   '去目录 →',

    'order.notFound':     '未找到订单。',
    'order.backHistory':  '← 订单历史',
    'order.showQR':       '请将此二维码出示给收银员',
    'order.cancelBtn':    '取消订单',
    'order.cancelTitle':  '取消订单？',
    'order.cancelBody':   '订单 {id} 将被取消，库存将恢复。',
    'order.cancelNo':     '否',
    'order.cancelYes':    '是，取消',
    'order.refresh':      '刷新',
    'order.refreshing':   '刷新中...',

    // Payment confirmed (C7)
    'confirmed.title':         '付款成功！',
    'confirmed.subtitle':      '您的商品正在各摊位准备中',
    'confirmed.txnId':         '交易编号',
    'confirmed.totalPaid':     '支付总额',
    'confirmed.payment':       '支付方式',
    'confirmed.datetime':      '日期和时间',
    'confirmed.nonReturnable': '所有销售均为最终决定，不可退货。',
    'confirmed.cta':           '查看收据和取货单',
    'confirmed.ctaHint':       '请前往摊位领取商品',

    // Receipt & pickup (C8)
    'receipt.sectionReceipt': '付款收据',
    'receipt.sectionPickup':  '取货说明',
    'receipt.total':          '合计',
    'receipt.done':           '已完成 ✓',
    'receipt.ready':          '已备好',
    'receipt.cta':            '追踪取货状态',

    // Pickup status (C9)
    'pickup.infoBanner':   '前往每个摊位并出示您的二维码，状态将自动更新。',
    'pickup.done':         '已完成 ✓',
    'pickup.ready':        '已备好',
    'pickup.preparing':    '准备中',
    'pickup.collected':    '已领取',
    'pickup.items':        '件商品',
    'pickup.allDone':      '所有商品已领取！🎉',
    'pickup.showBarcode':  '显示交易条码',
    'pickup.modalTitle':   '交易条码',

    'checkout.created':  '订单已创建！',
    'checkout.showQR':   '请将此二维码出示给收银员付款',
    'checkout.qrMissing':'二维码不可用',
    'checkout.txnId':    '交易编号',
    'checkout.total':    '总计',
    'checkout.payIn':    '⏰ 请在 {mins}:{secs} 分钟内付款',
    'checkout.expired':  '⚠️ 订单已过期',
    'checkout.track':    '追踪订单',
    'checkout.continue': '继续购物',

    'login.title':        '登录',
    'login.subtitle':     'Amazing Toys Fair 2026',
    'login.phone':        '手机号',
    'login.phonePh':      '08xxxxxxxxxx',
    'login.submit':       '登录',
    'login.noAccount':    '没有账户？',
    'login.register':     '注册',
    'login.staffLink':    '员工登录 →',
    'login.error':        '登录失败，请重试。',

    'register.title':     '创建新账户',
    'register.subtitle':  'Amazing Toys Fair 2026',
    'register.name':      '全名',
    'register.namePh':    '输入全名',
    'register.phone':     '手机号',
    'register.phonePh':   '08xxxxxxxxxx',
    'register.email':     '邮箱（可选）',
    'register.emailPh':   'email@example.com',
    'register.gender':    '性别',
    'register.male':      '男',
    'register.female':    '女',
    'register.other':     '不透露',
    'register.submit':    '立即注册',
    'register.hasAccount':'已有账户？',
    'register.login':     '登录',
    'register.error':     '注册失败，请重试。',

    'badge.PENDING':      '待处理',
    'badge.PAID':         '已付款',
    'badge.DONE':         '完成',
    'badge.CANCELLED':    '已取消',
    'badge.EXPIRED':      '已过期',
    'badge.AVAILABLE':    '有库存',
    'badge.LOW_STOCK':    '库存有限',
    'badge.OUT_OF_STOCK': '缺货',
    'badge.APPROVED':     '已批准',
    'badge.REJECTED':     '已拒绝',
    'badge.READY':        '已就绪',
    'badge.PREPARING':    '准备中',

    // Tenant — order queue
    'tenantOrders.title':       '订单队列',
    'tenantOrders.refresh':     '刷新',
    'tenantOrders.empty.title': '暂无订单',
    'tenantOrders.empty.desc':  '已付款的订单将显示在这里',
    'tenantOrders.waiting':     '等待交接 ({count})',
    'tenantOrders.done':        '已完成 ({count})',
    'tenantOrders.handover':    '确认交接 ✓',
    'tenantOrders.newOrder':    '新订单到来：{id}',
    'tenantOrders.handoverOk':  '交接成功！',
    'tenantOrders.handoverErr': '交接失败',

    // Tenant — dashboard
    'tenantDash.title':       '租户仪表板',
    'tenantDash.revenue':     '今日收入',
    'tenantDash.orders':      '总订单数',
    'tenantDash.done':        '已完成',
    'tenantDash.pending':     '待处理',
    'tenantDash.topProducts': '热销产品',
    'tenantDash.sold':        '已售 {n}',

    // Tenant — daily report
    'laporan.title':        '日报',
    'laporan.from':         '从',
    'laporan.to':           '至',
    'laporan.show':         '显示',
    'laporan.dateError':    '起始日期不能晚于结束日期。',
    'laporan.sectionA':     '按产品销售明细',
    'laporan.sectionB':     '每日销售',
    'laporan.tenant':       '租户：{name}',
    'laporan.noData':       '所选时间段内无数据。',
    'laporan.col.no':       '序号',
    'laporan.col.product':  '产品名称',
    'laporan.col.category': '分类',
    'laporan.col.qtySold':  '已售数量',
    'laporan.col.price':    '单价 (IDR)',
    'laporan.col.total':    '合计 (IDR)',
    'laporan.col.date':     '日期',
    'laporan.col.txnCount': '交易数',
    'laporan.col.revenue':  '收入 (IDR)',

    // Tenant — stock report
    'stock.title':        '最新库存报告',
    'stock.search':       '搜索产品 / ID / 条形码...',
    'stock.showInactive': '显示非活跃',
    'stock.updatedAt':    '更新时间',
    'stock.empty':        '未找到产品。',
    'stock.col.name':     '名称',
    'stock.col.category': '分类',
    'stock.col.price':    '价格',
    'stock.col.status':   '状态',
    'stock.col.stock':    '库存',
    'stock.col.photo':    '照片',

    // Cashier — payment
    'cashier.title':      '处理付款',
    'cashier.search':     '查找交易',
    'cashier.searchBtn':  '搜索',
    'cashier.recent':     '最近交易',
    'cashier.err409':     '该交易已付款。',
    'cashier.err410':     '该交易已过期。',
    'cashier.err404':     '未找到交易。',
    'cashier.errDefault': '查找交易失败。',

    // Cashier — recap
    'recap.title':      '每日汇总',
    'recap.txnCount':   '总交易数',
    'recap.grandTotal': '总计',
    'recap.cash':       '现金',
    'recap.qris':       'QRIS',
    'recap.edc':        'EDC',
    'recap.transfer':   '转账',
    'recap.txnList':    '交易列表 ({count})',
  },
};

// ── Supported languages ───────────────────────────────────────────────────────

export const SUPPORTED_LANGS = [
  { code: 'ID', label: 'ID' },
  { code: 'EN', label: 'EN' },
  { code: 'ZH', label: '中文' },
];

const STORAGE_KEY = 'sos_lang';

// ── Context ───────────────────────────────────────────────────────────────────

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'ID'
  );

  function setLang(code) {
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
  }

  // t(key) — simple lookup with optional {var} interpolation
  // t(key, { count: 5 }) → replaces {count} in the string
  function t(key, vars = {}) {
    let str = T[lang]?.[key] ?? T.ID[key] ?? key;
    if (vars && Object.keys(vars).length > 0) {
      str = Object.entries(vars).reduce(
        (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
        str
      );
    }
    return str;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
