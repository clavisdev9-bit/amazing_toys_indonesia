# Coding Standard — Amazing Toys Fair 2026
**Project:** Amazing Toy Show— SOS × Odoo 18 Integration  
**Maintained by:** clavis Development  
**Last updated:** 2026-06-14

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
