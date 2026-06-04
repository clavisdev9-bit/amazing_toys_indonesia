# Voucher Discount — Implementation Prompts (Revised)
**Project:** Amazing Toys Fair 2026 — SOS × Odoo 18  
**Feature:** Sistem Voucher Diskon End-to-End  
**Revision:** 2026-06-04 (koreksi dari review awal)

---

## Urutan Deployment yang Wajib Diikuti

```
1. Prompt E   → Setup Odoo (wajib selesai SEBELUM deploy kode lain)
2. Prompt A   → DB Migration (backend/migrations/010_voucher_tables.sql)
3. Prompt B   → SOS Backend: Voucher Service & Routes
4. Prompt C   → Integration Service: order.push.js
5. Prompt D   → Frontend React
```

> **Mengapa urutan ini penting:**
> - Prompt C menulis ke field `discount` di `sale.order.line` Odoo — field ini hanya tersedia setelah Prompt E Step 2 dijalankan.
> - Prompt B bergantung pada tabel `vouchers` dan `voucher_usages` yang dibuat di Prompt A.
> - Prompt D bergantung pada endpoint yang dibuat di Prompt B.

---

## Prompt A — Database Migration

```
Kamu adalah senior backend engineer yang mengerjakan proyek Amazing Toys SOS.
Buat SQL migration baru untuk menambahkan sistem voucher diskon.
Ikuti konvensi yang sama dengan migration yang sudah ada di
backend/migrations/009_payment_voucher_xref.sql (bungkus dalam transaction,
catat di migration history jika ada tabel tersebut).

File baru: backend/migrations/010_voucher_tables.sql

=== CATATAN PENTING SEBELUM MULAI ===

Tabel `transactions` sudah memiliki kolom berikut (JANGAN buat ulang):
  - subtotal_amount NUMERIC(12,2)  — total sebelum pajak
  - tax_rate        NUMERIC(5,2)
  - tax_amount      NUMERIC(12,2)
  - total_amount    NUMERIC(14,2)

Migration ini HANYA menambah kolom baru ke `transactions` dan membuat
dua tabel baru. Gunakan IF NOT EXISTS / ADD COLUMN IF NOT EXISTS di semua tempat.

=== 1. Buat Tabel `vouchers` ===

CREATE TABLE IF NOT EXISTS vouchers (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(50) UNIQUE NOT NULL,
  description      VARCHAR(255),
  discount_type    VARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT', 'FIXED')),
  discount_value   NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_purchase     NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_discount     NUMERIC(14,2),              -- NULL = tidak ada cap (untuk PERCENT)
  usage_limit      INTEGER,                    -- NULL = unlimited
  usage_count      INTEGER NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_until      TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  tenant_id        VARCHAR(10),               -- NULL = berlaku semua tenant
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       VARCHAR(100),
  CONSTRAINT vouchers_valid_range CHECK (valid_until > valid_from),
  CONSTRAINT vouchers_percent_range CHECK (
    discount_type <> 'PERCENT' OR (discount_value > 0 AND discount_value <= 100)
  )
);

=== 2. Buat Tabel `voucher_usages` ===

CREATE TABLE IF NOT EXISTS voucher_usages (
  id               SERIAL PRIMARY KEY,
  voucher_code     VARCHAR(50) NOT NULL REFERENCES vouchers(code),
  transaction_id   VARCHAR(30) NOT NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  discount_amount  NUMERIC(14,2) NOT NULL,
  used_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (voucher_code, transaction_id)         -- idempotency guard
);

=== 3. Extend Tabel `transactions` ===

-- Hanya dua kolom baru; subtotal_amount, tax_rate, tax_amount, total_amount sudah ada.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voucher_code    VARCHAR(50) REFERENCES vouchers(code),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

=== 4. Index ===

CREATE INDEX IF NOT EXISTS idx_vouchers_active_code
  ON vouchers(code) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_vouchers_valid_period
  ON vouchers(valid_from, valid_until) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_voucher_usages_txn
  ON voucher_usages(transaction_id);

CREATE INDEX IF NOT EXISTS idx_voucher_usages_customer
  ON voucher_usages(customer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_voucher_code
  ON transactions(voucher_code) WHERE voucher_code IS NOT NULL;
```

---

## Prompt B — SOS Backend: Voucher Service & Routes

```
Kamu adalah senior backend engineer mengerjakan SOS Backend (Express.js, Node.js 20).
Proyek ini sudah memiliki modul: auth, products, orders, payments, admin.

File orders.service.js sudah dimodifikasi oleh beberapa CR sebelumnya:
- CR-022: tax-inclusive display
- CR-023: createOrderByCashier() + addItemToTransaction()
- CR-026: removeOrderItem()
- CR-027: _getCheckoutTimeoutMinutes() — baca config dari file
- CR-028: _getMaxItemsPerOrder() — validasi max item

Buat modul baru dan extend modul yang ada sesuai spesifikasi berikut.

=== Struktur File Baru ===

backend/src/modules/vouchers/
  ├── vouchers.routes.js
  ├── vouchers.service.js
  └── vouchers.controller.js

=== vouchers.service.js ===

Import: pg pool dari config/database.js, ikuti pattern modul payments.

--- Fungsi 1: validateVoucher({ code, customerId, cartTotal, tenantIds }) ---

Validasi berurutan — throw error dengan code string jika gagal:

1. SELECT * FROM vouchers WHERE code = $1 AND is_active = TRUE
   → Tidak ada: throw { code: 'VOUCHER_NOT_FOUND' }

2. Cek waktu: NOW() antara valid_from dan valid_until
   → Expired: throw { code: 'VOUCHER_EXPIRED' }

3. Cek usage_limit: jika bukan NULL, pastikan usage_count < usage_limit
   → Habis: throw { code: 'VOUCHER_USAGE_LIMIT' }

4. Cek min_purchase: cartTotal >= min_purchase
   → Kurang: throw { code: 'MIN_PURCHASE_NOT_MET', minPurchase: voucher.min_purchase }

5. Cek tenant_id: jika voucher.tenant_id tidak NULL,
   pastikan voucher.tenant_id ada di array tenantIds
   → Tidak cocok: throw { code: 'VOUCHER_NOT_APPLICABLE' }

6. Cek duplikasi customer (satu customer satu kali per voucher):
   SELECT 1 FROM voucher_usages WHERE voucher_code = $1 AND customer_id = $2
   → Sudah pakai: throw { code: 'ALREADY_USED' }
   CATATAN: Skip cek ini jika customerId adalah Walk-in (UUID dari customer
   dengan phone_number = '0000000000') — kasir boleh pakai voucher sama
   untuk customer berbeda.

7. Hitung discount_amount (pre-tax, dalam rupiah):
   - PERCENT: Math.min(
       Math.round(cartTotal * (discount_value / 100)),
       max_discount != null ? max_discount : Infinity
     )
   - FIXED: Math.min(discount_value, cartTotal)
   Hasil tidak boleh negatif, tidak boleh melebihi cartTotal.

Return: {
  valid: true,
  discount_amount,     -- pre-tax, integer rupiah (sudah di-round)
  discount_type,
  discount_value,
  description,
  code
}

--- Fungsi 2: applyVoucher({ code, transactionId, customerId, discountAmount }) ---

Jalankan dalam satu DB transaction (BEGIN / COMMIT / ROLLBACK):

1. INSERT INTO voucher_usages (voucher_code, transaction_id, customer_id, discount_amount)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (voucher_code, transaction_id) DO NOTHING
   -- idempotency: aman dipanggil dua kali

2. UPDATE vouchers
   SET usage_count = usage_count + 1
   WHERE code = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)
   -- conditional increment: tidak over-count jika ada race condition

3. UPDATE transactions
   SET voucher_code    = $1,
       discount_amount = $2
   WHERE transaction_id = $3
   -- fallback update jika createOrder tidak menyertakan voucher saat INSERT

Return: { success: true }

--- Fungsi 3: getVoucherByCode(code) ---
SELECT * FROM vouchers WHERE code = $1 — untuk admin lookup.

--- Fungsi 4: listVouchers({ activeOnly = false }) ---
SELECT semua voucher, ORDER BY created_at DESC.

=== vouchers.routes.js ===

Gunakan pattern router yang sama dengan modules lain.
Daftarkan di backend/src/app.js: app.use('/api/v1/vouchers', voucherRoutes)
                                   app.use('/api/v1/admin/vouchers', adminVoucherRoutes)

--- Customer/Cashier Routes ---

POST /api/v1/vouchers/validate
  Auth: Bearer JWT (CUSTOMER atau CASHIER atau LEADER)
  Body: { code: string, cart_total: number, tenant_ids: string[] }
  Panggil: voucherService.validateVoucher({ code, customerId: req.user.customerId,
                                             cartTotal: body.cart_total,
                                             tenantIds: body.tenant_ids })
  Response 200: { success: true, data: { valid, discount_amount, discount_type,
                                         description, code } }
  Response 400: { success: false, error: { code, message, minPurchase? } }

POST /api/v1/vouchers/apply
  Auth: ADMIN only (endpoint internal)
  Body: { code, transaction_id, customer_id, discount_amount }
  Panggil: voucherService.applyVoucher(body)

--- Admin Routes ---

GET    /api/v1/admin/vouchers          — listVouchers({ activeOnly: false })
GET    /api/v1/admin/vouchers/:code    — getVoucherByCode
POST   /api/v1/admin/vouchers          — INSERT INTO vouchers
PATCH  /api/v1/admin/vouchers/:code    — UPDATE vouchers
DELETE /api/v1/admin/vouchers/:code    — soft delete: UPDATE SET is_active = FALSE

=== Extend orders.service.js ===

PERHATIAN: File ini sudah kompleks. Tambah hanya yang diperlukan,
jangan ubah logika yang sudah ada.

--- Extend createOrder(customerId, items, voucherCode = null) ---

Di awal fungsi, tambah variabel:
  let discountAmount = 0;

Setelah kalkulasi subtotal_amount (sebelum INSERT):
  if (voucherCode) {
    const tenantIds = [...new Set(items.map(i => i.tenant_id).filter(Boolean))];
    const vResult = await voucherService.validateVoucher({
      code: voucherCode,
      customerId,
      cartTotal: subtotalAmount,  // pre-tax
      tenantIds,
    });
    discountAmount = vResult.discount_amount;
  }

Hitung ulang semua nilai setelah diskon (PENTING — ini yang diperbaiki dari spec awal):
  const taxableAmount  = subtotalAmount - discountAmount;
  const taxAmount      = Math.round(taxableAmount * (taxRate / 100));
  const totalAmount    = taxableAmount + taxAmount;

Di INSERT statement untuk tabel transactions, sertakan:
  voucher_code    = voucherCode || null
  discount_amount = discountAmount
  tax_amount      = taxAmount     (nilai yang sudah dihitung ulang)
  total_amount    = totalAmount   (nilai yang sudah dihitung ulang)

Setelah INSERT berhasil, di dalam blok DB transaction yang sama:
  if (voucherCode) {
    await voucherService.applyVoucher({
      code: voucherCode,
      transactionId: newTransactionId,
      customerId,
      discountAmount,
    });
  }

Jika applyVoucher gagal (race condition — voucher sudah habis dipakai concurrent):
  ROLLBACK seluruh transaction
  Throw error 409 dengan pesan jelas: "Voucher tidak lagi tersedia, silakan coba tanpa voucher"

--- Extend createOrderByCashier(cashierId, items, voucherCode = null) ---

Sama persis dengan extend createOrder di atas.
Untuk deduplication check di validateVoucher, gunakan Walk-in Customer UUID
(bukan null) agar function tidak error. Walk-in Customer boleh menggunakan
voucher yang sama berulang kali (skip duplicate check untuk UUID Walk-in).

--- Tidak ada perubahan pada ---
- addItemToTransaction()
- removeOrderItem()
- updateItemQuantity()
- cancelOrder()
```

---

## Prompt C — Extend Integration Service (order.push.js)

```
Kamu adalah senior backend engineer mengerjakan Integration Service (Node.js :4000).
Extend file src/services/order.push.js yang sudah ada untuk mengirim
informasi diskon voucher ke Odoo 18.

=== PRASYARAT WAJIB ===

Prompt E (Odoo Setup) HARUS sudah dieksekusi di Odoo SEBELUM kode ini di-deploy.
Khususnya:
- Field x_voucher_code sudah ada di sale.order
- Setting "Discounts" sudah diaktifkan di Sales → Pricing (field `discount`
  pada sale.order.line tersedia)

Verifikasi sebelum deploy:
  const lineFields = await odoo.execute('sale.order.line', 'fields_get', [['discount']]);
  if (!lineFields.discount) throw new Error('Odoo: discount field tidak aktif');

=== Context Sistem ===

- SOS API GET /orders/:transactionId sekarang mengembalikan:
    voucher_code: "DISKON20" | null
    discount_amount: 20000 | 0          (pre-tax, integer rupiah)
    discount_type: "PERCENT" | "FIXED" | null
    discount_value: 20 | 50000 | null   (persen atau nominal)
    subtotal_amount: 100000              (pre-tax pre-discount)

- Odoo sale.order.line sudah punya field `discount` (float, 0-100, persen)
  SETELAH Settings → Sales → Pricing → Discounts diaktifkan

- Custom field yang sudah ada di sale.order: x_sos_transaction_id
- Custom field BARU yang akan dibuat di Prompt E: x_voucher_code

=== Tugas 1: Tambah x_voucher_code di Odoo Setup Reference ===

Dokumentasikan bahwa sebelum deploy, admin harus menjalankan (sudah ada di Prompt E):
  env['ir.model.fields'].create({
    'model_id': env['ir.model'].search([('model','=','sale.order')]).id,
    'name': 'x_voucher_code',
    'field_description': 'SOS Voucher Code',
    'ttype': 'char',
    'size': 50,
  })
  env.cr.commit()

=== Tugas 2: Extend buildSaleOrderPayload() ===

Di sale.order header, tambah:
  x_voucher_code: transaction.voucher_code || ''

Di sale.order.line per baris, tambah field discount:

  Kalkulasi discount per baris:

  if (!transaction.discount_amount || transaction.discount_amount <= 0) {
    // Tidak ada voucher
    line.discount = 0.0;

  } else if (transaction.discount_type === 'PERCENT') {
    // Langsung pakai persen — sama untuk semua baris
    line.discount = parseFloat(transaction.discount_value) || 0;

  } else {
    // FIXED: distribusikan proporsional ke setiap baris
    // Gunakan metode "largest remainder" agar total persen akurat
    
    const totalSubtotal = transaction.subtotal_amount; // pre-tax, pre-discount
    const lineSubtotal  = item.unit_price * item.quantity;
    
    // Persen per baris (belum dibulatkan)
    const rawPercent = (transaction.discount_amount / totalSubtotal) * 100;
    
    // Dibulatkan ke 4 desimal agar Odoo menerima nilai yang tepat
    line.discount = Math.min(
      parseFloat(rawPercent.toFixed(4)),
      100
    );
  }

  CATATAN PENTING — Distribusi FIXED dengan beberapa baris:
  Gunakan "largest remainder method" untuk menghindari rounding drift:
  1. Hitung rawPercent untuk setiap baris
  2. Floor semua nilai
  3. Hitung total floor vs target
  4. Distribusikan sisa ke baris dengan remainder terbesar
  Ini memastikan SUM(line.discount × line.subtotal) ≈ discount_amount (toleransi Rp 1).

  price_unit tetap menggunakan historical price dari SOS (BR-003 — tidak berubah).

=== Tugas 3: Validasi Total sebelum action_confirm ===

Setelah odoo.create('sale.order', payload) dan SEBELUM action_confirm:

  const sosTotal   = transaction.total_amount;   // dari SOS, inklusif pajak & diskon
  const odooTotal  = await getOdooSOAmountTotal(orderId);
  const diff       = Math.abs(sosTotal - odooTotal);

  if (diff > 1) {
    // Toleransi Rp 1 untuk floating point
    logger.warn('OrderPush: total mismatch', {
      transactionId,
      sosTotal,
      odooTotal,
      diff,
    });
    // Log WARNING saja — JANGAN block action_confirm
    // Perbedaan kecil bisa terjadi karena PPN dihitung berbeda di Odoo vs SOS
  }

  Lanjutkan action_confirm tanpa mempedulikan warning.

=== Tugas 4: Extend Audit Log Entry untuk ORDER_PUSH ===

Tambah field berikut di audit log entry yang ditulis setelah ORDER_PUSH:
  voucher_code:    transaction.voucher_code || null
  discount_amount: transaction.discount_amount || 0

Gunakan pattern yang sama dengan audit.js yang sudah ada.
Field ini masuk ke kolom request_summary (JSON stringified).

=== Yang Tidak Berubah ===
- inFlight guard (CR-016) — tidak disentuh
- Circuit breaker logic — tidak disentuh
- Payment voucher chain (CR-015) — tidak disentuh
- Idempotency check via x_sos_transaction_id — tidak disentuh
```

---

## Prompt D — Frontend React

```
Kamu adalah senior frontend engineer mengerjakan SOS Frontend (React 18 + Tailwind CSS).
Tambahkan fitur input kode voucher di halaman keranjang dan perbarui semua
jalur rendering receipt untuk menampilkan baris diskon.

=== CONTEXT PENTING ===

File CartPage.jsx sudah dimodifikasi oleh:
- CR-022: item prices tax-inclusive, menggunakan usePublicConfig() untuk ppn_rate
- CR-028: validasi max items per order, banner over-limit, disable checkout
CartContext sudah menggunakan useReducer.

Receipt sudah dimodifikasi oleh CR-013/CR-014:
- ThermalReceipt.jsx: item tax-inclusive, hanya baris TOTAL (tanpa Subtotal/PPN)
- ReceiptPickupPage.jsx: sama (BUG-008)
- print.service.js: sama

=== Bagian 1: Komponen Baru VoucherInput.jsx ===

File: frontend/src/components/cart/VoucherInput.jsx

Props:
  cartTotal: number        — total keranjang PRE-TAX (nilai dari CartContext)
  tenantIds: string[]      — daftar tenant_id dari item di keranjang
  onVoucherApplied: (voucherData) => void
  onVoucherRemoved: () => void

State lokal:
  inputCode: string
  status: 'idle' | 'loading' | 'valid' | 'invalid'
  errorMessage: string
  appliedVoucher: object | null

Behavior:

1. User ketik kode → klik "Pakai" → POST /api/v1/vouchers/validate
   Body: { code: inputCode.trim().toUpperCase(), cart_total: cartTotal,
           tenant_ids: tenantIds }

2. Response 200 (valid):
   - Set status = 'valid'
   - Set appliedVoucher = response.data
   - Tampilkan chip hijau:
     "Voucher {code} — hemat Rp {formatRupiah(discount_amount)}"
     + tombol × untuk hapus
   - Panggil onVoucherApplied(voucherData)

3. Response 400 (invalid) — map error code ke pesan:
   VOUCHER_NOT_FOUND      → "Kode voucher tidak ditemukan"
   VOUCHER_EXPIRED        → "Voucher sudah tidak berlaku"
   VOUCHER_USAGE_LIMIT    → "Voucher sudah habis digunakan"
   MIN_PURCHASE_NOT_MET   → "Minimum belanja Rp {formatRupiah(minPurchase)}"
   ALREADY_USED           → "Kamu sudah pernah menggunakan voucher ini"
   VOUCHER_NOT_APPLICABLE → "Voucher tidak berlaku untuk produk ini"
   Default                → "Kode voucher tidak valid"

4. Hapus voucher (klik ×):
   - Reset state ke idle
   - Panggil onVoucherRemoved()

Styling: Tailwind CSS. Ikuti pattern komponen yang sudah ada di /components/ui/.

=== Bagian 2: Extend CartContext ===

File: frontend/src/context/CartContext.jsx (atau lokasi aktual)

Tambah state:
  appliedVoucher: null   — object dari validate response
  discountAmount: 0      — pre-tax, integer rupiah

Tambah actions ke reducer:
  case 'APPLY_VOUCHER':
    return { ...state,
      appliedVoucher: action.payload.voucher,
      discountAmount: action.payload.discountAmount }

  case 'REMOVE_VOUCHER':
    return { ...state,
      appliedVoucher: null,
      discountAmount: 0 }

  case 'CLEAR_CART':   // pastikan juga clear voucher saat cart dikosongkan
    return { ...initialState }

Tambah helper di CartContext value:
  applyVoucher: (voucherData) => dispatch({ type: 'APPLY_VOUCHER',
                                            payload: { voucher: voucherData,
                                                       discountAmount: voucherData.discount_amount } })
  removeVoucher: () => dispatch({ type: 'REMOVE_VOUCHER' })

=== Bagian 3: Extend CartPage.jsx ===

File: frontend/src/pages/customer/CartPage.jsx

Import VoucherInput dan tambahkan di bawah daftar item, sebelum ringkasan harga.

Gunakan dari CartContext:
  const { ..., appliedVoucher, discountAmount, applyVoucher, removeVoucher } = useCart();

Tambah komponen voucher input:
  <VoucherInput
    cartTotal={totalAmount}           // pre-tax dari CartContext
    tenantIds={[...new Set(items.map(i => i.tenant_id).filter(Boolean))]}
    onVoucherApplied={applyVoucher}
    onVoucherRemoved={removeVoucher}
  />

=== Ringkasan Harga (PERBAIKAN URUTAN KALKULASI) ===

Kalkulasi di dalam komponen (display-only, tidak ubah CartContext):

  const ppnRate        = parseFloat(config?.ppn_rate) || 0;
  const subtotalRaw    = totalAmount;                                    // pre-tax, pre-discount
  const discountRaw    = discountAmount;                                 // pre-tax
  const taxableRaw     = subtotalRaw - discountRaw;                     // pre-tax after discount
  const taxRaw         = Math.round(taxableRaw * ppnRate / 100);
  const grandTotal     = taxableRaw + taxRaw;

Tampilkan (ganti ringkasan yang sudah ada):

  Subtotal ({items.length} item):      {formatRupiah(subtotalRaw)}
  [hanya tampil jika discountAmount>0]:
  Diskon ({appliedVoucher.code}):    - {formatRupiah(discountRaw)}
  PPN {ppnRate}%:                      {formatRupiah(taxRaw)}
  ────────────────────────────────────
  Total:                               {formatRupiah(grandTotal)}

  CATATAN: "Total" ini adalah display-only untuk UX. Nilai aktual yang
  dikirim ke backend adalah CartContext.totalAmount (pre-tax) beserta
  voucher_code dan discount_amount. Backend yang menghitung ulang total
  final inklusif pajak.

=== Extend handleCheckout (POST /api/v1/orders) ===

Tambah ke request body:
  voucher_code:    appliedVoucher?.code   || null
  discount_amount: discountAmount         || 0

Setelah order berhasil dibuat, clear voucher:
  removeVoucher()

=== Bagian 4: Perbarui Jalur Rendering Receipt ===

WAJIB diperbarui agar konsisten (pelajaran dari BUG-008, BUG-011a):

--- 4a. ThermalReceipt.jsx ---

File: frontend/src/components/cashier/ThermalReceipt.jsx

Di bagian totals (setelah baris item, sebelum TOTAL):
  {txn.discount_amount > 0 && (
    <View style={styles.row}>
      <Text style={styles.label}>
        Diskon{txn.voucher_code ? ` (${txn.voucher_code})` : ''}
      </Text>
      <Text style={styles.value}>
        - {formatRupiah(txn.discount_amount)}
      </Text>
    </View>
  )}

Baris TOTAL tetap menggunakan txn.total_amount (sudah inklusif semua).

--- 4b. ReceiptPickupPage.jsx ---

File: frontend/src/pages/customer/ReceiptPickupPage.jsx

Pastikan `order` object dari API sudah include voucher_code dan discount_amount.
Di bagian totals (sebelum baris TOTAL):
  {order.discount_amount > 0 && (
    <div className="flex justify-between text-sm text-green-600">
      <span>
        Diskon{order.voucher_code ? ` (${order.voucher_code})` : ''}
      </span>
      <span>- {formatRupiah(order.discount_amount)}</span>
    </div>
  )}

--- 4c. print.service.js ---

File: backend/src/modules/print/print.service.js

Di bagian totals (sebelum baris TOTAL dalam ESC/POS output):
  if (txn.discount_amount > 0) {
    const discLabel = txn.voucher_code
      ? `Diskon (${txn.voucher_code})`
      : 'Diskon';
    lines.push(formatTwoColumn(discLabel, `- ${formatRupiah(txn.discount_amount)}`));
  }

=== Yang Tidak Berubah ===

- handleAddToCart — tetap kirim unit_price (pre-tax) ke CartContext
- CartContext items[].price — tetap pre-tax
- Semua module lain (cashier, tenant, leader, admin, integration) — tidak disentuh
- Max items validation (CR-028) — tidak disentuh, tetap aktif
- Urutan validasi: max items check sebelum checkout tidak berubah
```

---

## Prompt E — Odoo Admin Setup (Wajib Dijalankan PERTAMA)

```
Kamu adalah Odoo 18 administrator menyiapkan sistem untuk integrasi
voucher diskon dari SOS.

PENTING: Semua langkah di sini harus SELESAI sebelum mengerjakan Prompt C
(extend integration service). Field `discount` di sale.order.line dan
field `x_voucher_code` di sale.order harus ada sebelum kode integration
di-deploy.

=== Step 1: Aktifkan Developer Mode ===

Settings → General Settings → scroll ke bawah → Activate Developer Mode

=== Step 2: Aktifkan Discount pada Sale Order Line (KRITIS) ===

Settings → Sales → Pricing → centang "Discounts"
Save.

Verifikasi via Odoo Shell:
  line_fields = env['sale.order.line'].fields_get(['discount'])
  assert 'discount' in line_fields, "ERROR: discount field tidak aktif"
  print("OK: discount field aktif")

=== Step 3: Tambah Custom Field x_voucher_code di sale.order ===

Via Settings → Technical → Database Structure → Fields → Create:
  Model:       sale.order
  Field Name:  x_voucher_code
  Label:       SOS Voucher Code
  Type:        Char
  Size:        50
  Required:    No

Atau via Odoo Shell:
  env['ir.model.fields'].create({
    'model_id': env['ir.model'].search([('model','=','sale.order')]).id,
    'name': 'x_voucher_code',
    'field_description': 'SOS Voucher Code',
    'ttype': 'char',
    'size': 50,
    'required': False,
  })
  env.cr.commit()
  print("OK: x_voucher_code created")

Verifikasi:
  field = env['ir.model.fields'].search([
    ('model','=','sale.order'), ('name','=','x_voucher_code')
  ])
  assert field, "ERROR: field tidak ditemukan"
  print(f"OK: field id={field.id}")

=== Step 4: Verifikasi Field x_sos_transaction_id Masih Ada ===

(field ini dibuat di setup awal, pastikan belum terhapus)
  field = env['ir.model.fields'].search([
    ('model','=','sale.order'), ('name','=','x_sos_transaction_id')
  ])
  assert field, "ERROR: x_sos_transaction_id hilang — perlu dibuat ulang"
  print(f"OK: x_sos_transaction_id id={field.id}")

=== Step 5: Verifikasi Akhir — Checklist Sebelum Deploy ===

Jalankan semua verifikasi sekaligus via Odoo Shell:

  # 1. Discount field aktif
  line_fields = env['sale.order.line'].fields_get(['discount'])
  assert 'discount' in line_fields

  # 2. x_voucher_code ada
  assert env['ir.model.fields'].search([
    ('model','=','sale.order'),('name','=','x_voucher_code')])

  # 3. x_sos_transaction_id masih ada
  assert env['ir.model.fields'].search([
    ('model','=','sale.order'),('name','=','x_sos_transaction_id')])

  # 4. company_id = 5 accessible (cek dari CR-001)
  user = env['res.users'].browse(env.uid)
  assert 5 in user.company_ids.ids, "ERROR: company 5 tidak accessible"

  print("=== SEMUA CHECKS PASSED — AMAN UNTUK DEPLOY PROMPT C ===")

=== Step 6: Buat SQL Query Monitoring Voucher di Odoo ===

Untuk memverifikasi SO dengan voucher masuk dengan benar setelah go-live:

  SELECT
    so.name                       AS odoo_order,
    so.x_sos_transaction_id       AS txn_id,
    so.x_voucher_code             AS voucher_code,
    so.amount_untaxed             AS pre_tax,
    so.amount_tax                 AS tax,
    so.amount_total               AS total,
    SUM(sol.price_unit * sol.product_uom_qty
        * (1 - COALESCE(sol.discount,0)/100)) AS computed_subtotal
  FROM sale_order so
  JOIN sale_order_line sol ON sol.order_id = so.id
  WHERE so.x_voucher_code IS NOT NULL
    AND so.x_voucher_code != ''
    AND so.company_id = 5
  GROUP BY so.id
  ORDER BY so.create_date DESC
  LIMIT 20;

  -- computed_subtotal harus == amount_untaxed (toleransi 0.01)

=== Step 7: Filter View di Odoo (Opsional tapi Recommended) ===

Di Sales → Orders, tambah filter saved:
  Name: "Orders dengan Voucher"
  Domain: [('x_voucher_code','!=',False),('x_voucher_code','!=','')]
  Company: PT MYE INDONESIA (id=5)
```

---

## Ringkasan Perubahan dari Spec Awal

| Prompt | Perubahan | Alasan |
|---|---|---|
| A | Nama file `010_voucher_tables.sql`, reference ke `009_*` | Migration sebelumnya adalah 009 |
| A | Hapus `subtotal_amount` dari ALTER (sudah ada) | Kolom sudah ada di schema |
| A | `customer_id ON DELETE SET NULL` | Walk-in Customer dari CR-023 |
| A | Tambah CHECK constraints | Data integrity |
| B | Formula total: hitung ulang `tax_amount` dan `total_amount` setelah diskon | Formula awal tidak include ulang PPN |
| B | Extend `createOrderByCashier()` bukan hanya `createOrder()` | CR-023 path harus didukung |
| B | Rollback jika `applyVoucher` gagal (race condition) | Konsistensi data |
| B | Skip duplicate check untuk Walk-in Customer | POS Langsung bisa pakai voucher |
| C | Tambah prerequisite check field `discount` sebelum deploy | Runtime fail prevention |
| C | "Largest remainder method" untuk FIXED distribution | Rounding accuracy |
| C | Validasi total = WARNING bukan block | Minor float diff valid |
| D | Kalkulasi PPN di-display dari taxable (subtotal - discount) | Konsistensi dengan backend |
| D | Perbarui ThermalReceipt.jsx, ReceiptPickupPage.jsx, print.service.js | Pelajaran BUG-008 |
| E | Tambah urutan deployment wajib + verifikasi checklist | Dependency Prompt C |
