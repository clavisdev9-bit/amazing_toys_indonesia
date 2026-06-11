# Coding Standard — Amazing Toys Fair 2026
**Project:** Amazing Toys Fair 2026 — SOS × Odoo 18 Integration  
**Maintained by:** clavis Development  
**Last updated:** 2026-06-11

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
