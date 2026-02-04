-- Add phone numbers and emails to users for password recovery
-- These match the offline credential seed data

UPDATE users 
SET phone_number = '+254700000000',
    email = 'admin@example.com'
WHERE username = 'admin' AND user_id = 1;

UPDATE users 
SET phone_number = '+254711111111',
    email = 'kelvin@example.com'
WHERE username = 'kelvin' AND user_id = 4;

UPDATE users 
SET phone_number = '+254722222222',
    email = 'manuel@example.com'
WHERE username = 'manuel' AND user_id = 5;

-- Verify the update
SELECT user_id, username, phone_number, email FROM users ORDER BY user_id;
