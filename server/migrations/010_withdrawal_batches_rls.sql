-- ============================================================================
-- Fix: "new row violates row-level security policy for table
--       stock_withdrawal_batches" on stall withdrawals
-- ============================================================================
-- Supabase enabled RLS on the table created in 008 but no policy allowed
-- writes, so every stall → hub return was rejected. Same access level as the
-- other stock tables (app auth is enforced before these calls).
-- ============================================================================

ALTER TABLE stock_withdrawal_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_withdrawal_batches_all ON stock_withdrawal_batches;
CREATE POLICY stock_withdrawal_batches_all
  ON stock_withdrawal_batches
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON stock_withdrawal_batches TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE stock_withdrawal_batches_batch_link_id_seq TO anon, authenticated;
