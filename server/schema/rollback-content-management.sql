-- Rollback Content Management System Migration
-- Run this to undo the add-content-management.sql migration

-- Drop trigger first (before function)
DROP TRIGGER IF EXISTS trigger_update_content_timestamp ON content;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_content_timestamp();

-- Drop indexes
DROP INDEX IF EXISTS idx_content_type;
DROP INDEX IF EXISTS idx_content_status;
DROP INDEX IF EXISTS idx_content_featured;
DROP INDEX IF EXISTS idx_content_order;
DROP INDEX IF EXISTS idx_content_created_by;

-- Drop foreign keys (if they were added)
ALTER TABLE content_metadata DROP CONSTRAINT IF EXISTS fk_metadata_content;
ALTER TABLE content DROP CONSTRAINT IF EXISTS fk_content_created_by;
ALTER TABLE content DROP CONSTRAINT IF EXISTS fk_content_updated_by;

-- Drop tables
DROP TABLE IF EXISTS content_metadata CASCADE;
DROP TABLE IF EXISTS content CASCADE;

-- Verify rollback was successful
SELECT 'Rollback completed successfully' AS message;
