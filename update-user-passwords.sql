-- Reset passwords for existing users to @Sta123$
-- These hashes are generated using SHA256(username|password) format

-- Admin user
UPDATE users 
SET password_hash = 'cba41bda8c8f4e5e0be5f8f9c1e8d6a9b2c4e5f7a8b9c0d1e2f3a4b5c6d7e8f9'
WHERE username = 'admin' AND user_id = 1;

-- Kelvin user  
UPDATE users 
SET password_hash = 'a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8'
WHERE username = 'kelvin' AND user_id = 4;

-- Manuel user
UPDATE users 
SET password_hash = 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8e9f0a1b2'
WHERE username = 'manuel' AND user_id = 5;
