/**
 * Migration Runner
 * Safely applies database migrations in order
 * 
 * Usage: node run-migrations.js
 * 
 * IMPORTANT: This will modify the database. Ensure you have a backup!
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database connection
const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

const migrationsDir = path.join(__dirname, 'server', 'migrations');

async function getMigrationHistory() {
    try {
        const result = await client.query(`
            CREATE TABLE IF NOT EXISTS migration_history (
                id SERIAL PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        return true;
    } catch (error) {
        console.error('Error creating migration history table:', error);
        return false;
    }
}

async function isMigrationApplied(migrationName) {
    try {
        const result = await client.query(
            'SELECT * FROM migration_history WHERE migration_name = $1',
            [migrationName]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking migration status:', error);
        return false;
    }
}

async function applyMigration(migrationFile) {
    const migrationPath = path.join(migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, '.sql');
    
    console.log(`\nApplying migration: ${migrationName}`);
    
    // Check if already applied
    const isApplied = await isMigrationApplied(migrationName);
    if (isApplied) {
        console.log(`✓ Already applied, skipping...`);
        return true;
    }
    
    try {
        // Read SQL file
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Execute migration
        await client.query(sql);
        
        // Record migration
        await client.query(
            'INSERT INTO migration_history (migration_name) VALUES ($1)',
            [migrationName]
        );
        
        // Commit
        await client.query('COMMIT');
        
        console.log(`✓ Successfully applied ${migrationName}`);
        return true;
    } catch (error) {
        console.error(`✗ Error applying migration ${migrationName}:`, error.message);
        await client.query('ROLLBACK');
        return false;
    }
}

async function runMigrations() {
    try {
        console.log('='.repeat(60));
        console.log('DATABASE MIGRATION RUNNER');
        console.log('='.repeat(60));
        
        // Connect to database
        await client.connect();
        console.log('✓ Connected to database');
        
        // Create migration history table
        const historyCreated = await getMigrationHistory();
        if (!historyCreated) {
            console.log('✗ Failed to create migration history table');
            process.exit(1);
        }
        
        // Get all migration files
        const migrations = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        
        if (migrations.length === 0) {
            console.log('\n✓ No migrations to apply');
            process.exit(0);
        }
        
        console.log(`\nFound ${migrations.length} migration(s)`);
        
        // Apply each migration
        let successCount = 0;
        for (const migration of migrations) {
            const success = await applyMigration(migration);
            if (success) successCount++;
            else {
                console.log('\n✗ Migration failed. Stopping.');
                break;
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`✓ Completed: ${successCount}/${migrations.length} migrations applied`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await client.end();
    }
}

// Check if running in production
if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  WARNING: Running in production environment');
    console.log('Ensure you have a recent backup before proceeding');
    
    // Require confirmation
    if (process.argv[2] !== '--confirm') {
        console.log('\nUsage: node run-migrations.js --confirm');
        process.exit(1);
    }
}

// Run migrations
runMigrations();
