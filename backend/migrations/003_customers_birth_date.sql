-- Migration 003: Add birth_date column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date DATE;
