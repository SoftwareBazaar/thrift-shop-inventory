-- Migration script to add secret_word column to users table
-- Execute this in your Supabase SQL Editor

-- Add secret_word column (nullable initially for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS secret_word VARCHAR(255) NULL;

-- Add comment to document the column
COMMENT ON COLUMN users.secret_word IS 'Hashed secret word for password recovery verification';

-- Optional: Create index for faster lookups if needed
-- CREATE INDEX IF NOT EXISTS idx_users_secret_word ON users(secret_word);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'secret_word';
