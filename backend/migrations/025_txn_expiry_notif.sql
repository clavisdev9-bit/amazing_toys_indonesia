-- Migration 025: tambah kolom wa_expiry_notif_sent_at pada transactions
-- Dipakai oleh TxnNotifJob untuk tracking apakah notif "hampir expired" sudah dikirim.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS wa_expiry_notif_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN transactions.wa_expiry_notif_sent_at
  IS 'Waktu terakhir WA notif "hampir kadaluarsa" dikirim. NULL = belum pernah dikirim.';

CREATE INDEX IF NOT EXISTS idx_transactions_wa_expiry_notif
  ON transactions (expires_at)
  WHERE wa_expiry_notif_sent_at IS NULL
    AND status IN ('RESERVED', 'WAITING_PAYMENT');
