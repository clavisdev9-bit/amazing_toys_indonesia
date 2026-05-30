# Dokumentasi Amazing Toys SOS

## Perbedaan `http://localhost/` vs `http://localhost:5173/`

Keduanya menampilkan aplikasi React yang sama, tetapi lewat jalur berbeda.

---

### `http://localhost:5173/` — Mode Development

| Aspek | Detail |
|---|---|
| Dijalankan oleh | Vite dev server (`npm run dev` di folder `frontend/`) |
| Hot Reload | **Ya** — perubahan kode langsung terlihat di browser tanpa refresh manual |
| API proxy | Vite meneruskan `/api`, `/uploads`, `/ws` → `localhost:3001` (backend Node.js) |
| Butuh Docker? | **Tidak** — backend berjalan langsung di mesin, bukan container |
| Kecepatan startup | Sangat cepat, cocok untuk coding aktif |

**Cara menjalankan:**
```bash
# Dari folder frontend/
npm run dev
```

---

### `http://localhost/` (port 80) — Mode Production (Docker)

| Aspek | Detail |
|---|---|
| Dijalankan oleh | Nginx di dalam Docker container (`docker-compose up`) |
| Hot Reload | **Tidak** — kode di-build dulu (`npm run build`), lalu di-serve secara static |
| API proxy | Nginx meneruskan `/api`, `/uploads`, `/ws` → container `backend:3001` |
| Butuh Docker? | **Ya** — semua service berjalan dalam container |
| Kecepatan startup | Lebih lambat, ini yang dipakai di production |

**Cara menjalankan:**
```bash
# Dari root project
docker-compose up --build
```

---

### Kapan Memilih Masing-Masing

**Gunakan `:5173` saat:**
- Sedang aktif mengembangkan atau debug kode
- Ingin melihat perubahan kode langsung (hot reload)
- Tidak perlu integration service Odoo aktif

**Gunakan port `80` (Docker) saat:**
- Ingin menguji hasil build final
- Ingin menguji semua service terintegrasi (termasuk integration service Odoo)
- Ingin simulasi environment production atau demo ke stakeholder

---

## Arsitektur Services & Port

| Service | Teknologi | Port | Keterangan |
|---|---|---|---|
| Frontend | React + Vite / Nginx | 5173 (dev) / 80 (prod) | UI kiosk dan kasir |
| Backend | Node.js / Express | 3001 | REST API + WebSocket |
| Integration | Node.js | 4000 | Sync ke Odoo 18 |
| Database | PostgreSQL | 5432 | DB: `amazing_toys_sos` |

---

## Alur Integrasi Odoo

1. Customer checkout → transaksi `PENDING` dibuat di DB
2. Kasir scan QR → proses pembayaran → status jadi `PAID`
3. Backend kirim webhook ke integration service (`http://localhost:4000/webhook/order-paid`)
4. Integration service ambil data transaksi, resolve ID produk Odoo, buat `sale.order` di Odoo lalu confirm
5. Retry otomatis jika gagal: backoff 60s → 300s → dead-letter queue
