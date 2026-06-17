# ── Jalankan semua stress test secara berurutan ────────────────────────────────
# Jalankan dari root project:
#   .\tools\stress-test\run_all.ps1

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Timestamp = (Get-Date -Format 'yyyyMMdd_HHmmss')
$ResultDir = "$ScriptDir\results\$Timestamp"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Amazing Toys Fair 2026 — Full Stress Test Suite   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Pastikan k6 tersedia
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: k6 tidak ditemukan. Install via: choco install k6" -ForegroundColor Red
    Write-Host "       atau download dari https://k6.io/docs/get-started/installation/" -ForegroundColor Yellow
    exit 1
}

$Tests = @(
    @{ name = "01 Auth Load (100 VU Login)";     file = "01_auth_load.js"     },
    @{ name = "02 Order Flow (100 VU End-to-End)"; file = "02_order_flow.js"  },
    @{ name = "03 WebSocket (100 Koneksi)";       file = "03_websocket.js"    },
    @{ name = "04 WA SLA (Notif < 30 Detik)";    file = "04_wa_sla.js"       },
    @{ name = "05 Double Payment Protection";     file = "05_payment_double.js"},
)

$Summary = @()

foreach ($test in $Tests) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "  Menjalankan: $($test.name)" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

    $outFile = "$ResultDir\$($test.file -replace '\.js$','.json')"
    $startTime = Get-Date

    try {
        # k6 dijalankan via Docker agar bisa akses backend di hybrid-net
        docker run --rm `
            --network hybrid_hybrid-net `
            -v "${ScriptDir}:/scripts" `
            grafana/k6 run /scripts/$($test.file) `
            --summary-trend-stats "min,avg,med,p(90),p(95),p(99),max"
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
    }

    $duration = [int]((Get-Date) - $startTime).TotalSeconds
    $status   = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
    $color    = if ($exitCode -eq 0) { "Green" } else { "Red" }

    Write-Host ""
    Write-Host "  Hasil: $status ($duration detik)" -ForegroundColor $color

    $Summary += [PSCustomObject]@{
        Test     = $test.name
        Status   = $status
        Duration = "${duration}s"
        Report   = $outFile
    }

    # Jeda 10 detik antar test agar server recover
    if ($test -ne $Tests[-1]) {
        Write-Host "  (jeda 10 detik sebelum test berikutnya...)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 10
    }
}

# ── Ringkasan akhir ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    HASIL AKHIR                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$allPass = $true
foreach ($item in $Summary) {
    $color = if ($item.Status -eq "PASS") { "Green" } else { "Red"; $allPass = $false }
    Write-Host ("  [{0}] {1} ({2})" -f $item.Status, $item.Test, $item.Duration) -ForegroundColor $color
}

Write-Host ""
Write-Host "  Laporan JSON tersimpan di: $ResultDir" -ForegroundColor DarkGray
Write-Host ""

if ($allPass) {
    Write-Host "  SISTEM SIAP UNTUK PAMERAN!" -ForegroundColor Green
} else {
    Write-Host "  Ada test yang gagal — periksa laporan di $ResultDir" -ForegroundColor Red
}
Write-Host ""
