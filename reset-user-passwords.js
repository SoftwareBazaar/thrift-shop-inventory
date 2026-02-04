// Quick fix script to reset user passwords in Supabase
// Run this with: node reset-user-passwords.js

const crypto = require('crypto');

// Function to derive password hash (same as client-side)
function derivePasswordHash(username, password) {
    const normalizedUsername = username.trim().toLowerCase();
    const input = `${normalizedUsername}|${password}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}

// Generate hashes for seed users
const users = [
    { username: 'admin', password: '@Sta123$' },
    { username: 'kelvin', password: '@Sta123$' },
    { username: 'manuel', password: '@Sta123$' }
];

console.log('Password hashes for Supabase users table:\n');
console.log('Copy these UPDATE statements and run them in Supabase SQL Editor:\n');

users.forEach(user => {
    const hash = derivePasswordHash(user.username, user.password);
    console.log(`-- Reset ${user.username}'s password`);
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = '${user.username}';\n`);
});

console.log('\n--- OR run this single query to reset all at once ---\n');
users.forEach(user => {
    const hash = derivePasswordHash(user.username, user.password);
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = '${user.username}';`);
});
