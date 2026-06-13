# Coding Standard — Amazing Toys Fair 2026
**Project:** Amazing Toys Fair 2026 — SOS × Odoo 18 Integration  
**Maintained by:** clavis Development  
**Last updated:** 2026-06-13

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
