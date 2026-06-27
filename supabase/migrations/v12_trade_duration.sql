-- BATIG v12 — Multi-duration trades (1 / 2 / 3 minute UTC rounds)
-- No schema change required: round ids encode duration as id * 100 + minutes (suffix 01–03).
-- Legacy 1-min rounds without suffix remain valid.

-- Optional: track duration on rounds for admin reporting
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS duration_min INT NOT NULL DEFAULT 1
  CHECK (duration_min IN (1, 2, 3));
