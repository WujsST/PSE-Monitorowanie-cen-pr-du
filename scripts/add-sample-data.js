import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addSampleData() {
    const client = await pool.connect();

    try {
        console.log('📊 Adding sample data to pse_energy_prices...\n');

        const now = new Date();
        const sampleData = [];

        // Generate 48 records (24 hours, every 30 minutes)
        for (let i = 0; i < 48; i++) {
            const dtime = new Date(now.getTime() - (i * 30 * 60000));
            const hour = dtime.getHours();
            const isPeak = (hour >= 17 && hour <= 21) || (hour >= 7 && hour <= 10);
            const isNight = hour >= 23 || hour <= 5;

            let basePrice = 400;
            if (isPeak) basePrice = 600;
            if (isNight) basePrice = 280;

            const variance = 100;
            const randomOffset = () => Math.random() * variance * 2 - variance;

            sampleData.push({
                dtime,
                dtime_utc: new Date(dtime.getTime() - dtime.getTimezoneOffset() * 60000),
                business_date: dtime.toISOString().split('T')[0],
                cen_cost: Math.max(0, basePrice + randomOffset()),
                csdac_pln: Math.max(0, basePrice * 0.9 + randomOffset() * 0.5),
                cor_cost: Math.max(0, basePrice * 0.8 + randomOffset() * 0.3),
                ceb_pp_cost: Math.max(0, basePrice * 0.95 + randomOffset() * 0.4),
                ceb_sr_cost: Math.max(0, basePrice * 0.93 + randomOffset() * 0.35),
                balance: (Math.random() - 0.5) * 1000,
                balance_power: (Math.random() - 0.5) * 100
            });
        }

        // Insert data
        for (const data of sampleData) {
            await client.query(
                `INSERT INTO pse_energy_prices
         (dtime, dtime_utc, business_date, cen_cost, csdac_pln, cor_cost, ceb_pp_cost, ceb_sr_cost, balance, balance_power)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (dtime, business_date) DO NOTHING`,
                [
                    data.dtime, data.dtime_utc, data.business_date,
                    data.cen_cost, data.csdac_pln, data.cor_cost,
                    data.ceb_pp_cost, data.ceb_sr_cost, data.balance, data.balance_power
                ]
            );
        }

        console.log(`✓ Inserted ${sampleData.length} sample records`);

        // Show sample
        const sample = await client.query(
            'SELECT dtime, cen_cost, csdac_pln FROM pse_energy_prices ORDER BY dtime DESC LIMIT 3'
        );

        console.log('\n📋 Sample data:');
        sample.rows.forEach(row => {
            console.log(`  ${row.dtime.toISOString()} - CEN: ${row.cen_cost}, CSDAC: ${row.csdac_pln}`);
        });

        console.log('\n✅ Sample data added successfully!\n');

    } catch (error) {
        console.error('❌ Error adding sample data:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addSampleData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
