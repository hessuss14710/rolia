/**
 * Migration Runner for RolIA Backend
 * Runs SQL migration files in order
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigrations() {
    const client = await pool.connect();

    try {
        // Create migrations tracking table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Get list of migration files
        const migrationsDir = __dirname;
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files`);

        // Get already executed migrations
        const { rows: executed } = await client.query(
            'SELECT filename FROM schema_migrations'
        );
        const executedSet = new Set(executed.map(r => r.filename));

        // Run pending migrations
        for (const file of files) {
            if (executedSet.has(file)) {
                console.log(`✓ ${file} (already executed)`);
                continue;
            }

            console.log(`→ Running ${file}...`);

            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (filename) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`✓ ${file} executed successfully`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`✗ ${file} failed:`, err.message);
                throw err;
            }
        }

        console.log('\nAll migrations completed successfully!');
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
