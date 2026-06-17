# Stress Test — Amazing Toys Fair 2026

Script ini mensimulasikan beban tinggi untuk memvalidasi SLA sistem sebelum pameran.

## Prasyarat

Install k6 terlebih dahulu:
```powershell
# Windows (Chocolatey)
choco install k6

# atau download langsung dari https://k6.io/docs/get-started/installation/
```

## Struktur File

```
tools/stress-test/
├── README.md              ← panduan ini
├── config.js              ← konfigurasi URL dan kredensial
├── setup.sql              ← buat user test di database
├── 01_auth_load.js        ← Test 1: login 100 user bersamaan
├── 02_order_flow.js       ← Test 2: alur order Helper → Cashier (100 VU)
├── 03_websocket.js        ← Test 3: 100 koneksi WebSocket bersamaan
├── 04_wa_sla.js           ← Test 4: SLA notif WA < 30 detik
├── 05_payment_double.js   ← Test 5: double payment protection
└── run_all.ps1            ← jalankan semua test sekaligus
```

## Cara Menjalankan

### 1. Siapkan user test di database
```powershell
# Jalankan dari root project
docker exec -i hybrid_postgres psql -U postgres -d amazing_toys_hybrid < tools/stress-test/setup.sql
```

### 2. Sesuaikan config.js
Edit `config.js` dan pastikan `BASE_URL` mengarah ke server yang berjalan.

### 3. Jalankan test individual
```powershell
k6 run tools/stress-test/01_auth_load.js
k6 run tools/stress-test/02_order_flow.js
k6 run tools/stress-test/03_websocket.js
k6 run tools/stress-test/04_wa_sla.js
k6 run tools/stress-test/05_payment_double.js
```

### 4. Jalankan semua sekaligus (dengan jeda antar test)
```powershell
.\tools\stress-test\run_all.ps1
```

## Membaca Hasil

| Metric | Target SLA |
|--------|-----------|
| `http_req_duration p(95)` | < 2000ms |
| `http_req_failed` | < 1% |
| `ws_connecting` | < 500ms |
| `wa_sla_passed` (custom) | 100% dari order |
| `checks` | > 99% |

## Catatan Penting

- Jalankan test di environment **staging**, bukan production
- Matikan WA gateway saat stress test (set ke DISABLED di system_settings) agar tidak spam WA sungguhan
- Database akan terisi data dummy — bersihkan setelah test dengan `setup.sql` (ada cleanup di bawah)
