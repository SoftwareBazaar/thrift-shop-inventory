require('dotenv').config();
const supabase = require('./lib/supabase');

async function updateEmails() {
    const users = ['admin', 'Kelvin', 'Manuel'];
    const email = 'geoffreywaitere@gmail.com';

    console.log(`Setting recovery email to ${email} for: ${users.join(', ')}...`);

    for (const username of users) {
        const { data, error } = await supabase
            .from('users')
            .update({ email: email })
            .eq('username', username);

        if (error) {
            console.error(`❌ Error updating ${username}:`, error.message);
        } else {
            console.log(`✅ Updated ${username} successfully`);
        }
    }
}

updateEmails();
