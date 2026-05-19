-- Step 1: Check what users currently exist in your database
SELECT user_id, username, full_name, role, stall_id, status, 
       LEFT(password_hash, 20) as hash_preview
FROM users
ORDER BY user_id;
