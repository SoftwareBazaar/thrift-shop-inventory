// Script to run the session management migration on your database
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    // Read database connection from environment or use defaults
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'thrift_shop',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'your-password',
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully!');

        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'schema', 'add-session-management.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running session management migration...');
        await client.query(migrationSQL);
        console.log('Migration completed successfully!');

        // Verify tables were created
        const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sessions')
    `);

        console.log('\nVerification:');
        console.log('Sessions table exists:', tablesResult.rows.length > 0);

        // Check if password_version column was added
        const columnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'password_version'
    `);

        console.log('Password version column exists:', columnsResult.rows.length > 0);

        console.log('\n✅ Session management is now active!');
        console.log('\nWhat this means:');
        console.log('- When users change their password, ALL active sessions will be invalidated');
        console.log('- Users will be logged out on all devices');
        console.log('- Old passwords will no longer work');
        console.log('- Users must log in with their new password');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run if executed directly
if (require.main === module) {
    runMigration().catch(console.error);
}

module.exports = { runMigration };
