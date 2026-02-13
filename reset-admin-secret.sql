-- SQL script to reset the secret word for the admin user
-- Run this in your Supabase SQL Editor to allow the admin to set a new secret word

UPDATE users 
SET secret_word = NULL 
WHERE username = 'admin';

-- Verify the change
SELECT user_id, username, secret_word 
FROM users 
WHERE username = 'admin';
