# Coding Standard — Amazing Toys Fair 2026
**Project:** Amazing Toy Show— SOS × Odoo 18 Integration  
**Maintained by:** clavis Development  
**Last updated:** 2026-06-16

---

## STD-001 — Tampilan Qty Item di Halaman Customer

**Berlaku untuk:** Semua halaman frontend yang menampilkan item order ke customer atau staff.

### Aturan

| Hal | Salah ❌ | Benar ✅ |
|---|---|---|
| Display qty | `item.quantity` | `item.approved_quantity ?? item.quantity` |
| Display harga item | `item.unit_price * item.quantity` | `item.subtotal` |
| Display harga incl. PPN | `item.unit_price * item.quantity * (1 + tax/100)` | `Math.round(item.subtotal * (1 + tax/100))` |
| Filter item yang ditolak | Tampilkan semua | `.filter(i => i.approval_status !== 'REJECTED')` |
| Hitung total qty | `items.reduce((s,i) => s + i.quantity, 0)` | `items.filter(i => i.approval_status !== 'REJECTED').reduce((s,i) => s + (i.approved_quantity ?? i.quantity), 0)` |

### Alasan

Setelah helper menyetujui partial qty (misal: customer order ×4, stok hanya ada ×2), kolom `approved_quantity` di tabel `transaction_items` menyimpan qty aktual yang disetujui. `quantity` adalah qty yang dipesan customer (tidak berubah). Menampilkan `quantity` ke customer adalah data yang salah.

### Checklist — setiap kali ada perubahan fitur approval/qty

Pastikan semua file berikut menggunakan pattern yang benar:

| File | Halaman | Fix yang diperlukan |
|---|---|---|
| `frontend/src/pages/customer/OrderTrackingPage.jsx` | `/pesanan/:id` | `approved_quantity ?? quantity` + `item.subtotal` |
| `frontend/src/pages/customer/ReceiptPickupPage.jsx` | `/pesanan/:id/receipt` | `approved_quantity ?? quantity` + `item.subtotal` + filter REJECTED |
| `frontend/src/pages/customer/PickupStatusPage.jsx` | `/pesanan/:id/pickup` | `approved_quantity ?? quantity` + `item.subtotal` + filter REJECTED + progress bar |
| `frontend/src/pages/cashier/PaymentPage.jsx` | Kasir — halaman pembayaran | `approved_quantity ?? quantity` + `item.subtotal` + filter REJECTED |
| `frontend/src/components/cashier/ThermalReceipt.jsx` | Kasir — print receipt | `approved_quantity ?? quantity` + `item.subtotal` + filter REJECTED |
| `backend/src/modules/orders/orders.router.js` | `/api/v1/orders/:txnId/public` | `approved_quantity ?? quantity` + `subtotal` + filter REJECTED |

### Contoh Implementasi

```jsx
// Filter dulu — hapus item yang ditolak
const displayItems = order.items.filter(i => i.approval_status !== 'REJECTED');

// Render setiap item
displayItems.map((item, idx) => {
  const qty = item.approved_quantity ?? item.quantity;
  const taxRate = parseFloat(order.tax_rate ?? 0);
  const priceIncTax = Math.round(item.subtotal * (1 + taxRate / 100));
  return (
    <div key={idx}>
      <span>{item.product_name} ×{qty}</span>
      <span>{formatRupiah(priceIncTax)}</span>
    </div>
  );
});

// Hitung total qty (untuk progress bar, item count, dll.)
const totalQty = displayItems.reduce((sum, i) => sum + (i.approved_quantity ?? i.quantity), 0);
```

---

## STD-002 — INSERT Idempotent + UPDATE Kondisional

**Berlaku untuk:** Semua operasi yang melakukan INSERT lalu UPDATE pada counter/aggregate.

### Aturan

```js
// SALAH ❌ — UPDATE berjalan meski INSERT no-op (double-count pada retry)
await client.query(`INSERT INTO ... ON CONFLICT DO NOTHING`);
await client.query(`UPDATE table SET count = count + 1 WHERE ...`);

// BENAR ✅ — UPDATE hanya berjalan jika INSERT berhasil memasukkan baris
const result = await client.query(`INSERT INTO ... ON CONFLICT DO NOTHING`);
if (result.rowCount > 0) {
  await client.query(`UPDATE table SET count = count + 1 WHERE ...`);
}
```

### Alasan

Jika endpoint dipanggil dua kali untuk data yang sama (retry, concurrent call), INSERT kedua adalah no-op (`ON CONFLICT DO NOTHING`). Tanpa guard `rowCount > 0`, UPDATE tetap berjalan → counter double-increment.

### Referensi

BUG-046 — `vouchers.usage_count` double-increment pada retry.

---

## STD-003 — Kunci Row (FOR UPDATE) pada PostgreSQL JOIN

**Berlaku untuk:** Query yang menggunakan `SELECT ... FOR UPDATE` pada tabel yang di-JOIN.

### Aturan

```sql
-- SALAH ❌ — FOR UPDATE pada JOIN bisa deadlock jika dua session kunci row berbeda
SELECT ti.*, p.stock_quantity
FROM transaction_items ti
JOIN products p ON p.product_id = ti.product_id
WHERE ti.item_id = $1
FOR UPDATE;

-- BENAR ✅ — Pisahkan dua query; kunci setiap tabel secara independen
-- Query 1: Kunci transaction_items
SELECT item_id, product_id, quantity FROM transaction_items WHERE item_id = $1 FOR UPDATE;

-- Query 2: Kunci products setelah mengetahui product_id
SELECT product_name, stock_quantity FROM products WHERE product_id = $1 FOR UPDATE;
```

### Alasan

`FOR UPDATE` pada JOIN menyebabkan PostgreSQL mengunci row di kedua tabel sekaligus. Jika dua transaksi DB mengunci tabel yang sama dalam urutan berbeda, terjadi deadlock. Memisahkan query memastikan urutan kunci konsisten.

### Referensi

BUG-040 — `approveItem` deadlock pada `FOR UPDATE` dengan JOIN `products`.

---

## STD-004 — Explicit Type Cast pada PostgreSQL Parameter

**Berlaku untuk:** Query yang menggunakan parameter `$N` dalam konteks yang bisa ambigu (operasi aritmatika + assignment ke kolom dengan tipe berbeda).

### Aturan

```sql
-- SALAH ❌ — PostgreSQL tidak bisa infer tipe $1 karena dipakai sebagai INTEGER dan NUMERIC
UPDATE transaction_items
SET approved_quantity = $1,
    subtotal = unit_price * $1
WHERE item_id = $2;

-- BENAR ✅ — Explicit cast
UPDATE transaction_items
SET approved_quantity = $1::integer,
    subtotal = unit_price * $1::integer
WHERE item_id = $2;
```

### Alasan

PostgreSQL inferensi tipe parameter berdasarkan konteks. Jika `$1` dipakai di dua posisi dengan tipe berbeda (INTEGER untuk assignment, NUMERIC untuk perkalian), PostgreSQL melempar error `inconsistent types deduced for parameter $N`.

### Referensi

BUG-044 — `approveItem` 500: `inconsistent types deduced for parameter $1`.

---

## STD-005 — Silent Background Refresh di React

**Berlaku untuk:** Komponen yang melakukan polling atau WebSocket subscription.

### Aturan

```jsx
// SALAH ❌ — Semua fetch set loading=true → spinner muncul pada setiap polling
function fetchData() {
  setLoading(true);
  api.get('/data').then(r => setData(r.data)).finally(() => setLoading(false));
}
useEffect(() => {
  const id = setInterval(fetchData, 20_000);
  return () => clearInterval(id);
}, []);

// BENAR ✅ — Pisahkan loading (initial) dari refreshing (background)
const fetchData = useCallback((silent = false) => {
  if (!silent) setLoading(true);
  else         setRefreshing(true);
  api.get('/data')
    .then(r => setData(prev => smartMerge(prev, r.data)))
    .finally(() => { setLoading(false); setRefreshing(false); });
}, []);

// Initial: fetchData(false)
// Polling / WS: fetchData(true)
useEffect(() => {
  const id = setInterval(() => fetchData(true), 20_000);
  return () => clearInterval(id);
}, [fetchData]);
```

Gunakan **smart merge** (preserve unchanged object references) bukan full replace — sehingga `React.memo` dapat skip re-render subtree yang tidak berubah.

### Referensi

CR-046 — Auto-refresh Approval Queue tanpa blink.

---

## STD-006 — Voucher Usage Limit

**Berlaku untuk:** Validasi dan penerapan voucher.

### Aturan

- `usage_limit` adalah **satu-satunya** pembatas pemakaian voucher secara global.
- Tidak ada per-customer limit terpisah kecuali ada field `per_customer_limit` eksplisit di tabel `vouchers`.
- Jangan implisit encode per-customer limit dengan mengecek keberadaan row di `voucher_usages`.

### Referensi

BUG-046 — Voucher `usage_limit=2` hanya bisa dipakai 1 kali karena per-customer check terlalu ketat.

---

## STD-007 — Informasi Stok yang Boleh Ditampilkan ke Customer

**Berlaku untuk:** Semua halaman frontend yang diakses oleh customer.

### Aturan

| Informasi | Customer ❌ | Staff/Admin ✅ |
|---|---|---|
| Angka stok eksak (`52 pcs`) | Tidak boleh ditampilkan | Boleh (admin master data, dsb.) |
| Badge status kategoris (`Tersedia` / `Stok Terbatas` / `Habis`) | Boleh dan wajib ditampilkan | Boleh |

### Implementasi

```jsx
// SALAH ❌ — Tampilkan angka stok eksak ke customer
<SpecItem emoji="📦" value={`${stock} pcs`} label="Stock" />

// BENAR ✅ — Tampilkan badge status kategoris saja
import { getStockStatus } from '../utils/stockUtils';
const { key: stockKey } = getStockStatus(stock);
<span>{t(stockKey)}</span>  {/* "Tersedia" / "Stok Terbatas" / "Habis" */}
```

### Alasan

Angka stok eksak adalah informasi operasional internal. Menampilkannya ke customer dapat:
- Mengungkap kapasitas/inventory booth ke kompetitor
- Membingungkan customer (stok di DB vs stok fisik bisa berbeda karena in-transit, cacat, dsb.)
- Menyebabkan customer mengambil keputusan berdasarkan data yang tidak akurat

### Halaman yang terpengaruh

| File | Halaman | Badge status tampil? | Angka stok tampil? |
|---|---|---|---|
| `MockProductDetailPage.jsx` | `/product/:id` | ✅ Ya | ❌ Tidak |
| `ProductCartPage.jsx` | `/product_cart/:id` | ✅ Ya | ❌ Tidak |
| `ProductCard.jsx` | `/katalog` (grid) | ✅ Ya | ❌ Tidak |

### Referensi

CR-048 — Hide chip "X pcs / Stock" di halaman detail produk.

---

## STD-008 — Navigasi SPA: Dilarang `window.location` untuk Routing Internal

**Berlaku untuk:** Semua navigasi internal di frontend React (bukan URL eksternal).

### Aturan

| Kasus | Salah ❌ | Benar ✅ |
|---|---|---|
| Redirect setelah logout / session expired | `window.location.href = '/masuk'` | `navigate('/masuk', { replace: true })` via `useNavigate()` |
| Navigasi antar halaman | `window.location.href = '/katalog'` | `<Link to="/katalog">` atau `navigate('/katalog')` |
| Cek URL aktif | `window.location.pathname === '/foo'` | `useLocation().pathname === '/foo'` (lebih tepat) |
| URL eksternal | — | Boleh pakai `window.open(url)` atau `<a href="https://...">` |

### Pengecualian yang Diizinkan (Read-Only)

`window.location` **boleh dibaca** untuk keperluan non-navigasi:
- `window.location.protocol` / `window.location.host` — untuk konstruksi URL WebSocket
- `window.location.pathname` — untuk error message atau perbandingan satu kali di luar komponen React
- `window.location.host` — untuk display error ke user (misal: hint HTTPS)

### Implementasi: Axios Interceptor 401 → SPA Navigate

Satu-satunya titik di mana 401 auto-redirect terjadi adalah `api/client.js`. Karena `client.js` bukan React component (tidak bisa pakai `useNavigate`), gunakan pola **Custom DOM Event**:

```js
// api/client.js — pada interceptor 401:
localStorage.removeItem('sos_token');
localStorage.removeItem('sos_user');
window.dispatchEvent(new CustomEvent('sos:session-expired'));  // ✅ SPA-safe

// App.jsx — AppRoutes component (di dalam BrowserRouter + AuthProvider):
useEffect(() => {
  const handleExpiry = () => {
    logout();                             // bersihkan React auth state
    navigate('/masuk', { replace: true }); // SPA navigation, zero reload
  };
  window.addEventListener('sos:session-expired', handleExpiry);
  return () => window.removeEventListener('sos:session-expired', handleExpiry);
}, [logout, navigate]);
```

### Alasan

`window.location.href = '/path'` menyebabkan **full page reload**:
- Seluruh React virtual DOM di-destroy dan di-rebuild dari awal
- Semua state (context, useState, cart, dll.) hilang
- WebSocket diputus dan harus reconnect
- Seluruh JavaScript bundle di-download ulang dari cache
- Transisi halaman menjadi kasar / terasa seperti website lama

React Router menggunakan **History API** (`pushState`/`replaceState`) — navigasi terjadi di dalam browser tab yang sama, React hanya me-render ulang komponen yang berubah.

### Referensi

CR-049 — SPA navigation: ganti `window.location.href` di `api/client.js` dengan `CustomEvent + useNavigate`.


---

## STD-009 — Admin Field yang Referensi List Konfigurasi Wajib Punya Affordance "Tambah Baru"

**Berlaku untuk:** Semua field di halaman admin (`/admin`) yang menawarkan pilihan dari sebuah list nilai yang bisa dikonfigurasi (kategori, tag, tenant, dsb.).

### Aturan

Setiap `<select>`, combobox, atau dropdown di halaman admin yang nilainya berasal dari tabel konfigurasi di database **wajib menyertakan mekanisme inline** untuk menambahkan nilai baru — berupa:
- Opsi "➕ Tambahkan `{teks}`" di bagian bawah dropdown (jika typed value belum ada), ATAU
- Tombol "+ Tambah" di samping field yang membuka mini-modal, ATAU
- Inline input di dalam dropdown itu sendiri.

Pengecualian: field yang nilainya diambil dari sistem eksternal (Odoo, Payment Gateway) dan tidak bisa diubah dari sisi SOS.

### Alasan

Bug-051 menunjukkan pola umum: admin ingin menambah kategori baru saat sedang isi form produk, tapi tidak ada caranya. Mereka harus keluar dari modal, cari tempat lain, lalu kembali — atau terpaksa mengetik bebas dan berharap data tidak inconsistent.

### Implementasi Yang Direkomendasikan

Gunakan pola `CategoryCombobox` yang sudah diupdate (BUG-051):

```jsx
// CategoryCombobox menerima onAddNew prop
<CategoryCombobox
  label="Kategori *"
  value={form.category}
  onChange={(val) => setForm(f => ({ ...f, category: val }))}
  categories={categories}
  onAddNew={handleAddCategory}   // ← wajib ada
  required
/>

// Handler di parent:
async function handleAddCategory(name) {
  await createCategory(name);          // POST ke backend
  const r = await getCategories();     // refresh list
  setCategories(r.data.data ?? []);
  addToast(`Kategori "${name}" ditambahkan.`, 'success');
}
```

Backend endpoint wajib menggunakan `ON CONFLICT ... DO NOTHING` agar idempotent:

```sql
INSERT INTO product_categories (name) VALUES ($1)
ON CONFLICT (name) DO NOTHING
RETURNING *
```

### Cakupan Saat Ini

| Field | Komponen | Status |
|---|---|---|
| Kategori Produk (`category`) | `CategoryCombobox` | ✅ STD-009 compliant (BUG-051) |
| Kategori Odoo (`odoo_categ_id`) | `ComboboxField` | ⚠️ Data dari Odoo — pengecualian |
| Tenant ID (`tenant_id`) | `<select>` | ⚠️ Dikelola via tab Users & Role — pengecualian |

### Referensi

BUG-051 — Field "Kategori *" di Admin Master Data Tidak Ada Menu Tambah Kategori.

---

## STD-011 — Setiap Status Non-Terminal dengan `expires_at` Wajib Di-cover oleh TxnExpireJob

**Berlaku untuk:** `backend/src/modules/scheduler/jobs/TxnExpireJob.js` dan semua status transaksi yang memiliki batas waktu.

### Masalah

`TxnExpireJob` awalnya hanya men-sweep `status = 'PENDING'`. Transaksi `RESERVED` dan `WAITING_PAYMENT` juga memiliki `expires_at` (2 jam dari pembuatan Helper order), tapi tidak pernah di-expire secara otomatis. Akibatnya:
- Transaksi kadaluarsa tetap bisa diproses kasir
- Stok yang dikunci tidak pernah dikembalikan

### Aturan

| Status | `expires_at` diset? | Sweep oleh TxnExpireJob? | Stock restore saat expire? |
|---|---|---|---|
| `PENDING_APPROVAL` | Tidak (NULL) | Tidak (NULL check menjaga) | — |
| `PENDING` (legacy) | Ya | **Ya** | Tidak (Odoo cancel sync) |
| `RESERVED` | Ya | **Ya** | **Ya** (stock diambil saat createHelperOrder) |
| `WAITING_PAYMENT` | Ya | **Ya** | **Ya** (inherit dari RESERVED) |
| `PAID`, `CANCELLED`, `EXPIRED`, `COMPLETED` | N/A | Tidak (terminal) | — |

### Aturan Saat Menambah Status Baru

Jika ada status baru yang:
1. Bukan terminal (`TRANSITIONS[status]` tidak kosong), DAN
2. Ada kemungkinan `expires_at` diset

→ **Wajib tambahkan status tersebut ke sweep di `TxnExpireJob.js`**

Tentukan juga apakah status tersebut membutuhkan stock restoration:
- **Ya** jika stock sudah diambil dari `products.stock_quantity` saat transaksi masuk status ini
- **Tidak** jika ada proses eksternal (Odoo sync, dll.) yang menangani stock

### Pattern Stock Restoration (untuk job)

```sql
UPDATE products p
   SET stock_quantity = stock_quantity + ti.quantity
  FROM transaction_items ti
 WHERE ti.transaction_id = $1
   AND ti.product_id = p.product_id
   AND ti.approval_status != 'REJECTED'
```

Jalankan di dalam `withTransaction` per transaksi yang di-expire, tangkap error per-item (non-fatal).

### Checklist Setiap Kali Menambah Status Transaksi Baru

- [ ] Apakah status ini memiliki `expires_at`? → jika ya, tambahkan ke `TxnExpireJob`
- [ ] Apakah status ini mengambil stock? → jika ya, tambahkan stock restoration ke sweep
- [ ] Apakah status ini ada di `status.machine.js` TRANSITIONS dengan `EXPIRED` sebagai target valid?
- [ ] Test: buat transaksi dengan status ini, set `expires_at` ke masa lalu, jalankan job, verifikasi status berubah ke `EXPIRED` dan stok kembali

### Referensi

BUG-056 — TXN-20260613-00070 RESERVED tidak otomatis kadaluarsa + stok tidak kembali.

---

## STD-010 — Setiap Tabel Baru Wajib Memiliki Idempotent Schema Guard di `app.js`

**Berlaku untuk:** Semua tabel baru yang dibutuhkan oleh feature backend baru (migration).

### Masalah

`docker-entrypoint-initdb.d` script PostgreSQL **hanya berjalan satu kali** — pada saat volume database pertama kali dibuat. Semua environment yang sudah ada (production, staging, dev yang sudah pernah dijalankan) tidak akan mendapat tabel baru dari migration file baru.

Tanpa schema guard, feature yang membutuhkan tabel baru akan menghasilkan `ERROR: relation "xxx" does not exist` → 500 Internal Server Error — tepat seperti pada BUG-055 (`customer_otps`, `customer_trusted_devices`), BUG-041, dan BUG-048 (kolom migration 015/017).

### Aturan

**Setiap kali menambah migration SQL baru, tambahkan juga idempotent schema guard di `backend/src/app.js`** — di dalam `server.listen` callback, setelah guard yang sudah ada.

Pattern wajib:

```js
// ── Idempotent schema guard (migration NNN: deskripsi singkat) ─────────────────
const migrationNNNStatements = [
  `CREATE TABLE IF NOT EXISTS new_table (
     id          SERIAL PRIMARY KEY,
     foreign_col UUID   NOT NULL REFERENCES parent_table(parent_pk) ON DELETE CASCADE,
     -- ... kolom lainnya
   )`,
  `CREATE INDEX IF NOT EXISTS idx_new_table_lookup ON new_table (foreign_col)`,
  // ALTER TABLE ... ADD COLUMN IF NOT EXISTS juga berlaku
];
try {
  for (const sql of migrationNNNStatements) await dbQuery(sql);
  logger.info('[Schema] Migration NNN verified — new_table ready.');
} catch (e) {
  logger.warn('[Schema] Migration NNN schema check warning:', e.message);
}
```

### Aturan Tipe FK — Wajib Diikuti

Sebelum menulis migration, selalu periksa tipe PK tabel yang direferensikan:

| Tabel | PK | Tipe |
|---|---|---|
| `customers` | `customer_id` | `UUID` |
| `users` | `user_id` | `UUID` |
| `transactions` | `transaction_id` | `VARCHAR(50)` |
| `products` | `product_id` | `INTEGER` |
| `tenants` | `tenant_id` | `VARCHAR(50)` |

Menulis tipe FK yang salah (misal `INTEGER` untuk FK ke `customers.customer_id` yang `UUID`) → `CREATE TABLE` gagal dengan `incompatible types`. Jika logger tidak memformat error dengan benar, log hanya menampilkan warning kosong — sangat sulit di-debug.

### Checklist Sebelum Deploy Migration Baru

- [ ] Migration SQL sudah ditulis di `backend/migrations/NNN_xxx.sql`
- [ ] Schema guard sudah ditambahkan di `backend/src/app.js` `server.listen` callback
- [ ] Tipe semua FK kolom sudah diverifikasi sesuai tabel parent
- [ ] Setelah deploy: log startup menampilkan `[Schema] Migration NNN verified — ...`
- [ ] **TIDAK** ada `[Schema] Migration NNN schema check warning:` di log

### Deployment Wajib Setelah Tambah Guard

```bash
docker compose build backend          # rebuild image dengan app.js baru
docker compose up -d --no-deps backend  # deploy container baru
# docker compose restart backend TIDAK cukup — container lama tidak baca kode baru
```

### Referensi

BUG-055 — `/masuk` login → 500 karena `customer_otps`/`customer_trusted_devices` tidak ada.  
BUG-041, BUG-048 — Kolom migration 015/017 tidak ada di environment yang sudah berjalan.

---

## STD-012 — Kolom Referensi ke Tabel Lain Wajib Menggunakan Tipe yang Sama

**Berlaku untuk:** Schema guard di `app.js`, migration SQL, semua `INSERT`/`UPDATE` cross-table.

### Masalah

Kolom yang mereferensikan data dari tabel lain (baik lewat FK eksplisit maupun secara logis) harus menggunakan tipe yang **identik** dengan kolom sumber. Kesalahan tipe tidak muncul saat `CREATE TABLE` (jika tidak ada FK constraint), melainkan saat `INSERT` pertama kali — menyebabkan `Internal Server Error` yang sulit di-trace.

**Contoh nyata (BUG-057):**
- `products.product_id` = `VARCHAR(20)` (nilai: `'p1'`, `'MOCK-P01'`, dll.)
- `item_delete_requests.product_id` = `INTEGER` (salah) → `INSERT` gagal dengan `invalid input syntax for type integer`

### Aturan

1. **Sebelum menulis schema guard atau migration baru**: cek tipe kolom sumber di migration file atau schema guard yang sudah ada.
2. **Jika ada FK eksplisit** (`REFERENCES tabel(kolom)`): PostgreSQL akan menolak CREATE TABLE jika tipe tidak cocok — ini sudah aman.
3. **Jika tidak ada FK eksplisit** (referensi logis, bukan constraint): verifikasi tipe secara manual. Tipe yang sering membingungkan:

| Kolom | Tipe Aktual | Kesalahan Umum |
|---|---|---|
| `products.product_id` | `VARCHAR(20)` | `INTEGER` |
| `customers.customer_id` | `UUID` | `INTEGER` |
| `users.user_id` | `UUID` | `INTEGER` |
| `transactions.transaction_id` | `VARCHAR(50)` | `UUID` |
| `tenants.tenant_id` | `VARCHAR(20)` | `INTEGER` |

4. **Untuk deployment existing** (tabel sudah terlanjur dibuat salah): tambahkan `DO $$ ... ALTER COLUMN ... TYPE ...` idempotent di schema guard — gunakan `information_schema.columns` untuk cek tipe sebelum ALTER.

### Template ALTER COLUMN Idempotent

```sql
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name  = 'nama_tabel'
      AND column_name = 'nama_kolom'
      AND data_type   = 'tipe_salah'   -- contoh: 'integer'
  ) THEN
    ALTER TABLE nama_tabel
      ALTER COLUMN nama_kolom TYPE tipe_benar USING nama_kolom::text;
    RAISE NOTICE 'nama_tabel.nama_kolom migrated tipe_salah → tipe_benar';
  END IF;
END $$
```

### Checklist Sebelum Menulis Schema Guard Baru

- [ ] Cari definisi tabel sumber di `backend/migrations/` atau `app.js` schema guards
- [ ] Verifikasi tipe kolom yang akan direferensikan (FK atau logis)
- [ ] Jika tidak ada FK eksplisit: tambahkan komentar `-- references products.product_id VARCHAR(20)` di samping kolom

### Referensi

BUG-057 — Tombol 🗑️ → 500 karena `item_delete_requests.product_id INTEGER` vs `products.product_id VARCHAR(20)`.  
BUG-055 — `customer_trusted_devices.customer_id INTEGER` vs `customers.customer_id UUID`.

---

## STD-013 — Validasi Pre-Condition Sebelum UPDATE yang Menyentuh Kolom dengan Check Constraint

**Berlaku untuk:** Semua fungsi yang melakukan DELETE item lalu recalculate nilai agregat di tabel parent.

### Masalah

Kolom seperti `total_amount`, `subtotal_amount`, `balance`, `quantity_remaining` sering memiliki check constraint (`> 0`, `>= 0`, `BETWEEN x AND y`). Operasi DELETE + recalculate yang tidak memvalidasi hasil kalkulasi terlebih dahulu akan melempar exception di layer PostgreSQL → HTTP 500.

**Contoh nyata (BUG-058):**
- `transactions.total_amount` memiliki `CHECK (total_amount > 0)`
- `reviewDeleteRequest()` DELETE item terakhir → recalculate → `total_amount = 0` → constraint violated → 500

### Aturan

1. **Sebelum DELETE item yang mempengaruhi agregat**: hitung berapa item yang akan tersisa setelah DELETE.
2. **Jika hasil kalkulasi akan melanggar constraint**: throw `AppError` dengan HTTP 422 dan pesan actionable, BUKAN membiarkan PostgreSQL throw 500.
3. **Pattern standar untuk "last item guard"**:

```js
// Cek sisa item sebelum DELETE
const remainingRes = await client.query(
  `SELECT COUNT(*) AS cnt
   FROM child_table
   WHERE parent_id = $1
     AND status != 'excluded_status'
     AND item_id != $2`,   // kecualikan item yang akan dihapus
  [parentId, itemId],
);
if (parseInt(remainingRes.rows[0].cnt, 10) === 0) {
  throw new AppError(
    'Tidak dapat menghapus semua item. [Aksi alternatif yang jelas].',
    422,
  );
}
```

4. **Constraint yang perlu diperhatikan di schema ini:**

| Kolom | Tabel | Constraint | Minimum |
|---|---|---|---|
| `total_amount` | `transactions` | `total_amount > 0` | Harus ada setidaknya 1 item non-rejected |
| `stock_quantity` | `products` | (none, tapi logic bisnis min 0) | Jangan kurangi lebih dari stok tersedia |
| `txn_count` | `cashier_sessions` | `>= 0` | Tidak boleh negatif |

5. **Pesan error wajib actionable**: sebutkan apa yang harus dilakukan user (misal: "Batalkan transaksi terlebih dahulu").

### Referensi

BUG-058 — Klik "Setujui" di `/leader/hapus-approval` → 500 karena item terakhir transaksi dihapus → `total_amount = 0` → `transactions_total_amount_check` violated.

---

## STD-014 — Restore Stok pada Cancel/Expire Wajib Mempertimbangkan `approval_status` dan `approved_quantity`

**Berlaku untuk:** Semua fungsi yang mengembalikan stok saat transaksi dibatalkan atau kadaluarsa.

### Masalah

Sistem memiliki dua model deduction stok yang berbeda tergantung flow:

| Flow | Kapan deduct | Berapa | Kolom acuan |
|---|---|---|---|
| **SELF_ORDER** (PENDING) | Saat `createOrder()` / `createOrderByCashier()` | `quantity` | `ti.quantity` |
| **PENDING_APPROVAL → PENDING** | Saat helper `approveItem()` | `approved_quantity` | `ti.approved_quantity` |
| **HELPER_INPUT** (RESERVED) | Saat `createHelperOrder()` | `quantity` | `ti.quantity` |
| **REJECTED items** | Tidak pernah dikurangi | 0 | — |

Fungsi cancel/expire yang menggunakan `ti.quantity` secara flat untuk SEMUA item akan **over-restore stok** untuk transaksi PENDING_APPROVAL → PENDING (BUG-059).

### Aturan

Setiap fungsi yang merestorasi stok dari cancel atau expire HARUS menggunakan logika berikut:

```js
// Pattern standar restore stok yang benar:
const items = await client.query(
  `SELECT product_id, quantity, approval_status, approved_quantity
   FROM transaction_items WHERE transaction_id = $1`,
  [transactionId]
);
for (const item of items.rows) {
  const restoreQty = item.approval_status === 'REJECTED'
    ? 0                                                    // tidak pernah dikurangi
    : (item.approved_quantity !== null
        ? item.approved_quantity                           // PENDING_APPROVAL flow
        : item.quantity);                                  // SELF_ORDER / HELPER flow
  if (restoreQty > 0) {
    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
      [restoreQty, item.product_id]
    );
  }
}
```

### Pengecualian yang Aman

Fungsi berikut menggunakan `ti.quantity` dan BENAR:
- **`cancelHelperOrder()`**: hanya untuk RESERVED (HELPER_INPUT flow) — stock di-deduct dengan `quantity` saat create
- **`TxnExpireJob.restoreStock()`**: hanya untuk RESERVED/WAITING_PAYMENT — stock di-deduct dengan `quantity` saat create

Fungsi berikut yang sudah difix (jangan rollback):
- **`cancelOrder()`** (orders.service.js): menggunakan `approved_quantity` untuk APPROVED items ✓

### Checklist Saat Menulis Fungsi Restore Stok Baru

- [ ] Apakah transaksi bisa berasal dari PENDING_APPROVAL flow?
- [ ] Jika ya: gunakan `approved_quantity` untuk APPROVED items, 0 untuk REJECTED
- [ ] Jika hanya RESERVED/WAITING_PAYMENT (HELPER flow): boleh pakai `quantity`
- [ ] Tidak ada fungsi restore yang boleh mengabaikan `approval_status = 'REJECTED'`

### Referensi

BUG-059 — `cancelOrder()` restore `quantity=4` padahal `approved_quantity=2` → stok +4 bukan +2.  
DOC.md § Peta Lengkap: Status Transaksi vs Stok — tabel lengkap semua event deduction dan restoration.

---

## STD-015 — Input Numerik yang Boleh Dikosongkan: Jangan Gunakan `parseInt(...) || fallback` pada `onChange`

**Berlaku untuk:** Semua React controlled `<input type="number">` atau komponen `<Input>` yang bisa dikosongkan user untuk mengetik ulang.

### Masalah

Pattern `onChange={(e) => set(key, parseInt(e.target.value, 10) || DEFAULT)}` menyebabkan field tidak bisa diketik ulang:

1. User tekan backspace untuk menghapus isi → `e.target.value = ""`
2. `parseInt("", 10)` = `NaN`
3. `NaN || DEFAULT` = `DEFAULT`
4. Field langsung kembali ke nilai default — user tidak bisa mengetik nilai baru

### Aturan

Gunakan pola yang memperbolehkan empty state selama proses pengetikan:

```jsx
// BENAR: simpan empty string saat dikosongkan
value={config.my_field ?? ''}
onChange={(e) => set('my_field', e.target.value === '' ? '' : parseInt(e.target.value, 10))}

// ALTERNATIF: biarkan NaN tersimpan (number input merender NaN sebagai kosong)
value={config.my_field ?? ''}
onChange={(e) => set('my_field', parseInt(e.target.value, 10))}

// SALAH — || fallback mencegah pengosongan field:
onChange={(e) => set('my_field', parseInt(e.target.value, 10) || 30)}
```

`?? DEFAULT` pada `value={}` boleh untuk menghindari `undefined`, tapi JANGAN pakai `|| fallback` pada `onChange`.

### Referensi

BUG-060 — "Batas Waktu Checkout (menit)" snap ke 30 setiap kali user clear field untuk mengetik ulang.  
BUG-042 — Input qty di modal approve item snap ke 1 (pattern yang sama).

---

## STD-016 — Kolom yang Dipakai Scheduler/Job Wajib Ada di Idempotent Schema Guard `app.js`; Nama Kolom JOIN Harus Sesuai Schema

**Berlaku untuk:** Semua background job / scheduler yang membaca atau menulis kolom database; semua SQL query yang JOIN ke tabel lain.

### Masalah

**A — Kolom tidak ada di schema guard:**  
`TxnNotifJob.js` menggunakan `wa_expiry_notif_sent_at` yang hanya ada di `migrations/025_txn_expiry_notif.sql`. File migration tidak dieksekusi otomatis saat container start → kolom tidak ada → query gagal → `{ notified: 0 }` tanpa log yang mudah ditemukan.

**B — Nama kolom JOIN salah:**  
`TxnNotifJob.js` menggunakan `c.phone` tapi `customers` memiliki `c.phone_number`. Error "column does not exist" di-catch dan diabaikan (silent fail) — tidak ada notifikasi terkirim, tidak ada error yang terlihat.

### Aturan

**A. Schema Guard wajib di `app.js`:**
```js
// Tambahkan di server.listen callback, setelah guard lain
await dbQuery(
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS my_column TIMESTAMPTZ DEFAULT NULL`
);
```

**B. Verifikasi nama kolom saat JOIN — referensi kolom telepon:**

| Tabel | Kolom Telepon |
|---|---|
| `transactions` | `customer_phone` (VARCHAR 20) |
| `customers` | `phone_number` (VARCHAR 20) |
| `transaction_groups` | `customer_phone` |

Grep ke codebase jika ragu: cari query lain yang JOIN ke tabel tersebut sebagai referensi.

**C. Catch block kritis harus log error:**  
Blok `try { rows = result.rows } catch (err) { return { notified: 0 } }` yang tidak men-log error menyembunyikan bug. Selalu `logger.error(err.message)` sebelum return.

**D. Cakup semua status non-terminal yang bisa expired:**  
Jika `TxnExpireJob` mengexpire status X, maka `TxnNotifJob` harus juga meng-cover status X, kecuali status tersebut tidak pernah memiliki nomor telepon.

### Checklist Saat Membuat Job Baru

- [ ] Setiap kolom baru ada di `ADD COLUMN IF NOT EXISTS` guard di `app.js`
- [ ] Nama kolom JOIN diverifikasi ke schema aktual (bukan asumsi)
- [ ] Catch block path kritis men-log error message
- [ ] Semua status yang bisa expired dan memiliki phone number dicakup

### Referensi

BUG-061 — `TxnNotifJob` silent fail: `c.phone` salah + kolom `wa_expiry_notif_sent_at` tidak di schema guard + status `PENDING` tidak dicakup.

---

## STD-017 — Browser Metadata (Title + Favicon) Wajib Bersumber dari Admin Config via `usePublicConfig()`

**Berlaku untuk:** Semua metadata browser-level (title, favicon, atau apapun yang tampil di tab/bookmark) pada seluruh halaman SPA.

### Aturan

**A. Jangan hardcode title atau favicon di `index.html` secara permanen:**  
`index.html` hanya boleh berisi nilai fallback yang aktif sebelum config load. Nilai sebenarnya harus diambil dari `config.event_name` (title) dan `config.logo_url` (favicon).

**B. Gunakan satu null-render component terpusat (`AppMetaSync`):**  
Semua update metadata browser dikelola di satu tempat — komponen `AppMetaSync` di `App.jsx`. Jangan set `document.title` atau manipulasi favicon di komponen individual (halaman, layout, dll).

```jsx
// Pattern standar — AppMetaSync di App.jsx
function AppMetaSync() {
  const config = usePublicConfig();

  // Title
  useEffect(() => {
    if (config?.event_name) document.title = config.event_name;
  }, [config?.event_name]);

  // Favicon
  useEffect(() => {
    if (!config?.logo_url) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = config.logo_url;
    link.removeAttribute('type'); // biarkan browser detect format dari Content-Type
  }, [config?.logo_url]);

  return null;
}
```

**C. Guard truthy sebelum update:**  
Jangan update jika nilai belum ada (`if (!config?.logo_url) return`). Fallback `index.html` tetap aktif selama config belum load, saat offline, atau saat field belum diisi admin.

**D. `removeAttribute('type')` pada favicon:**  
Jika `index.html` memiliki `type="image/svg+xml"` pada `<link rel="icon">` dan logo yang diupload adalah PNG/JPG/WebP, browser akan menolak favicon. Selalu hapus atribut `type` saat update favicon secara programatik.

### Mapping Config → Metadata

| Browser metadata | Field admin | Config key |
|---|---|---|
| Tab title (`document.title`) | "Nama Event" | `config.event_name` |
| Favicon (`<link rel="icon">`) | "Logo Aplikasi" | `config.logo_url` |

### Pengecualian

Halaman yang perlu title spesifik per-route (misal: `"Bayar — Amazing Toys Fair"`) boleh set `document.title` secara lokal, tapi harus menggunakan `event_name` sebagai suffix: `document.title = \`${pageTitle} — ${config.event_name}\``.

### Referensi

CR-049 — Dynamic title dari `event_name`.  
CR-050 — Dynamic favicon dari `logo_url`.

---

## STD-018 — OTP Wajib Dikirim Setelah Record Database Tersimpan

**Berlaku untuk:** Semua flow yang menghasilkan OTP dan menyimpan data ke database (registrasi customer, reset password, dsb.).

### Aturan

**A. Simpan record database DULU, baru kirim OTP:**  
Urutan yang benar: `INSERT/UPDATE` ke DB → berhasil → `sendOTP()`. Jangan kirim OTP sebelum record yang menjadi acuan verifikasi tersimpan.

```js
// BENAR — DB dulu, OTP setelah
await query(`INSERT INTO pending_registrations ...`);
const waResult = await sendOTP(phone_number, otpCode, fullName);
if (waResult.status === 'FAILED') throw new AppError('Gagal mengirim OTP.', 503);
```

```js
// SALAH — OTP dulu sebelum DB
const waResult = await sendOTP(phone_number, otpCode, fullName); // ← bug
await query(`INSERT INTO pending_registrations ...`);            // ← terlambat
```

**B. Alasan — "Orphan OTP" scenario:**  
Jika OTP dikirim dulu dan INSERT DB kemudian gagal:
- Customer menerima OTP di WhatsApp
- Tidak ada record di DB → saat customer submit OTP → error "sesi tidak ditemukan"
- Customer kebingungan: OTP datang tapi registrasi tidak selesai

**C. Jika `sendOTP` gagal setelah DB save — biarkan record ada:**  
Pending record yang sudah tersimpan tidak perlu dihapus. Pada retry berikutnya, `ON CONFLICT DO UPDATE` akan generate OTP baru dan mengirim ulang. Record lama tidak menimbulkan masalah karena `expires_at` pendek (5 menit).

**D. Login flow — contoh yang benar (`loginCustomer`):**  
`customerOtpSvc.storeOTP(customerId, otpHash)` dipanggil sebelum `sendOTP()`. Ikuti pola yang sama.

### Checklist

- [ ] `INSERT`/`UPDATE` record verifikasi dipanggil dan `await`-ed sebelum `sendOTP()`
- [ ] Jika `sendOTP` gagal, pending record dibiarkan (bukan dihapus) agar user bisa retry
- [ ] `expires_at` pada pending record pendek (≤ 10 menit) agar tidak ada akumulasi data kotor

### Referensi

BUG-062 — `registerCustomer()`: `sendOTP()` dipanggil sebelum `INSERT INTO pending_registrations`, menyebabkan orphan OTP jika DB gagal.

---

## STD-019 — Tour Guide UI: Floating Card Mobile, Teks Bahasa Indonesia

**Berlaku untuk:** Semua komponen tour guide customer (`TourTooltip`, `TourWelcomeModal`, `TourNavigationButtons`, `TourProgressBar`)

**Latar Belakang:** BUG-063 — Mobile tooltip menggunakan `bottom: 0` edge-to-edge yang overlap dengan navigation bar; teks "Navigating..." dan "memesan makanan" tidak sesuai.

---

### Aturan

**A. Mobile tooltip WAJIB floating card, bukan bottom sheet edge-to-edge:**

```js
// BENAR — floating card dengan clearance dari nav bar
{
  position: 'fixed',
  bottom: 72,      // minimum 64px, memberi ruang nav bar (h-16 = 64px) + jarak
  left: 12,
  right: 12,
  borderRadius: 20, // semua corner bulat
}

// SALAH — bottom sheet tanpa clearance
{
  position: 'fixed',
  bottom: 0,        // ← overlap nav bar
  left: 0,
  right: 0,
  borderRadius: '16px 16px 0 0',  // ← hanya corner atas
}
```

**B. Semua teks UI tour wajib Bahasa Indonesia:**

| Teks Salah | Teks Benar |
|---|---|
| "Navigating..." | "Memuat..." |
| "memesan makanan" | "memesan produk" |
| "Langkah X dari Y" (Y = total absolut) | "Langkah X" + persentase |

**C. Visual identity — gunakan brand color `#3B5BDB → #748FFC`:**

- Accent strip gradient 4px di bagian atas card/modal
- Tombol "Lanjut" dan "Mulai Tur" menggunakan `linear-gradient(135deg, #3B5BDB, #748FFC)` bukan `bg-blue-600`
- Progress bar gradient, tinggi minimal 4px

**D. Touch target mobile minimum 40px:**

Tombol navigasi (Kembali, Lanjut, Selesai) harus memiliki `height: 40` atau minimal area tap 40px untuk aksesibilitas mobile.

**E. WelcomeModal — konten harus sesuai domain app:**

Teks "cara memesan" harus menyebutkan konteks yang benar. Untuk Amazing Toys Fair: "cara memesan produk". Jangan gunakan template generik yang menyebut "makanan", "minuman", dsb.

### Checklist

- [ ] Mobile tooltip `bottom ≥ 64px`, `left/right` minimal 8px, `borderRadius` semua corner
- [ ] Semua loading state text dalam Bahasa Indonesia
- [ ] Progress label tidak menampilkan total step absolut yang bisa melompat karena `skipIfMissing`
- [ ] Tombol menggunakan brand gradient, touch target ≥ 40px pada mobile
- [ ] WelcomeModal tidak mengandung teks domain yang salah

### Referensi

BUG-063 — Tour Guide mobile popup di `bottom: 0` overlap nav bar; "Navigating...", "memesan makanan", "dari 16" diperbaiki.

---

## STD-020 — Migration Deployment Checklist: Verifikasi Schema Sebelum CR Dianggap Selesai

**Berlaku untuk:** Semua CR yang menyertakan file migration SQL (`backend/migrations/*.sql`)

**Latar Belakang:** BUG-064 — Migration `022_group_checkout.sql` terlewat, meski semua code frontend dan backend sudah ada. Tabel `transaction_groups` + kolom `group_id` tidak ada di database, menyebabkan seluruh fitur Group Checkout gagal di runtime.

### Aturan

**A. Wajib verifikasi schema setelah apply migration:**

Setelah menjalankan file `.sql`, langsung cek bahwa objek yang dibuat benar-benar ada:

```bash
# Cek tabel baru
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -c "\dt <table_name>"

# Cek kolom baru
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='<table>' AND column_name='<col>';"

# Cek sequence baru
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -c "\ds <sequence_name>"
```

Jika query mengembalikan `Did not find any relation` atau baris kosong → migration belum diaplikasikan atau gagal diam.

**B. CR belum selesai jika migration belum diverifikasi:**

Urutan deployment yang benar untuk CR dengan migration:

```
1. Apply migration SQL ke database          ← WAJIB PERTAMA
2. Deploy backend code (docker cp / restart)
3. Deploy frontend (build + up)
4. Verifikasi schema via SELECT             ← WAJIB TERAKHIR
5. Baru tandai CR sebagai Done
```

**C. Migration tidak boleh terlewat meski code sudah ada:**

Adanya file `.jsx`, `.js`, dan route yang sudah tersedia **tidak membuktikan** migration sudah diaplikasikan. Code dan schema adalah dua layer yang independen — keduanya wajib dideploy.

**D. Urutan migration harus sequential:**

Jika migration N-1 terlewat tetapi migration N berhasil (karena menggunakan `IF NOT EXISTS` atau tidak ada dependency), sistem tidak akan error saat startup — bug hanya muncul saat fitur pertama kali digunakan. Pastikan semua nomor migration dalam urutan sudah diaplikasikan:

```bash
# Cek semua tabel yang seharusnya ada dari migration sebelumnya
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -c "\dt" | grep -E "vouchers|transaction_groups|..."
```

### Checklist per CR dengan Migration

- [ ] `docker cp migration.sql container:/tmp/ && docker exec container psql -f /tmp/migration.sql` berhasil tanpa error
- [ ] Tabel baru: `\dt <table>` menampilkan baris (bukan "Did not find any relation")
- [ ] Kolom baru: `information_schema.columns` mengembalikan nama kolom
- [ ] Sequence baru: `\ds <seq>` menampilkan baris
- [ ] Backend direstart setelah migration apply

---

## STD-021 — Input Validator Harus Sesuai Format Primary Key Aktual

**Berlaku untuk:** Semua endpoint backend yang menerima ID (transaction ID, product ID, group ID, dsb.) sebagai parameter body atau query string.

**Latar Belakang:** BUG-065 — Tombol "Konfirmasi Bayar" di Group Checkout selalu gagal 422 karena validator `body('transaction_ids.*').isUUID()` menolak format `TXN-YYYYMMDD-NNNNN`. Bug ini tidak terdeteksi di code review karena kode terlihat "logis" padahal formatnya salah.

### Aturan

**A. Periksa format aktual ID di database sebelum memilih validator:**

Sebelum menulis validator untuk field ID, jalankan query untuk memastikan format nyata:

```bash
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid \
  -c "SELECT transaction_id FROM transactions LIMIT 3;"
# Jika hasilnya TXN-20260613-00079 → gunakan .isString().notEmpty(), BUKAN .isUUID()
```

**B. Padankan validator dengan format ID yang berlaku di proyek ini:**

| Format ID | Contoh | Validator yang Benar |
|---|---|---|
| UUID (PostgreSQL native) | `550e8400-e29b-41d4-a716-446655440000` | `.isUUID()` |
| Transaction ID custom | `TXN-20260613-00079` | `.isString().notEmpty()` |
| Group ID custom | `GRP-20260613-0001` | `.isString().notEmpty()` |
| Product ID custom | `PRD-XXXX` atau UUID | `.isString().notEmpty()` |
| User/cashier/customer ID | UUID (dari auth system) | `.isUUID()` |

**C. Jangan asumsikan format hanya karena nama field mengandung kata "id":**

Field bernama `transaction_id`, `product_id`, `group_id` **tidak otomatis** berarti UUID. Di proyek ini, hanya ID pengguna (user, cashier, customer, helper) yang menggunakan UUID. Semua ID entitas bisnis (transaksi, produk, grup) menggunakan format custom string.

**D. Jika ada keraguan, gunakan `.isString().notEmpty()` sebagai default aman:**

`.isString().notEmpty()` menerima UUID maupun custom string — lebih permissive, validasi format detail cukup dilakukan di service layer jika diperlukan.

### Checklist — setiap kali menulis validator untuk field ID

- [ ] Cek format aktual ID di DB (`SELECT <id_column> FROM <table> LIMIT 3`)
- [ ] Jika format bukan UUID murni → gunakan `.isString().notEmpty()`
- [ ] Jika format adalah UUID (user/auth entity) → boleh gunakan `.isUUID()`
- [ ] Review semua validator `isUUID()` yang ada jika ada CR baru yang menyentuh endpoint terkait
- [ ] Endpoint terkait dicoba manual (atau fitur dicoba di UI) untuk konfirmasi end-to-end

---

## STD-022 — WS Broadcast: Setiap Event Harus Punya Subscriber di Frontend yang Relevan

**Berlaku untuk:** Semua fitur yang menggunakan WebSocket broadcast — di backend (`broadcastToCustomer`, `broadcastToTenant`, `broadcastToLeaders`) dan di frontend (`useWebSocket().subscribe`).

**Latar Belakang:** BUG-066 — `cashier.service.js` menambahkan event `GROUP_ORDER_PAID` untuk Group Checkout (CR-054), tapi `OrderTrackingPage.jsx` hanya subscribe `ORDER_PAID`. Halaman customer tidak auto-refresh selama berhari-hari sampai bug dilaporkan.

### Aturan

**A. Satu broadcast = satu subscriber (atau lebih):**

Setiap kali backend memanggil `broadcastToCustomer(...)`, `broadcastToTenant(...)`, atau `broadcastToLeaders(...)` dengan event name baru, harus ada komponen frontend yang:
1. Subscribe ke event tersebut
2. Bereaksi dengan benar (reload data, update state, dsb.)

**B. Payload broadcast WAJIB menyertakan entity identifier yang cukup:**

Komponen frontend perlu tahu apakah event ini relevan untuk entity yang sedang ditampilkan. Payload HARUS menyertakan salah satu dari:

| Broadcast target | Field wajib di payload |
|---|---|
| Customer → halaman order tertentu | `transactionId` atau `transactionIds` (array) |
| Tenant → halaman tenant tertentu | `transactionId` |
| Leaders → halaman summary | bebas (biasanya semua data di-reload) |
| Customer → group checkout | `transactionIds` (array semua TRX dalam group) |

**C. Jangan buat dua event name untuk hal yang sama:**

Contoh salah: `ORDER_PAID` (single) vs `GROUP_ORDER_PAID` (group). Halaman harus subscribe ke keduanya. Lebih baik gunakan satu event name yang konsisten:
- Jika logika yang sama berlaku di single dan group: gunakan `ORDER_PAID` untuk keduanya
- Jika perlu disambiguasi: gunakan satu event `ORDER_PAID` dengan field tambahan `isGroup: true`

**D. Untuk Group Checkout dan multi-entity broadcast, gunakan array:**

```js
// BENAR — subscriber bisa filter per-TRX
broadcastToCustomer(customerId, {
  event: 'GROUP_ORDER_PAID',
  transactionIds: ['TXN-...', 'TXN-...'],  // ← array wajib ada
  ...
});

// Frontend filter:
subscribe('GROUP_ORDER_PAID', (data) => {
  if (data?.transactionIds?.includes(transactionId)) fetchOrder();
});
```

### Checklist — setiap CR yang menyentuh WS broadcast

- [ ] Daftarkan semua `broadcastTo*` calls baru beserta event name dan payload yang akan dikirim
- [ ] Untuk setiap event baru: pastikan komponen frontend yang relevan sudah subscribe
- [ ] Verifikasi payload menyertakan identifier entitas yang cukup (transactionId, array, dsb.)
- [ ] Test end-to-end: trigger event → pastikan halaman auto-update tanpa manual refresh
- [ ] Jika menggunakan event name baru (berbeda dari existing): audit semua halaman yang seharusnya menerima event tersebut

### Referensi

BUG-064 — `022_group_checkout.sql` tidak diaplikasikan → `transaction_groups` dan `group_id` tidak ada → Group Checkout crash di runtime.

---

## STD-023 — Setiap Format ID Baru Wajib Ditest di Semua UI yang Menerima Input ID

**Berlaku untuk:** Semua CR yang menambahkan format ID baru — group invoice (`GRP-*`), voucher, kode promosi, dan format custom lain.

**Latar Belakang:** BUG-067 — Helper tidak bisa mengambil barang menggunakan group code `GRP-20260614-0001` karena `HandoverOutstandingPanel` filter hanya mencocokkan `transaction_id` (format `TXN-*`). Fitur lookup GRP sudah ada di backend (`_getGroupOrderForBooth`), tapi tidak terhubung ke UI.

### Aturan

**A. Audit semua UI yang menerima input ID saat memperkenalkan format baru:**

| Jenis UI | Contoh komponen | Apa yang harus diperiksa |
|---|---|---|
| Kolom search/filter | `HandoverOutstandingPanel`, `ApprovalQueueTab` | Filter logic: apakah format baru bisa dicocokkan? |
| QR scanner | `QrScannerModal` di Helper, Cashier, Tenant | Hasil scan diteruskan ke mana? Apa yang terjadi jika hasil adalah format baru? |
| URL param / route | `/cashier/bayar/:id`, `/pesanan/:id` | Apakah backend endpoint menerima format baru? |
| Input manual | Form dengan `transaction_id` field | Validasi frontend perlu diperbarui |

**B. Setiap format ID harus bisa "masuk" dari semua titik entry yang relevan:**

Untuk `GRP-*` (group invoice):
- Helper scan QR → harus membuka HandoverDetailView ✅
- Helper ketik kode → harus sama dengan scan QR ✅
- Customer page → tidak perlu (tidak ada interaksi customer langsung)

**C. Filter list DILARANG hardcode format ID:**

```js
// SALAH ❌ — hanya cocok TXN-*
const filtered = orders.filter(o =>
  o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase())
);

// BENAR ✅ — handle format lain secara eksplisit
const isGroupSearch = /^GRP-/i.test(searchQuery?.trim());
if (isGroupSearch) {
  // lookup langsung via API
} else {
  const filtered = orders.filter(o => o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()));
}
```

**D. Backend sudah mendukung bukan jaminan frontend bisa menggunakannya:**

`_getGroupOrderForBooth()` sudah ada, tapi `HandoverOutstandingPanel` tidak memanggilnya. Selalu verifikasi bahwa backend lookup terhubung ke semua UI yang relevan.

### Checklist — setiap CR yang menambahkan format ID baru

- [ ] Daftarkan semua format ID baru (contoh: `GRP-YYYYMMDD-NNNN`)
- [ ] List semua komponen frontend yang menerima input ID (search, scan, route param)
- [ ] Untuk setiap komponen: verifikasi bahwa format baru bisa masuk dan di-handle
- [ ] Test manual: ketik format baru di kolom search → pastikan ada response yang benar (bukan "tidak ditemukan" yang salah)
- [ ] Test QR scan: scan QR yang berisi format baru → pastikan hasilnya sama dengan ketik manual

---

## STD-024 — Komponen Struk Thermal: Pola Konsistensi Visual dan Print via DOM Ref

**Berlaku untuk:** Semua komponen struk thermal di `frontend/src/components/cashier/` — `ThermalReceipt.jsx` (single TXN), `ThermalGroupReceipt.jsx` (group invoice), dan komponen serupa di masa depan.

**Latar Belakang:** CR-062 — `PrintGroupReceiptButton` awalnya menghasilkan HTML inline string yang berbeda layout/font/ukuran dari `ThermalReceipt.jsx`, tidak menyertakan QR code, dan tidak bisa di-update tanpa duplikasi. Diganti dengan pola component-based + DOM ref.

### Aturan

**A. Semua komponen struk thermal WAJIB menggunakan konstanta yang sama:**

```js
const MONO = "'Courier New', Courier, monospace";  // font utama cetak thermal
const SANS = "Arial, Helvetica, sans-serif";        // font header/label

// Style objects S.* — copy dari ThermalReceipt.jsx, jangan redefine
const S = {
  root:       { width: '100%', fontFamily: MONO, fontSize: '12px', ... },
  logoZone:   { textAlign: 'center', ... },
  eventName:  { fontFamily: SANS, fontSize: '14px', fontWeight: '700', ... },
  // ... dst
};
```

Jangan gunakan Tailwind atau CSS class di dalam komponen struk — hanya inline style. Thermal printer tidak memproses stylesheet eksternal.

**B. Data event (nama, venue, tanggal) WAJIB dari `usePublicConfig()`, bukan props:**

```js
// SALAH ❌ — hardcode atau terima via props
<ThermalReceipt eventName="Amazing Toys Fair 2026" ... />

// BENAR ✅ — baca dari config publik
const publicCfg = usePublicConfig();
const eventName = publicCfg?.event_name || '';
```

`usePublicConfig()` sudah otomatis update saat admin save config. Tidak perlu restart.

**C. Komponen print button WAJIB menggunakan pola DOM ref (bukan HTML string inline):**

```jsx
// SALAH ❌ — HTML string inline, tidak bisa pakai React components (QRCode, dll)
const html = `<div>${boothRows}</div>`;
win.document.write(html);

// BENAR ✅ — render React component ke DOM, capture innerHTML
const receiptRef = useRef(null);

function handlePrint() {
  const el = receiptRef.current;
  if (!el) return;
  const html = `<!DOCTYPE html><html><head>
    <style>@page{size:80mm auto;margin:3mm}body{width:274px;...}</style>
  </head><body>${el.innerHTML}</body></html>`;
  const win = window.open('', '_blank', 'width=340,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

return (
  <>
    <button onClick={handlePrint}>Cetak</button>
    {/* Off-screen: tidak hidden (display:none mencegah render), tapi off-viewport */}
    <div ref={receiptRef}
         style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '274px', background: '#fff' }}
         aria-hidden="true">
      <ThermalGroupReceipt {...props} />
    </div>
  </>
);
```

**Kenapa `position:fixed` bukan `display:none`:** `display:none` bisa mencegah komponen child (misalnya `QRCodeSVG`) menghasilkan DOM yang bisa di-capture. `position:fixed` dengan koordinat offscreen memastikan komponen benar-benar dirender ke DOM.

**D. QR Code di struk thermal HARUS encode entity identifier yang bermakna:**

| Jenis struk | QR encode | Level error correction |
|---|---|---|
| Single TXN receipt | `transaction_id` (contoh: `TXN-20260615-00093`) | H (30%) |
| Group invoice receipt | `group_code` (contoh: `GRP-20260615-0001`) | H (30%) |

Level H digunakan karena thermal print bisa blur — error correction 30% masih bisa dibaca scanner.

**E. Lebar struk: 274px (bukan 280px atau 300px):**

274px = 80mm minus 3mm margin kiri kanan. Ini nilai yang sesuai untuk printer thermal 80mm standar. Jangan ubah tanpa test fisik.

### Checklist — setiap kali membuat komponen struk baru

- [ ] Import dan gunakan `MONO`, `SANS`, `S` dari `ThermalReceipt.jsx` (atau copy exact — jangan redefine dengan nilai berbeda)
- [ ] Event info baca dari `usePublicConfig()`, bukan props
- [ ] Lebar root: `width: '100%'` di komponen, `width: 274px` di print window CSS
- [ ] QR code meng-encode identifier yang sesuai (TXN-* untuk single, GRP-* untuk group)
- [ ] Print button gunakan pola `useRef` + `position:fixed` offscreen, bukan HTML string
- [ ] Test print: buka print dialog, pastikan preview 80mm, font Courier New tampil
- [ ] Test QR: scan QR di preview → pastikan hasilnya benar

### Referensi

- `ThermalReceipt.jsx` — referensi canonical untuk single TXN
- `ThermalGroupReceipt.jsx` — referensi canonical untuk group invoice
- `PrintGroupReceiptButton.jsx` — referensi canonical untuk print-via-DOM-ref pattern

---

## STD-025 — Query PostgreSQL dengan Satu Parameter di Dua Kolom Tipe Berbeda: Wajib Cast Eksplisit

**Berlaku untuk:** Semua query SQL di backend yang menggunakan satu parameter (`$N`) dalam kondisi `OR` melibatkan kolom bertipe berbeda — khususnya `uuid` vs `varchar`/`text`.

**Latar Belakang:** BUG-068 — `getGroupDetail` menggunakan `WHERE group_id = $1 OR group_code = $1`. PostgreSQL menginfer tipe `$1` sebagai `uuid` dari ekspresi pertama. Ketika `group_code = $1` dievaluasi (`character varying = uuid`), query gagal karena operator tidak ada.

### Aturan

**A. Jangan gunakan satu parameter `$N` untuk kolom dengan tipe berbeda tanpa cast:**

```sql
-- SALAH ❌ — PostgreSQL infer $1 sebagai uuid, lalu group_code = uuid gagal
WHERE group_id = $1 OR group_code = $1

-- BENAR ✅ — cast kolom uuid ke text; $1 diinfer sebagai text; keduanya text = text
WHERE group_id::text = $1 OR group_code = $1
```

**B. Aturan inferensi tipe PostgreSQL:**

PostgreSQL menentukan tipe parameter dari ekspresi **pertama** yang menggunakannya dalam query. Jika ekspresi pertama adalah `uuid_column = $1`, maka `$1` bertipe `uuid`. Semua perbandingan lain dengan `$1` harus kompatibel.

```
Urutan ekspresi      Tipe $1 yang diinfer   Ekspresi kedua         Hasil
─────────────────────────────────────────────────────────────────────────
uuid_col = $1        uuid                   varchar_col = $1       ❌ ERROR
varchar_col = $1     text                   uuid_col = $1          ✅ OK (implicit cast)
uuid_col::text = $1  text                   varchar_col = $1       ✅ OK
```

**C. Tipe yang sering menyebabkan masalah di proyek ini:**

| Kolom | Tipe | Aman dibandingkan dengan |
|---|---|---|
| `group_id`, `user_id`, `cashier_id`, `customer_id` | `uuid` | hanya `uuid` atau setelah `::text` |
| `transaction_id`, `group_code`, `product_id` | `varchar` | `text`, `varchar` — aman |

**D. Pattern aman untuk lookup "by id OR by code":**

```sql
-- Pattern: cari by UUID primary key ATAU by human-readable code
-- Selalu cast UUID ke text agar parameter diinfer sebagai text
WHERE entity_id::text = $1 OR entity_code = $1
```

**E. Alternatif: pisahkan menjadi dua parameter dengan cast eksplisit di SQL:**

Jika perlu lookup berdasarkan format yang sudah diketahui, gunakan logika di aplikasi:

```js
// Di service layer — tentukan kolom berdasarkan format input
const isUUID = /^[0-9a-f-]{36}$/.test(identifier);
const whereClause = isUUID ? 'WHERE group_id = $1' : 'WHERE group_code = $1';
```

Namun untuk kode yang lebih ringkas dan aman, `entity_id::text = $1 OR entity_code = $1` lebih disukai.

### Checklist — setiap kali menulis query lookup dengan OR pada kolom berbeda tipe

- [ ] Identifikasi tipe masing-masing kolom yang dibandingkan dengan parameter yang sama
- [ ] Jika ada kolom `uuid` dalam kondisi `OR` bersama kolom `varchar/text`:
  - Cast kolom UUID ke text: `uuid_column::text = $N`
  - Tempatkan ekspresi ini **pertama** agar parameter diinfer sebagai text
- [ ] Test query langsung di psql dengan nilai non-UUID (contoh: `'GRP-...'`) untuk verifikasi
- [ ] Jika query existing punya pola `WHERE uuid_col = $1 OR varchar_col = $1` → fix sebelum menambahkan call site baru yang mengirim non-UUID

### Referensi

BUG-021 (STD-012) — tipe kolom FK harus sama dengan kolom yang direferensi.

---

## STD-026 — Odoo: Deteksi Nama Field Dinamis via `fields_get`, Jangan Hardcode

**Berlaku untuk:** Semua field di Odoo model yang namanya bisa berbeda antar instance atau versi (`sale.order.line`, `account.move.line`, dsb.)

**Latar Belakang:** RC-14 → RC-19 — kode selalu mengirim `tax_id` (hardcoded) tapi Odoo instance `demo-260614a` menggunakan `tax_ids`. Semua error "Invalid field 'tax_id'" akar masalahnya adalah nama field yang salah.

### Aturan

**A. Gunakan `fields_get` untuk deteksi nama field di startup:**

```javascript
// Di resolveStartupRefs() — odoo.client.js
// BENAR ✅ — fields_get lebih reliable di Odoo SaaS vs ir.model.fields
const solTaxCheck = await callKw('sale.order.line', 'fields_get',
  [['tax_id', 'tax_ids', 'taxes_id']], { attributes: ['type'] });
const taxLineFieldName = 'tax_id'   in solTaxCheck ? 'tax_id'
  : 'tax_ids'  in solTaxCheck ? 'tax_ids'
  : 'taxes_id' in solTaxCheck ? 'taxes_id'
  : null;
_cache.taxLineFieldName = taxLineFieldName;  // 'tax_ids' pada demo-260614a

// SALAH ❌ — hardcode nama field
lineVals.tax_id = [[6, 0, [taxId]]];   // gagal jika instance pakai 'tax_ids'
```

**B. Kenapa bukan `ir.model.fields`?**

`ir.model.fields` search_read pada Odoo Online SaaS dapat di-filter oleh company context atau dibatasi akses — bisa mengembalikan 0 hasil meski field ada. `fields_get` memanggil method Python langsung pada class model, tidak kena restriction yang sama.

**C. Gunakan hasil deteksi secara konsisten:**

```javascript
// Di order.push.js lineVals — gunakan nama yang terdeteksi
if (cache.defaultTaxId && cache.taxLineFieldName) {
  lineVals[cache.taxLineFieldName] = [[6, 0, [cache.defaultTaxId]]];  // 'tax_ids'
}
```

**D. Wajib log hasil deteksi di startup:**

```json
{ "taxLineFieldName": "tax_ids", "hasTaxIdField": true }
```

### Checklist

- [ ] Field name dikandidatkan dalam list (`fields_get` dengan array kandidat), bukan satu nama
- [ ] Hasil deteksi dicache di `_cache.taxLineFieldName`
- [ ] Semua penggunaan field gunakan `cache.taxLineFieldName` (dinamis)
- [ ] Startup log menyertakan `taxLineFieldName` dan `hasTaxIdField` untuk verifikasi

### Referensi

RC-19 (BUG-010) — `ir.model.fields` mengembalikan 0 hasil → kode menyimpulkan field tidak ada → tax tidak dikirim. `fields_get` mendeteksi `tax_ids` sebagai nama field yang benar.

---

## STD-027 — Odoo: Self-Healing untuk Optional Fields (Try → Detect → Disable → Retry)

**Berlaku untuk:** Semua field optional yang dikirim ke Odoo yang mungkin tidak ada di semua instance.

**Latar Belakang:** RC-17 (BUG-009) — `sale.order.create` dengan `tax_id` ditolak Odoo → loop infinite karena tidak ada recovery. Pattern self-healing mencegah hal ini.

### Aturan

**A. Saat `sale.order.create` menolak field — recovery inline, JANGAN null `taxLineFieldName`:**

```javascript
} catch (err) {
  const _taxField = cache.taxLineFieldName;
  const rejected = _taxField && err.message?.includes(`Invalid field '${_taxField}'`);
  if (rejected) {
    // BENAR ✅ — strip dari vals, retry inline
    // taxLineFieldName TIDAK di-null — biarkan Step 1.5 mencoba write()
    for (const line of orderVals.order_line) { delete line[2][_taxField]; }
    odooOrderId = await odoo.create('sale.order', orderVals);  // retry

    // SALAH ❌ — null taxLineFieldName di sini memblokir Step 1.5
    // cache.taxLineFieldName = null;
  }
}
```

**B. Saat `sale.order.line.write` menolak field — BARU disable untuk session:**

```javascript
} catch (taxErr) {
  const fieldRejected = taxErr.message?.includes(`Invalid field '${_taxField15}'`);
  if (fieldRejected) {
    cache.taxLineFieldName = null;   // disable untuk semua order berikutnya
    cache.hasTaxIdField    = false;
    logger.warn('tax field not writable on this instance — disabling for session');
  } else {
    logger.warn('tax write failed — product default tax will apply', { error: taxErr.message });
  }
}
```

**C. Klasifikasi respons Odoo terhadap optional field:**

| Situasi | Tindakan |
|---------|----------|
| Create tolak field | Strip dari vals + retry create inline (Step 1.5 masih berjalan) |
| Write tolak field | Disable `taxLineFieldName` + `hasTaxIdField = false` untuk session |
| Network/timeout | Masuk retry queue |
| 429 rate limit | Exponential backoff (sudah di `callKw`) |

**D. Jangan `cb.recordFailure('odoo')` untuk "Invalid field" error:**

Error "Invalid field" bukan Odoo down — jangan trip circuit breaker untuk validation error. `recordFailure` hanya untuk network error, timeout, 5xx.

### Checklist

- [ ] Create failure: strip field + retry inline, `taxLineFieldName` tetap intact
- [ ] Write failure "Invalid field": null `taxLineFieldName`, log warning, order tetap lanjut
- [ ] Write failure lain (network, permission): log warning tanpa null `taxLineFieldName`
- [ ] Tidak ada `cb.recordFailure` untuk "Invalid field" error

### Referensi

RC-17 (BUG-009) — loop karena tidak ada inline recovery.  
RC-18 (BUG-010) — Step 1.5 write setelah create.  
RC-19 (BUG-010) — RC-17 tidak boleh null `taxLineFieldName`.

---

## STD-028 — Odoo: Urutan Step Order Push dan Field `note`

**Berlaku untuk:** `integration/src/services/order.push.js` dan semua modifikasi ke alur order push.

### Urutan Step Wajib

```
Step 1:   sale.order.create (draft)
            ├─ Sertakan tax field (jika taxLineFieldName terdeteksi)
            └─ RC-17: jika Odoo tolak → strip field + retry inline

Step 1.5: sale.order.line write (tax override, sebelum confirm)
            ├─ WAJIB dijalankan jika taxLineFieldName ada (terlepas RC-17 fired atau tidak)
            └─ Jika write juga gagal "Invalid field" → disable taxLineFieldName untuk session

Step 2:   action_confirm → state = 'sale'
Step 3:   action_lock → state = 'done'

[B]:      sale.advance.payment.inv (wizard) → account.move
            └─ Odoo otomatis copy tax dari sale.order.line → tidak perlu write terpisah

[C]:      account_move.action_post → invoice posted
[D]:      account.payment.register (wizard) → payment registered
```

**Step 1.5 HARUS sebelum action_confirm** — setelah confirm, SO di-lock dan taxes di-copy ke invoice. Tax yang salah saat confirm → invoice dengan tax salah.

### Format Field `note` Wajib

Transaction ID SELALU di posisi pertama:

```javascript
const paymentNote = [
  `TXN: ${transactionId}`,                              // ← SELALU posisi pertama
  `Payment Method: ${txn.payment_method || 'UNKNOWN'}`,
  `Ref: ${txn.payment_reference || '-'}`,
  `Cash Received: Rp ${txn.cash_received || 0}`,
  `Change: Rp ${txn.cash_change || 0}`,
  `Cashier: ${txn.cashier_name || '-'}`,
  `Paid At: ${txn.paid_at || '-'}`,
].join(' | ');
```

**Kenapa TXN di posisi pertama:** Odoo list view memotong field `note` — item pertama harus identifier utama agar order bisa di-trace tanpa buka detail.

### Referensi

RC-18, RC-19 (BUG-010) — Step 1.5 pattern.  
RC-20 (NOTE-001) — TXN ID di posisi pertama dalam paymentNote.

---

## STD-029 — Odoo: Sumber Konfigurasi Tax ID

**Berlaku untuk:** `integration/src/clients/odoo.client.js` fungsi `loadCredentials()`.

### Aturan

Tax ID Odoo SELALU dibaca dari `tax_config` (primary), fallback ke `integration_config`.

```javascript
// BENAR ✅ — baca keduanya secara parallel
const [integRow, taxRow] = await Promise.all([
  db.query("SELECT value FROM system_settings WHERE key = 'integration_config'"),
  db.query("SELECT value FROM system_settings WHERE key = 'tax_config'"),
]);
const taxIdFromTaxConfig = taxCfg?.odoo_tax_id ? Number(taxCfg.odoo_tax_id) : null;
const defaultTaxId = taxIdFromTaxConfig                              // primary
  || (cfg.odoo_default_tax_id ? Number(cfg.odoo_default_tax_id) : null);  // fallback

// SALAH ❌ — hanya baca integration_config
return { defaultTaxId: cfg.odoo_default_tax_id ? Number(...) : null };  // integration_config.odoo_default_tax_id = null
```

**Source of Truth Tax:**

| Source | Field | Diisi via |
|--------|-------|-----------|
| `tax_config.odoo_tax_id` | **Primary** | Admin → Pajak & SPT |
| `integration_config.odoo_default_tax_id` | Fallback | Admin → Integrasi |

### Checklist

- [ ] `loadCredentials()` query dua table: `tax_config` dan `integration_config`
- [ ] `tax_config.odoo_tax_id` digunakan sebagai primary
- [ ] Startup log menampilkan `defaultTaxId` — verifikasi angka Tax ID benar

### Referensi

RC-16 (BUG-008) — `loadCredentials()` hanya baca `integration_config`, padahal Tax ID ada di `tax_config`.

---

## STD-030 — SELECT Eksplisit di List Query Wajib Disinkronkan Saat Migrasi Kolom Baru

**Berlaku untuk:** Semua fungsi `list`/`getAll` di backend yang menggunakan SELECT eksplisit (bukan `SELECT *`) pada tabel yang kolom barunya ditambahkan via migration.

**Latar Belakang:** BUG-011 (RC-21) — `adminListProducts()` menggunakan SELECT eksplisit yang tidak menyertakan `is_preorder` dan `preorder_note`. Kolom-kolom ini ditambahkan oleh migration 029, tapi SELECT list query tidak diperbarui. Akibatnya, form Edit Produk selalu menampilkan toggle Pre-Order = OFF meskipun DB menyimpan `true`.

### Aturan

**A. Setiap migrasi `ADD COLUMN` HARUS diikuti review SELECT eksplisit yang ada:**

Saat menambahkan kolom baru ke tabel, cari semua SELECT query untuk tabel tersebut yang menggunakan daftar kolom eksplisit (bukan `*`) dan tambahkan kolom baru ke dalamnya jika relevan untuk frontend.

```javascript
// SALAH ❌ — kolom baru tidak ditambahkan ke list query
SELECT p.product_id, p.product_name, ..., p.updated_at,
       t.tenant_id, t.tenant_name   -- is_preorder tidak ada

// BENAR ✅ — kolom baru disertakan
SELECT p.product_id, p.product_name, ..., p.updated_at,
       p.is_preorder, p.preorder_note,   -- ← tambahkan setelah migrasi
       t.tenant_id, t.tenant_name
```

**B. Perbedaan `RETURNING *` vs SELECT eksplisit:**

| Operasi | Kolom baru otomatis masuk? |
|---------|--------------------------|
| `INSERT ... RETURNING *` | **Ya** — `*` include semua kolom |
| `UPDATE ... RETURNING *` | **Ya** — `*` include semua kolom |
| `SELECT col1, col2, ... FROM` | **Tidak** — harus ditambah manual |
| `SELECT * FROM` | **Ya** — tapi tidak direkomendasikan untuk production list query |

**C. Cara mendeteksi SELECT yang perlu diupdate:**

Setelah menulis migration `ADD COLUMN IF NOT EXISTS new_col`, grep nama tabel di seluruh `backend/src/`:

```bash
grep -rn "FROM products" backend/src/
# Review setiap hasil — apakah SELECT-nya eksplisit dan belum include kolom baru?
```

**D. Kolom yang "hanya untuk form edit" tetap harus ada di list query:**

Frontend biasanya mengisi form edit dari data yang sudah ada di list state (bukan fetch ulang per item). Jika kolom hanya dibutuhkan saat edit, tetap harus ada di list query — jika tidak, form akan selalu menampilkan nilai default (false/null/empty).

**E. Checklist migrasi kolom baru yang ditampilkan di form:**

- [ ] Tambahkan `ADD COLUMN IF NOT EXISTS` di schema guard `app.js`
- [ ] Grep nama tabel di `backend/src/` — temukan semua SELECT eksplisit
- [ ] Tambahkan kolom baru ke setiap SELECT eksplisit yang relevan
- [ ] Verifikasi response API via `curl` atau DB query bahwa kolom baru muncul di response
- [ ] Test frontend: form edit menampilkan nilai yang tersimpan di DB (bukan selalu default)

### Referensi

BUG-011 / RC-21 — `adminListProducts()` tidak include `is_preorder` → toggle Pre-Order selalu OFF di form edit.  
STD-010 — Schema guard wajib di `app.js` untuk kolom baru.

---

## STD-031 — Pre-Order: Routing Mode dan Stock Deduction Invariants

**Berlaku untuk:** Semua fungsi yang membuat transaksi (`createOrder`, `createHelperOrder`) dan semua fungsi yang mengurangi stok produk.

**Latar Belakang:** BUG-050-01 — TXN-20260616-00163 (Astro Boy) dibuat dengan `order_type='REGULAR'` meskipun produk `is_preorder=true`. Root cause: (A) tidak ada guard yang mencegah pre-order masuk via SELF_ORDER mode — sehingga transaksi PREORDER tercipta tanpa `shipping_*` fields dan stuck; (B) `createOrder()` SELF_ORDER tidak punya guard `!p.is_preorder` pada stock deduction — stok pre-order ikut berkurang.

---

### Aturan A — Pre-Order Wajib Melalui HELPER Mode

Pre-order items **dilarang** diproses via SELF_ORDER mode. Pelanggan tidak bisa mengisi alamat pengiriman sendiri — harus diisi oleh Helper.

| Mode | Pre-order diizinkan? | Siapa isi shipping? |
|---|---|---|
| `SELF_ORDER` | ❌ Ditolak | — |
| `HELPER_APPROVE` | ✅ Ya (all-preorder cart) | Helper saat approval |
| `HELPER_INPUT` (`createHelperOrder`) | ✅ Ya | Helper saat buat order |

**Guard wajib di `createOrder()` (SELF_ORDER path):**

```javascript
// Wajib ada sebelum doCheckout di CartPage.jsx (frontend)
if (!isApproveMode) {
  const preorderItems = items.filter(i => i.is_preorder);
  if (preorderItems.length > 0) {
    setError(`Produk pre-order tidak bisa dipesan mandiri: ${names}. Hubungi Helper.`);
    return;
  }
}

// Wajib ada di createOrder() (backend) — safety net
if (!isHelperApproveMode) {
  const preorderItems = items.filter(i => productMap[i.product_id]?.is_preorder);
  if (preorderItems.length > 0) {
    throw new AppError(
      `Produk pre-order tidak bisa dipesan mandiri: ${names}. Silakan minta bantuan Helper.`,
      422, { preorderProductIds: preorderItems.map(i => i.product_id) }
    );
  }
}
```

---

### Aturan B — Stock Deduction Invariant: Pre-Order Tidak Pernah Kurangi Stok

**Di seluruh codebase, setiap UPDATE stock_quantity harus diproteksi dengan `!p.is_preorder`.**

```javascript
// SALAH ❌ — deduct tanpa guard
if (!isHelperApproveMode) {
  await client.query(`UPDATE products SET stock_quantity = stock_quantity - $1 ...`)
}

// BENAR ✅ — guard is_preorder wajib
if (!isHelperApproveMode && !p.is_preorder) {
  await client.query(`UPDATE products SET stock_quantity = stock_quantity - $1 ...`)
}
```

**Titik stock deduction yang harus punya guard ini:**

| Fungsi | File | Guard ada? |
|---|---|---|
| `createOrder()` — SELF_ORDER path | `orders.service.js` | ✅ (BUG-050-01) |
| `createHelperOrder()` | `helper.service.js` | ✅ |
| `approveOrder()` | `helper.service.js` | ✅ |
| `approveItem()` | `helper.service.js` | ✅ |

---

### Aturan C — Shipping Fields Wajib Ada untuk Transaksi PREORDER

Setiap transaksi dengan `order_type = 'PREORDER'` **harus** memiliki `shipping_name`, `shipping_phone`, dan `shipping_address` terisi sebelum masuk status `AWAITING_SHIPMENT`.

- Di `createHelperOrder()`: divalidasi saat order dibuat (shippingName/shippingAddress required)
- Di `approveOrder()` HELPER_APPROVE: divalidasi saat Helper approve

Jika shipping fields kosong pada PREORDER transaction, fix via DB update manual atau endpoint admin.

---

### Aturan D — Atomic Deployment: Migration + App Code Harus Naik Bersamaan

BUG-050-01 terjadi karena migration 029 jalan lebih dulu (kolom `is_preorder` sudah ada, produk sudah di-toggle) sebelum app code (`createOrder` dengan `isPreorderCart` check) ter-deploy.

```
❌ Urutan salah:
  1. docker exec psql migration029.sql    ← is_preorder ada di DB
  2. Toggle produk Astro Boy = preorder   ← produk is_preorder = true
  3. Customer place order                 ← app code lama → isPreorderCart = false → REGULAR
  4. docker compose up (app code baru)    ← terlambat

✅ Urutan benar (sesuai STD-020):
  1. Deploy app code baru                 ← createOrder punya isPreorderCart check
  2. docker exec psql migration029.sql    ← is_preorder kolom tersedia
  3. Toggle produk Astro Boy = preorder   ← produk is_preorder = true
  4. Customer place order                 ← order_type = 'PREORDER' ✅
```

### Checklist Setiap Kali Menambah Flag Produk Baru yang Mempengaruhi Order Flow

- [ ] Backend: Flag baru di-SELECT di `createOrder()` dan `createHelperOrder()` product query
- [ ] Backend: Guard di SELF_ORDER path jika flag mencegah self-order
- [ ] Backend: Stock deduction diproteksi jika flag memengaruhi stok behavior
- [ ] Frontend: Flag disimpan di CartContext (`addItem`) dan divalidasi di `handlePlaceOrder`
- [ ] Deployment: app code dideploy **sebelum** atau **bersamaan** dengan migration

### Referensi

BUG-050-01 — TXN-20260616-00163 Astro Boy tidak di-treat sebagai PREORDER.  
CR-050 — Implementasi fitur pre-order (Sub-feature A + B).  
STD-020 — Deployment order wajib: migration setelah app code.

---

## STD-032 — Pre-Order Approval: order_type Detection dan Helper UI Invariants

**Berlaku untuk:** `getApprovalQueue`, `approveOrder` di `helper.service.js`, `ApprovalQueueTab.jsx`, dan semua komponen yang membaca/memproses pre-order transactions dari sisi Helper.

**Latar Belakang:** BUG-050-02 — TXN-20260616-00167 menimbulkan error "Nama penerima wajib diisi untuk Pre-Order." karena `order_type='REGULAR'` di DB (legacy transaction) sehingga frontend tidak menampilkan shipping form, namun backend mendeteksi pre-order dari DB-level dan melempar 422.

---

### Aturan E — Approval Queue Harus Mengembalikan is_preorder per Item

`getApprovalQueue` wajib menyertakan `p.is_preorder` di items SELECT agar frontend dapat:
1. Menampilkan badge PRE-ORDER per item di `ItemRow`
2. Melakukan runtime correction `order_type` jika bernilai salah

```javascript
// WAJIB — items SELECT di getApprovalQueue:
SELECT ti.item_id, ..., p.is_preorder, ...
FROM transaction_items ti JOIN products p ON ...
```

---

### Aturan F — Runtime order_type Correction dari Items

Baik di `getApprovalQueue` (service layer) maupun di `approveOrder`, jika `order_type !== 'PREORDER'` namun ada item dengan `is_preorder = TRUE`, wajib dianggap dan di-set sebagai PREORDER:

```javascript
// Di getApprovalQueue (runtime, tidak write ke DB):
if (txn.order_type !== 'PREORDER' && txn.items.some(i => i.is_preorder)) {
  txn.order_type = 'PREORDER';
}

// Di approveOrder (write ke DB + atomik):
const preorderCheck = await client.query(`SELECT EXISTS(... p.is_preorder = TRUE ...) AS has_preorder`, ...);
if (preorderCheck.rows[0].has_preorder) {
  isPreorderTxn = true;
  await client.query(`UPDATE transactions SET order_type = 'PREORDER' WHERE transaction_id = $1`, ...);
}
```

Tujuan: legacy transactions yang dibuat selama window deployment non-atomik tetap ditangani dengan benar.

---

### Aturan G — Shipping Form Wajib Tampil Sebelum Approval Pre-Order

Di `ApprovalQueueTab.jsx` (dan komponen approval lain), sebelum helper mengonfirmasi "Setujui Semua":
- Jika `isPreorder = true` → shipping form **wajib** tampil dalam modal
- Button konfirmasi **wajib** disabled sampai `shipping_name`, `shipping_phone`, `shipping_address` terisi
- Shipping data yang diisi wajib dikirim ke endpoint `POST .../approve` sebagai flat fields (`shipping_name`, `shipping_phone`, dll.)

---

### Aturan H — "Approval Pre-Order" Tab untuk PAID Pre-Orders

Helper page wajib memiliki sub-menu "Approval Pre-Order" di seksi Approval yang menampilkan transaksi dengan `order_type = 'PREORDER'` AND `status = 'PAID'` untuk booth helper bersangkutan.

- Backend: `GET /api/v1/helper/preorder-paid` → `getPreorderPaidOrders(helperTenantId)`
- Frontend: `PreorderApprovalPanel` component di `HelperPage.jsx`
- Fungsi: monitoring/tracking pre-order yang sudah dibayar dan menunggu proses pengiriman

### Referensi

BUG-050-02 — TXN-20260616-00167 error "Nama penerima wajib diisi untuk Pre-Order."  
STD-031 — Pre-Order routing mode dan stock deduction invariants.  
CR-050 — Implementasi fitur pre-order.

---

## STD-033 — Pre-Order Stepper: Step Key = Status Saat Step AKTIF

**Berlaku untuk:** Semua komponen progress stepper untuk pre-order (`OrderTrackingPage.jsx` dan komponen sejenis di masa depan).

**Latar Belakang:** BUG-051-01 — TXN-20260616-00167, stepper semua grey karena step-key menggunakan `'PAID'` untuk step "Pembayaran". Saat `order.status = 'PENDING'`, `ORDER.indexOf('PENDING') = -1` → tidak ada step yang ter-highlight.

---

### Aturan I — Step Key = Status yang Membuat Step Menjadi CURRENT

Setiap entry dalam array step harus menggunakan `key` = status transaksi yang membuat step tersebut **berstatus current (active)**:

```javascript
// BENAR ✅
{ key: 'PENDING',          label: 'Pembayaran',        icon: '💳' },  // current saat belum bayar
{ key: 'PAID',             label: 'Menunggu Kirim',    icon: '📦' },  // current setelah bayar
{ key: 'AWAITING_SHIPMENT',label: 'Dalam Pengiriman',  icon: '🚚' },
{ key: 'ARRIVED',          label: 'Tiba di Indonesia', icon: '📍' },
{ key: 'PREORDER_HANDOVER',label: 'Serah Terima',      icon: '🤝' },
{ key: 'COMPLETED',        label: 'Selesai',           icon: '✅' },

// SALAH ❌ — 'PAID' sebagai key step "Pembayaran"
{ key: 'PAID', label: 'Pembayaran', ... }
// Efek: saat status='PENDING', curIdx=-1, semua step grey
```

---

### Aturan J — Petakan Status "Sibling" ke Key Terdekat

Status yang tidak ada di array step harus dipetakan ke step terdekat secara semantik sebelum `indexOf`:

```javascript
// PENDING_APPROVAL = stage sebelum bayar → sama dengan PENDING
const mappedStatus = order.status === 'PENDING_APPROVAL' ? 'PENDING' : order.status;
const curIdx = ORDER.indexOf(mappedStatus);
```

Aturan umum: Jika ada status X yang tidak punya step sendiri namun semantically sama dengan step Y, petakan X → Y sebelum `indexOf`.

---

### Aturan K — Label Stepper Harus Konsisten Lintas Komponen

Labels stepper pre-order yang disepakati (per CR-050 + BUG-051-01):

| Status (step key) | Label |
|---|---|
| `PENDING` / `PENDING_APPROVAL` | Pembayaran |
| `PAID` | Menunggu Kirim |
| `AWAITING_SHIPMENT` | Dalam Pengiriman |
| `ARRIVED` | Tiba di Indonesia |
| `PREORDER_HANDOVER` | Serah Terima |
| `COMPLETED` | Selesai |

### Referensi

BUG-051-01 — Pre-order stepper semua grey untuk TXN-20260616-00167 (status PENDING).  
STD-032 — Pre-Order Approval invariants.  
CR-050 — Status flow pre-order.

---

## STD-034 — Pre-Order Admin Page: Setiap Status Harus Memiliki Tab dan Transisi

**Berlaku untuk:** `PreorderShipmentPage.jsx`, `preorder.service.js`, `preorder.router.js`, dan semua komponen admin yang menampilkan/memproses pre-order.

**Latar Belakang:** BUG-051-02 — TXN-20260616-00167 status PAID tidak muncul di `/admin/preorder` karena tidak ada tab dan tidak ada endpoint transisi `PAID → AWAITING_SHIPMENT`.

---

### Aturan L — Setiap Status dalam Flow Harus Punya Tab di Admin Page

Flow pre-order: `PAID → AWAITING_SHIPMENT → ARRIVED → PREORDER_HANDOVER → COMPLETED`

Setiap status yang bisa di-ACTION oleh admin WAJIB punya tab di `PreorderShipmentPage.jsx`. Tidak boleh ada status yang "invisible" (tidak tampil di tab manapun).

| Status | Tab | Action |
|---|---|---|
| `PAID` | Sudah Dibayar | Proses Pengiriman (→ AWAITING_SHIPMENT) |
| `AWAITING_SHIPMENT` | Menunggu Kirim | Konfirmasi Sudah Sampai (→ ARRIVED) |
| `ARRIVED` | Barang Sudah Sampai | (menunggu Helper serah terima) |
| `COMPLETED` | Selesai | — |

---

### Aturan M — Setiap Transisi Status Wajib Punya Endpoint Sendiri

Setiap perpindahan status `A → B` dalam flow pre-order WAJIB memiliki:
1. Fungsi di `preorder.service.js`
2. Route `PATCH /preorder/:txnId/<action>` di `preorder.router.js`
3. Export di `frontend/src/api/preorder.js`
4. Button + confirmation modal di `PreorderShipmentPage.jsx`

Jika transisi baru ditambahkan di flow (misal status baru antara PAID dan AWAITING_SHIPMENT), checklist ini WAJIB dilengkapi.

---

### Aturan N — statusMap di getPreorderList Harus Sinkron dengan Status Flow

Setiap kali status baru ditambahkan ke enum `txn_status_enum` yang relevan dengan pre-order, `statusMap` di `getPreorderList` WAJIB diperbarui:
```javascript
const statusMap = {
  paid:      ['PAID'],           // ← WAJIB ada
  awaiting:  ['AWAITING_SHIPMENT'],
  arrived:   ['ARRIVED'],
  completed: ['COMPLETED'],
  active:    ['PAID', 'AWAITING_SHIPMENT', ...],  // ← sertakan semua status aktif
};
```

### Referensi

BUG-051-02 — PAID pre-orders tidak muncul di /admin/preorder.  
STD-033 — Pre-Order stepper step key invariants.  
CR-050 — Status flow pre-order lengkap.

---

## STD-035 — Status Guard Kasir: Gunakan CASHIER_EDITABLE, Bukan Hardcode 'PENDING'

**Berlaku untuk:** Semua fungsi backend yang mengizinkan kasir memodifikasi transaksi aktif, dan semua guard UI di `PaymentPage.jsx` (atau halaman kasir setara).

**Latar Belakang:** BUG-069 + BUG-070 — Frontend menampilkan fitur kasir (product browser, voucher, hapus item) hanya untuk status `PENDING`. Transaksi HELPER_INPUT flow masuk dengan status `RESERVED`. Akibatnya fitur tidak tampil (BUG-069). Saat frontend diperluas ke `isEditable`, backend masih hardcode `status !== 'PENDING'` sehingga API selalu 422 (BUG-070).

### Aturan

**A. Set status "kasir bisa edit" wajib konsisten antara frontend dan backend:**

```javascript
// ✅ BENAR — gunakan set yang sama di kedua sisi
const CASHIER_EDITABLE = ['PENDING', 'RESERVED', 'WAITING_PAYMENT'];

// Backend guard (orders.service.js)
if (!CASHIER_EDITABLE.includes(txn.status))
  throw new AppError(`Hanya transaksi aktif (${CASHIER_EDITABLE.join('/')}) yang dapat diubah.`, 422);

// Frontend gate (PaymentPage.jsx)
const isEditable = CASHIER_EDITABLE.includes(txn?.status);
{isEditable && <ProductBrowser />}
{isEditable && !txn.voucher_code && <VoucherInput />}
{isEditable && <DeleteButton />}
```

```javascript
// ❌ SALAH — hardcode hanya PENDING
if (txn.status !== 'PENDING') throw new AppError('Hanya transaksi PENDING...');
const isPending = txn?.status === 'PENDING';
{isPending && <ProductBrowser />}  // tidak muncul untuk RESERVED
```

**B. Mapping status → siapa yang bisa modifikasi:**

| Status | Flow Asal | Kasir bisa edit? |
|---|---|---|
| `PENDING` | SELF_ORDER, pasca-approval Helper | ✅ Ya |
| `RESERVED` | HELPER_INPUT (order dari Helper) | ✅ Ya |
| `WAITING_PAYMENT` | Transisi intermediary | ✅ Ya |
| `PENDING_APPROVAL` | HELPER_APPROVE sebelum disetujui | ❌ Tidak |
| `PAID`, `CANCELLED`, `EXPIRED`, `COMPLETED` | Terminal | ❌ Tidak |

**C. Fungsi backend yang terdampak CASHIER_EDITABLE:**

| Fungsi | File | Guard |
|---|---|---|
| `addItemToTransaction()` | `orders.service.js` | `CASHIER_EDITABLE.includes(status)` |
| `applyVoucherToTransaction()` | `orders.service.js` | `CASHIER_EDITABLE.includes(status)` |
| `createDeleteRequest()` | `cashier.service.js` | Tidak ada status guard (aman — leader yang approve) |

**D. Checklist saat menambah operasi kasir baru:**

- [ ] Backend: gunakan `CASHIER_EDITABLE` bukan `status !== 'PENDING'`
- [ ] Frontend: gunakan `isEditable` bukan `isPending` sebagai gate UI
- [ ] Pesan error backend menyebutkan status yang diizinkan (bukan hanya "PENDING")
- [ ] Test: coba fitur dengan transaksi berstatus RESERVED — harus berfungsi

### Referensi

BUG-069 — Frontend gate terlalu ketat (`isPending` saja).  
BUG-070 — Backend hardcode `status !== 'PENDING'`, menolak RESERVED.

---

## STD-036 — Harga dari API Wajib di-cast `parseFloat()` Sebelum Aritmatika

**Berlaku untuk:** Semua komponen frontend yang menerima nilai harga/jumlah dari API dan menggunakannya dalam operasi aritmatika (`+`, `-`, `*`, `/`).

**Latar Belakang:** BUG-072 — `GroupPaymentPage` dan `PaymentPage` menyalin `price: p.price` dari API response tanpa konversi. PostgreSQL `NUMERIC`/`DECIMAL` kolom dikirim sebagai **string** oleh `node-postgres`. Operasi `number + string` di JavaScript menghasilkan string concatenation bukan penjumlahan numerik, menyebabkan total berubah jadi nilai absurd.

### Masalah

```javascript
// API mengirim: { price: "234144", stock_quantity: 5, ... }

// SALAH ❌ — price adalah string
function normalizeProduct(p) {
  return { price: p.price, ... };  // "234144" (string)
}

setExtraAmount(prev => prev + product.price);
// 0 + "234144" = "234144"  ← string concatenation!

grandTotal = baseTotal + extraAmount;
// 29840000 + "234144" = "29840000234144" ← Rp 29.840.000.234.144 ❌
```

### Aturan

**A. Selalu cast nilai numerik dari API:**

```javascript
// BENAR ✅ — cast di satu tempat: normalizeProduct / normalization layer
function normalizeProduct(p) {
  return {
    price:  parseFloat(p.price)          || 0,
    stock:  parseInt(p.stock_quantity, 10) ?? 0,
    // ...
  };
}
```

**B. Defense-in-depth — cast juga di titik kalkulasi:**

```javascript
// BENAR ✅ — meskipun normalizeProduct sudah cast, tetap guard di penggunaan
setExtraAmount(prev => prev + parseFloat(product.price));
const baseTotal = txns.reduce((s, t) => s + parseFloat(t.total_amount), 0);
```

**C. Kolom PostgreSQL yang umumnya dikirim sebagai string:**

| Tipe PostgreSQL | Contoh nilai JSON | Perlu cast? |
|---|---|---|
| `NUMERIC`, `DECIMAL` | `"234144.00"` | ✅ `parseFloat()` |
| `BIGINT` | `"29840000"` | ✅ `parseInt()` |
| `INTEGER`, `INT4` | `5` (number) | ✗ Sudah number |
| `FLOAT`, `DOUBLE` | `234144.5` (number) | ✗ Sudah number |
| `TIMESTAMPTZ` | `"2026-06-17T..."` | ✗ Bukan aritmatika |

**D. `formatRupiah()` tidak mendeteksi bug ini:**

`Intl.NumberFormat.format("234144")` = "Rp 234.144" — display tampil benar meski datanya string. Bug baru muncul saat string dipakai dalam `+` dengan nilai lain.

### Checklist Saat Menulis Komponen yang Menampilkan Harga

- [ ] Semua field harga/amount di `normalizeProduct` / data transform menggunakan `parseFloat()` atau `parseInt()`
- [ ] Semua `reduce()` dan `setAmount(prev => prev + x)` menggunakan nilai yang sudah pasti number
- [ ] Tidak ada `price: p.price` (tanpa cast) jika dipakai dalam kalkulasi

### Referensi

BUG-072 — `GroupPaymentPage` total Rp 29.840.000.234.144 karena `price: p.price` (string) + number = string concat.

---

## STD-037 — Setiap File Migration SQL WAJIB Didaftarkan ke Schema Runner (`app.js`)

**Berlaku untuk:** Semua perubahan schema DB. Setiap developer yang membuat file di `backend/migrations/`.

### Aturan

Setiap kali membuat file SQL baru di `backend/migrations/`, file tersebut **WAJIB** langsung didaftarkan ke `runSchemaGuard` di `backend/src/app.js` pada PR yang sama.

| ❌ Salah | ✅ Benar |
|---|---|
| Buat `030_feature.sql`, tidak tambah ke `app.js` | Buat `030_feature.sql` + tambah `runSchemaGuard('Migration 030 — ...', [...])` di `app.js` |
| Bergantung pada migration file untuk diterapkan secara terpisah | Semua migration dijalankan otomatis saat server start via schema runner |

### Kenapa Ini Penting

Sistem tidak punya migration runner terpisah (Flyway, Liquibase, dll). Satu-satunya cara schema baru diterapkan ke DB adalah via `runSchemaGuard` di `app.js` yang dipanggil saat server start.

File SQL di `backend/migrations/` hanya berfungsi sebagai:
- Dokumentasi/referensi SQL yang dijalankan
- Seed data untuk container PostgreSQL saat init (`docker-entrypoint-initdb.d/`)

File SQL tersebut TIDAK otomatis dieksekusi oleh backend.

### Pattern Schema Guard

```javascript
// Di app.js, setelah runSchemaGuard terakhir:
await runSchemaGuard('Migration 030 — Deskripsi singkat', [
  `ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar VARCHAR(255)`,
  `CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar)`,
  // Gunakan IF NOT EXISTS / DO $$ ... EXCEPTION ... END $$ untuk idempotency
]);
```

### Idempotency Rules

Semua SQL dalam `runSchemaGuard` harus **idempotent** (aman dijalankan berkali-kali):

| Operasi | Pattern Idempotent |
|---|---|
| Tambah kolom | `ADD COLUMN IF NOT EXISTS` |
| Buat index | `CREATE INDEX IF NOT EXISTS` |
| Tambah constraint | `DO $$ BEGIN ALTER TABLE ... ADD CONSTRAINT ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$` |
| Ubah tipe kolom | `ALTER COLUMN ... TYPE ...` (safe jika compatible) |
| Drop index | `DROP INDEX IF EXISTS` |
| Backfill data | `UPDATE ... WHERE column IS NULL` |

### Checklist Setiap PR yang Mengubah Schema

- [ ] File SQL baru di `backend/migrations/` sudah ada
- [ ] SQL yang sama sudah ditambahkan ke `runSchemaGuard` di `app.js`
- [ ] Semua SQL di schema guard menggunakan pattern idempotent
- [ ] Label `runSchemaGuard` sesuai nomor migration (e.g., `'Migration 030 — ...'`)

### Referensi

BUG-073 — Login customer gagal dengan "Internal server error." karena migration 030 tidak terdaftar di `app.js`, sehingga kolom `identifier` di `customer_login_attempts` tidak pernah dibuat.

---

## STD-038 — Customer Phone Lookup: Pola Debounced Lookup di Setiap Input HP Customer

**Berlaku untuk:** Semua form/page yang memiliki field "No. HP Customer (opsional)" yang diisi oleh staff (kasir, helper, atau role lain).

### Aturan

Setiap field input nomor HP customer yang diisi oleh staff **WAJIB** menggunakan pola debounced lookup berikut:

1. **Debounce 600ms** — lookup hanya dipanggil 600ms setelah user berhenti mengetik
2. **Tampilkan spinner** saat lookup berlangsung
3. **Jika ditemukan**: border hijau + tampilkan nama dan email customer di bawah field
4. **Jika tidak ditemukan**: border amber + pesan "Customer belum terdaftar — akan dicatat sebagai Walk-in"
5. **Clear button**: tombol ✕ untuk reset phone + customerInfo sekaligus
6. **Reset** `customerInfo` dan timer saat form di-submit atau di-reset

### Backend Endpoint

```
GET /api/v1/cashier/customer-lookup?phone=08xxxxxxxxxx
Authorization: CASHIER | LEADER | ADMIN | HELPER
Response 200: { success: true, data: { customer_id, full_name, phone_number, email } }
Response 404: { success: false, message: 'Customer tidak ditemukan.' }
```

Endpoint ini di-share oleh semua role yang butuh lookup. Tambahkan role ke `authorize()` jika ada role baru yang membutuhkan.

### State yang Dibutuhkan (React)

```javascript
const [customerInfo, setCustomerInfo]   = useState(null); // null | { found: true, ...data } | { found: false }
const [lookupLoading, setLookupLoading] = useState(false);
const lookupTimerRef = useRef(null);
```

### Handler Lookup

```javascript
function handlePhoneChange(val) {
  setPhone(val);
  setCustomerInfo(null);
  clearTimeout(lookupTimerRef.current);
  const trimmed = val.trim();
  if (!trimmed) { setLookupLoading(false); return; }
  setLookupLoading(true);
  lookupTimerRef.current = setTimeout(async () => {
    try {
      const res = await lookupCustomerByPhone(trimmed);
      setCustomerInfo({ found: true, ...res.data.data });
    } catch (err) {
      if (err.response?.status === 404) setCustomerInfo({ found: false });
    } finally {
      setLookupLoading(false);
    }
  }, 600);
}
```

### Reset setelah Submit

```javascript
setPhone('');
setCustomerInfo(null);
clearTimeout(lookupTimerRef.current);
```

### Yang TIDAK Boleh Dilakukan

| ❌ Salah | ✅ Benar |
|---|---|
| Lookup on every keystroke tanpa debounce | Debounce 600ms |
| Gate checkout — block submit jika customer tidak ditemukan | Preview only — tidak blocking |
| Ubah `customerPhone` yang dikirim ke backend berdasarkan lookup | Kirim phone apa adanya — backend yang handle |
| Buat endpoint lookup baru per role | Gunakan `GET /cashier/customer-lookup` yang sudah ada, tambah role ke `authorize()` |

### Referensi Implementasi

- CR-060: `frontend/src/pages/cashier/CashierPOSPage.jsx` — implementasi pertama (Tailwind CSS)
- CR-061: `frontend/src/pages/helper/HelperPage.jsx` — implementasi kedua (inline styles)

---

## STD-039 — Halaman Print/Laporan Wajib Menyertakan Tombol "Export Excel"

**Berlaku untuk:** Semua halaman yang menampilkan tabel data dan memiliki tombol print (`window.print()`) atau menjadi target tab cetak.

### Aturan

Setiap halaman print/laporan yang menampilkan tabel data **WAJIB** menyertakan tombol "📊 Export Excel" di samping tombol cetak.

**A. Gunakan `exportToExcel` dari `../../utils/exportExcel.js`:**

```javascript
import { exportToExcel } from '../../utils/exportExcel';

function handleExportExcel() {
  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`NamaFile_${dateStr}`, [{
    name: 'NamaSheet',
    rows: data.map((row, i) => ({
      'No': i + 1,
      'Kolom A': row.field_a,
      'Kolom B': row.field_b,
      // ... sesuai konteks
    })),
  }]);
}
```

**B. Multi-sheet untuk data yang dikelompokkan:**

Jika data ditampilkan per-grup (contoh: per booth), export dengan satu sheet per grup + satu sheet "Summary":

```javascript
const sheets = groups.map(({ groupName, rows }) => ({
  name: groupName.slice(0, 31),   // Excel limit: 31 karakter per sheet name
  rows: rows.map((r, i) => ({ 'No': i + 1, ... })),
}));
sheets.push({ name: 'Summary', rows: summaryRows });
exportToExcel(filename, sheets);
```

**C. Posisi tombol — Excel SEBELUM Print:**

```jsx
{/* Excel di kiri/atas Print */}
<button onClick={handleExportExcel} className="... bg-emerald-600 ...">📊 Export Excel</button>
<button onClick={() => window.print()} className="... bg-blue-600 ...">🖨️ Cetak / Simpan PDF</button>
```

**D. Tombol Excel adalah `no-print` — tidak ikut dicetak:**

```jsx
<div className="no-print sticky top-0 ...">
  {/* Tombol Excel + Print ada di sini — class no-print mencegah mereka tercetak */}
</div>
```

**E. Data yang diekspor HARUS sama dengan yang ditampilkan di layar:**

Jika ada filter aktif (tenant, tanggal, status), Excel harus mengekspor data setelah filter — bukan raw data sebelum filter.

### Nama Kolom Excel

Gunakan nama kolom bahasa Indonesia yang deskriptif, bukan nama field teknis:

| Field | ❌ Salah | ✅ Benar |
|---|---|---|
| `product_name` | `product_name` | `Nama Produk` |
| `is_active` | `is_active` | `Status` |
| `stock_quantity` | `stock_quantity` | `Qty` |
| `price` | `price` | `Harga` |

Nilai numerik (harga, qty) di-pass sebagai `Number(x)` — bukan string — agar Excel bisa menghitung.

### Checklist

- [ ] Import `exportToExcel` dari `../../utils/exportExcel`
- [ ] Tombol "📊 Export Excel" ada di toolbar `no-print`
- [ ] Data yang diekspor = data setelah filter aktif
- [ ] Nilai numerik di-cast ke `Number()`
- [ ] Sheet name ≤ 31 karakter (batas Excel)
- [ ] Jika data dikelompokkan: multi-sheet dengan summary

### Referensi

BUG-078 — Tombol "Cetak" di Master Data tidak bisa Export Excel (`MasterDataPrintPage.jsx` tidak punya tombol Excel).  
Contoh implementasi: `frontend/src/pages/admin/MasterDataPrintPage.jsx`  
Contoh halaman laporan lain: `SalesReportPage.jsx`, `RecapPage.jsx`, `ShiftReportPage.jsx`

---

## STD-040 — Customer Auth via Email Wajib Melalui OTP

**Berlaku untuk:** `registerCustomer()`, `loginCustomer()` di `auth.service.js`, halaman `RegisterPage.jsx` dan `LoginCustomerPage.jsx`.

### Aturan

Setiap kali customer melakukan register atau login dengan identifier **email**, wajib melalui step verifikasi OTP yang dikirim ke email. Login/register via nomor HP tidak memerlukan OTP.

| Mode | OTP? | Channel |
|---|---|---|
| Register — email (primer) | **Ya** | Email |
| Register — phone + email | **Ya** | Email |
| Register — phone-only | Tidak | — |
| Login — email | **Ya** | Email |
| Login — phone | Tidak | — |

### Implementasi Backend

**A. `registerCustomer()` — jika `email` ada dalam payload:**

```js
// Email provided → OTP flow
if (email) {
  const otpCode = customerOtpSvc.generateOTP();
  const otpHash = await customerOtpSvc.hashOTP(otpCode);
  const otpTtl  = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);

  await query(
    `INSERT INTO pending_registrations (...) VALUES (...)
     ON CONFLICT (identifier) DO UPDATE SET ...`,
    [email, full_name, phone_number || null, email, gender, birth_date || null, otpHash, otpTtl]
  );
  await sendCustomerOTPEmail(email, otpCode, full_name);
  const tempToken = signTempToken({ _regIdentifier: email });
  return { requiresOtp: true, tempToken, maskedEmail };
}
// Phone-only → direct register (tidak berubah)
```

**B. `loginCustomer()` — jika `isEmailMode`:**

```js
if (isEmailMode) {
  const otpCode = customerOtpSvc.generateOTP();
  const otpHash = await customerOtpSvc.hashOTP(otpCode);
  await customerOtpSvc.storeOTP(customer.customer_id, otpHash);
  await sendCustomerOTPEmail(customer.email, otpCode, customer.full_name);
  const tempToken = signTempToken({ customerId: customer.customer_id, deviceId: deviceId || null });
  return { requiresOtp: true, tempToken, maskedEmail };
}
// Phone mode → direct login (tidak berubah)
```

### Implementasi Frontend

**C. Halaman Register & Login — OTP step:**

```jsx
// State tambahan
const [otpStep, setOtpStep]       = useState(false);
const [tempToken, setTempToken]   = useState('');
const [maskedEmail, setMaskedEmail] = useState('');
const [otpCode, setOtpCode]       = useState('');

// Setelah submit register/login
const data = res.data.data;
if (data.requiresOtp) {
  setTempToken(data.tempToken);
  setMaskedEmail(data.maskedEmail);
  setOtpStep(true);
} else {
  login(data.token, { ... });
  navigate('/katalog');
}

// Submit OTP
const res = await verifyRegisterOtp({ tempToken, otpCode });  // atau verifyCustomerOtp
login(res.data.data.token, { ... });
navigate('/katalog');
```

### Jangan Di-bypass

Infrastruktur OTP customer berikut **tidak boleh dihilangkan atau di-bypass** saat refaktor:

| Komponen | Lokasi |
|---|---|
| `verifyRegisterOtp()` | `auth.service.js` |
| `verifyCustomerOtp()` | `auth.service.js` |
| `customerOtpSvc` | `customer_otp.service.js` |
| `sendCustomerOTPEmail()` | `email.service.js` |
| Route `/register/verify-otp` | `auth.router.js` |
| Route `/verify-otp/customer` | `auth.router.js` |
| Tabel `pending_registrations` | DB migration |
| Tabel `customer_otps` | DB migration |

### Referensi

BUG-080 — OTP email customer di-bypass setelah refaktor: `registerCustomer()` dan `loginCustomer()` langsung issue token tanpa OTP.  
Implementasi: `auth.service.js`, `RegisterPage.jsx`, `LoginCustomerPage.jsx`

---

## STD-041 — Nginx SPA: `index.html` Wajib `Cache-Control: no-cache`

**Berlaku untuk:** Semua deployment SPA (React/Vite) yang dihosting dengan Nginx.

### Masalah

Vite menggunakan content-hash pada nama file JS/CSS (`index-Bocps9SR.js`). Setiap kali build menghasilkan nama file baru. Jika `index.html` di-cache browser (tanpa `Cache-Control: no-cache`):
- Browser tetap memuat `index.html` lama yang merujuk ke JS hash lama
- JS hash lama tidak ada di server → 404 atau muat JS yang salah (sebelum perubahan)
- User tidak melihat perubahan terbaru meskipun server sudah di-deploy ulang

### Aturan

**A. `index.html` HARUS no-cache:**

```nginx
location = /index.html {
    try_files $uri =404;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

**B. Static assets (JS/CSS/images dengan content hash) boleh long-cache:**

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

**C. SPA catch-all tetap ada SETELAH dua block di atas:**

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Urutan penting — nginx memakai `location` yang paling spesifik, bukan urutan.

### Checklist

- [ ] `nginx.conf` mempunyai block `location = /index.html` dengan `no-cache`
- [ ] Static assets mempunyai long-cache
- [ ] `location /` sebagai SPA catch-all tetap ada
- [ ] Test dengan `curl -I http://host/index.html` → header `Cache-Control: no-cache` muncul

### Referensi

BUG-081 — OTP step tidak muncul di browser karena `index.html` di-cache browser, build baru tidak dimuat.

---

## STD-042 — Approval Queue: Sub-Query Item Wajib Filter `approval_status = 'PENDING'`

**Berlaku untuk:** Semua fitur yang menampilkan antrian persetujuan (helper, kasir, atau role lain) di mana item memiliki status yang bisa berubah (PENDING / APPROVED / REJECTED).

### Masalah

Ketika membangun "approval queue", ada dua langkah query yang umum:
1. Ambil daftar transaksi yang masih butuh persetujuan (filter di level transaksi)
2. Ambil daftar item dari transaksi tersebut (sub-query per transaksi)

Bug terjadi ketika langkah (1) sudah memfilter dengan benar (`approval_status = 'PENDING'`), tapi langkah (2) tidak memfilter — sehingga item yang sudah diproses (APPROVED/REJECTED) ikut ditampilkan.

### Aturan

**A. Approval Queue (PENDING items):** outer query dan items sub-query keduanya wajib:
```sql
AND ti.approval_status = 'PENDING'
```

**B. Handover/Detail View (APPROVED items):** items yang ditampilkan untuk handover wajib menyaring REJECTED:
```sql
AND ti.approval_status != 'REJECTED'
```

**C. Tidak boleh mendelegasikan filter status ke frontend.** Frontend hanya boleh melakukan presentasi, bukan business logic filtering untuk status approval.

### Checklist

- [ ] Outer query memfilter `approval_status = 'PENDING'`
- [ ] Items sub-query memfilter `approval_status = 'PENDING'` yang sama
- [ ] Jika ada join ke tabel lain, pastikan filter diterapkan pada kolom yang benar (`transaction_items.approval_status`, bukan kolom tabel lain)

### Referensi

BUG-082 — Item yang sudah di-approve/reject masih tampil di antrian approval karena items sub-query tidak memfilter `approval_status`.

---

## STD-043 — Express Router: Route Literal Wajib Didaftarkan Sebelum Route Parameter `/:param`

**Berlaku untuk:** Semua Express Router yang memiliki route dengan path literal (non-parameter) dan route dengan parameter dinamis (`/:code`, `/:id`, dsb.) pada HTTP method yang sama.

**Latar Belakang:** BUG-088 — `GET /admin/vouchers/product-promos` ditangkap oleh `GET /:code` karena `product-promos` didaftarkan setelah `/:code`. `getVoucherByCode('product-promos')` melempar 404, seluruh `Promise.all` di frontend reject, dan dropdown Tenant + Produk kosong.

### Aturan

**A. Selalu daftarkan route literal SEBELUM route parameter pada method yang sama:**

```javascript
// SALAH ❌ — /:code menangkap /product-promos terlebih dahulu
router.get('/:code', ...);          // line 1
router.get('/product-promos', ...); // line 2 — TIDAK PERNAH DICAPAI

// BENAR ✅ — literal dulu, parameter belakangan
router.get('/product-promos', ...); // line 1 — cocok jika path = /product-promos
router.get('/:code', ...);          // line 2 — fallback untuk kode lainnya
```

**B. Tambah komentar penjelasan di atas route literal jika konteksnya tidak jelas:**

```javascript
// MUST be registered BEFORE /:code to avoid Express capturing this as a code param
router.get('/product-promos', ...);
router.get('/:code', ...);
```

**C. Aturan ini berlaku per HTTP method:**

Jika `GET /:code` ada tapi `POST /:code` tidak ada, maka `POST /product-promos` aman di posisi manapun. Namun untuk konsistensi dan mencegah bug saat method baru ditambahkan, **selalu tempatkan semua literal routes sebelum semua parameter routes** dalam satu router block.

**D. Pattern aman untuk router dengan mixed routes:**

```
router.get('/')             ← list semua
router.get('/literal-a')    ← ✅ spesifik (sebelum /:param)
router.post('/literal-b')   ← ✅ spesifik (sebelum /:param)
router.get('/:param')       ← generic — SELALU di bawah semua literal
router.post('/')            ← create
router.patch('/:param')     ← update
router.delete('/:param')    ← delete
```

### Checklist — setiap kali menambahkan route baru ke router yang sudah ada

- [ ] Apakah router ini sudah punya `GET /:param`, `POST /:param`, atau sejenisnya?
- [ ] Jika ya: pastikan route baru (jika literal) ditempatkan **sebelum** route parameter tersebut
- [ ] Tambah komentar `// MUST be before /:param` jika posisinya mudah diubah secara tidak sengaja
- [ ] Test manual: panggil endpoint literal baru, pastikan handler yang benar dipanggil (bukan handler /:param)

### Referensi

BUG-088 — `GET /admin/vouchers/product-promos` ditangkap `GET /:code` → 404 → `Promise.all` reject → dropdown Tenant & Produk kosong di modal Promo Produk.

---

## STD-044 — Sinkronisasi Logika Order di Semua Flow: Customer, Kasir, Helper

**Berlaku untuk:** Semua fungsi pembuatan order di `backend/src/modules/orders/orders.service.js`: `createOrder`, `createOrderByCashier`, dan flow helper/approval.

**Latar Belakang:** BUG-092 — Fitur product promo (B1G1/B2G1) diimplementasikan di `createOrder` (flow customer) tetapi tidak di `createOrderByCashier` (flow kasir). Akibatnya voucher `GET22` tidak memberikan item gratis ketika kasir yang melakukan checkout.

### Aturan

**A. Setiap fitur yang memengaruhi isi order WAJIB diimplementasikan di semua flow order:**

| Fitur | `createOrder` | `createOrderByCashier` | Helper/Approval |
|---|---|---|---|
| Voucher PERCENT/FIXED | ✅ | ✅ | ✅ |
| Product promo free items | ✅ | ✅ (STD-044) | Perlu review |

**B. Checklist saat menambahkan logika baru ke `createOrder`:**

- [ ] Apakah logika ini memengaruhi isi atau total order? (item, harga, diskon, stok)
- [ ] Jika ya: terapkan logika yang sama di `createOrderByCashier`
- [ ] Jika ada flow helper/approval: review apakah perlu diterapkan juga di sana
- [ ] Test setiap flow secara terpisah: customer self-order, kasir POS, helper

**C. Pattern implementasi product promo (B1G1/B2G1) di backend:**

```js
// Setelah validasi stok item reguler:
let freeItemsList = [];
const promoRules = await voucherSvc.getActiveProductPromos(productIds);
if (promoRules.length > 0) {
  const freeProductIds = [...new Set(promoRules.map(r => r.free_product_id).filter(Boolean))];
  if (freeProductIds.length > 0) {
    const freeProductRows = await client.query(
      `SELECT product_id, stock_quantity, tenant_id FROM products
       WHERE product_id = ANY($1) AND is_active = TRUE FOR UPDATE`, [freeProductIds]);
    const freeProductMap = Object.fromEntries(freeProductRows.rows.map(p => [p.product_id, p]));
    const rulesWithStock = promoRules.map(r => ({
      ...r, free_product_stock: freeProductMap[r.free_product_id]?.stock_quantity ?? 0,
    }));
    freeItemsList = voucherSvc.calculateFreeItems(
      items.map(i => ({ product_id: i.product_id, quantity: i.quantity })), rulesWithStock);
    // Cap by available stock
    for (const fi of freeItemsList) {
      const fp = freeProductMap[fi.free_product_id];
      if (!fp || fp.stock_quantity < fi.free_qty) fi.free_qty = Math.max(0, fp?.stock_quantity ?? 0);
    }
    freeItemsList = freeItemsList.filter(fi => fi.free_qty > 0);
  }
}

// Setelah insert item reguler:
for (const fi of freeItemsList) {
  const { rows } = await client.query(`SELECT tenant_id FROM products WHERE product_id = $1`, [fi.free_product_id]);
  await client.query(
    `INSERT INTO transaction_items (transaction_id, product_id, tenant_id, quantity, unit_price, subtotal, is_free, free_reason)
     VALUES ($1, $2, $3, $4, 0, 0, TRUE, $5)`,
    [transactionId, fi.free_product_id, rows[0]?.tenant_id || null, fi.free_qty, fi.voucher_code]);
  await client.query(`UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2`, [fi.free_qty, fi.free_product_id]);
}
```

**D. Pattern implementasi product promo di frontend (halaman dengan local cart state):**

```js
// Import
import { getActivePromos } from '../../api/vouchers';

// State + computed
const [activePromos, setActivePromos] = useState([]);
const cartKey = cart.map(i => `${i.id}:${i.qty}`).join(',');

useEffect(() => {
  const productIds = cart.map(i => i.id).filter(Boolean);
  if (!productIds.length) { setActivePromos([]); return; }
  getActivePromos(productIds)
    .then(res => setActivePromos(res.data?.data || []))
    .catch(() => setActivePromos([]));
}, [cartKey]); // eslint-disable-line react-hooks/exhaustive-deps

const freeItems = useMemo(() => derivePromoFreeItems(
  cart.map(i => ({ product_id: i.id, quantity: i.qty })), activePromos
), [cartKey, activePromos]); // eslint-disable-line react-hooks/exhaustive-deps
```

### Referensi

BUG-092 — Product promo tidak terimplementasi di kasir karena `createOrderByCashier` tidak memiliki logika promo yang sudah ada di `createOrder`.

---

## STD-045 — Komponen dengan State Internal: Wajib Ada Mekanisme Sync dengan Parent

**Berlaku untuk:** Semua React component yang memiliki state internal (`useState`) yang merepresentasikan nilai yang juga dikontrol oleh parent (e.g., applied voucher, selected item, form value).

**Latar Belakang:** BUG-093 — `VoucherInput` memiliki internal `appliedVoucher` state. Ketika parent mereset `appliedVoucher` via `setAppliedVoucher(null)` (dipicu oleh operasi cart), VoucherInput tidak tahu dan tetap menampilkan banner "Voucher applied" meskipun discount sudah 0 di parent.

### Aturan

**A. Pilih satu dari dua pola sinkronisasi:**

| Pola | Kapan Digunakan | Cara |
|---|---|---|
| **Fully Controlled** | Component sederhana, parent punya data | Pass `value` + `onChange` sebagai props, hapus internal state |
| **Key-based Remount** | Component kompleks dengan banyak internal state, reset hanya pada kondisi tertentu | Pass `key` prop yang berubah ketika reset diperlukan |

**B. Jangan biarkan internal state "stale" terhadap parent:**

```jsx
// ❌ SALAH — VoucherInput tidak tahu parent reset voucher
function Parent() {
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  function onCartChange() { setAppliedVoucher(null); } // VoucherInput tidak tahu!
  return <VoucherInput onVoucherApplied={setAppliedVoucher} />;
}

// ✅ BENAR — Key berubah ketika voucher di-reset, force remount
function Parent() {
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherKey, setVoucherKey] = useState(0);
  function onCartChange() {
    if (appliedVoucher) setVoucherKey(k => k + 1); // remount only when needed
    setAppliedVoucher(null);
  }
  return <VoucherInput key={voucherKey} onVoucherApplied={setAppliedVoucher} />;
}
```

**C. Feature toggle dengan opt-out: backend harus menghormati pilihan user:**

Jika fitur auto-compute (seperti product promo) bisa di-dismiss oleh user, **backend harus menerima flag `skip*`** — jangan hanya sembunyikan UI. Frontend yang dismiss tanpa backend opt-out berarti fitur tetap aktif secara tersembunyi.

```js
// Frontend
const res = await createCashierOrder(items, phone, voucher, promoDismissed);
//                                                           ^^^^^^^^^^^^^^^ skip flag

// Backend
async function createOrderByCashier(..., skipProductPromo = false) {
  const promoRules = skipProductPromo ? [] : await voucherSvc.getActiveProductPromos(productIds);
}
```

**D. Checklist saat membuat komponen dengan internal state:**

- [ ] Apakah parent bisa mereset/mengubah nilai ini dari luar?
- [ ] Jika ya: pilih Fully Controlled atau Key-based Remount
- [ ] Jika menggunakan Key-based: pastikan key hanya berubah saat reset diperlukan (bukan setiap render)
- [ ] Dokumentasikan di JSDoc komponen: "Reset via `key` prop"

### Referensi

BUG-093 — VoucherInput stale state pada CashierPOSPage; promo auto-trigger tanpa dismiss mechanism.
