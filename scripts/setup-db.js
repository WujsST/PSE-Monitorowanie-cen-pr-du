import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
    const client = await pool.connect();

    try {
        console.log('🔧 Setting up PostgreSQL database schema...\n');

        // Create table
        await client.query(`
      CREATE TABLE IF NOT EXISTS pse_prices (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        cen_cost DECIMAL(10, 2),
        csdac_pln DECIMAL(10, 2),
        cor_cost DECIMAL(10, 2),
        ceb_pp_cost DECIMAL(10, 2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(timestamp)
      );
    `);
        console.log('✓ Table pse_prices created');

        // Create index
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pse_prices_timestamp
      ON pse_prices(timestamp DESC);
    `);
        console.log('✓ Index idx_pse_prices_timestamp created');

        // Insert sample data (optional)
        const sampleCount = await client.query('SELECT COUNT(*) FROM pse_prices');
        if (parseInt(sampleCount.rows[0].count) === 0) {
            console.log('\n📊 Inserting sample data...');

            const now = new Date();
            const sampleData = [];

            for (let i = 0; i < 48; i++) {
                const timestamp = new Date(now.getTime() - (i * 30 * 60000)); // Every 30 minutes
                const hour = timestamp.getHours();
                const isPeak = (hour >= 17 && hour <= 21) || (hour >= 7 && hour <= 10);
                const isNight = hour >= 23 || hour <= 5;

                let basePrice = 400;
                if (isPeak) basePrice = 600;
                if (isNight) basePrice = 280;

                const variance = 100;
                const randomOffset = Math.random() * variance * 2 - variance;

                sampleData.push({
                    timestamp,
                    cen_cost: Math.max(0, basePrice + randomOffset),
                    csdac_pln: Math.max(0, basePrice * 0.9 + randomOffset * 0.5),
                    cor_cost: Math.max(0, basePrice * 0.8 + randomOffset * 0.3),
                    ceb_pp_cost: Math.max(0, basePrice * 0.95 + randomOffset * 0.4)
                });
            }

            for (const data of sampleData) {
                await client.query(
                    `INSERT INTO pse_prices (timestamp, cen_cost, csdac_pln, cor_cost, ceb_pp_cost)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (timestamp) DO NOTHING`,
                    [data.timestamp, data.cen_cost, data.csdac_pln, data.cor_cost, data.ceb_pp_cost]
                );
            }

            console.log(`✓ Inserted ${sampleData.length} sample records`);
        } else {
            console.log(`\n✓ Database already contains ${sampleCount.rows[0].count} records`);
        }

        console.log('\n✅ Database setup complete!\n');

    } catch (error) {
        console.error('❌ Error setting up database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

setupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
