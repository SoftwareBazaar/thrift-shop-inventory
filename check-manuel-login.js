// Diagnostic script to check Manuel's account and test login
// Run with: node check-manuel-login.js

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to derive password hash (same as client-side)
function derivePasswordHash(username, password) {
    const normalizedUsername = username.trim().toLowerCase();
    const input = `${normalizedUsername}|${password}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}

async function checkManuelAccount() {
    console.log('🔍 Checking Manuel\'s account...\n');

    try {
        // Fetch Manuel's user record
        const { data: user, error } = await supabase
            .from('users')
            .select('user_id, username, full_name, email, phone_number, password_hash, status')
            .eq('username', 'manuel')
            .single();

        if (error) {
            console.error('❌ Error fetching user:', error.message);
            return;
        }

        if (!user) {
            console.error('❌ User "manuel" not found in database');
            return;
        }

        console.log('✅ User found in database:');
        console.log('   User ID:', user.user_id);
        console.log('   Username:', user.username);
        console.log('   Full Name:', user.full_name);
        console.log('   Email:', user.email || 'Not set');
        console.log('   Phone:', user.phone_number || 'Not set');
        console.log('   Status:', user.status);
        console.log('   Password Hash:', user.password_hash.substring(0, 20) + '...\n');

        // Test different passwords
        const testPasswords = [
            '@Sta123$',     // Default password
            'Test3@#',      // Password from screenshot
            'manuel123',    // Old password reference
        ];

        console.log('🧪 Testing passwords:\n');

        for (const testPassword of testPasswords) {
            const derivedHash = derivePasswordHash('manuel', testPassword);
            const matches = derivedHash === user.password_hash;

            console.log(`   Password: "${testPassword}"`);
            console.log(`   Hash: ${derivedHash.substring(0, 20)}...`);
            console.log(`   Match: ${matches ? '✅ YES' : '❌ NO'}\n`);
        }

        // Generate correct hash for @Sta123$
        const correctPassword = '@Sta123$';
        const correctHash = derivePasswordHash('manuel', correctPassword);

        console.log('\n📋 To reset Manuel\'s password to "@Sta123$", run this SQL in Supabase:\n');
        console.log(`UPDATE users SET password_hash = '${correctHash}' WHERE username = 'manuel';\n`);

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

checkManuelAccount();
