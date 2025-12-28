import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 30 });

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.message);
  } else {
    console.log('✅ PostgreSQL connected successfully');
    release();
  }
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/**
 * GET /api/current
 * Returns most recent energy prices from database
 */
app.get('/api/current', async (req, res) => {
  try {
    const cacheKey = 'current_prices';
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log('✓ Returning cached current prices');
      return res.json({ ...cached, cached: true });
    }

    // Get latest COMPLETE record for CEN/COR/CEBpp (may be from yesterday)
    const completeResult = await pool.query(
      `SELECT
        dtime,
        period,
        cen_cost,
        cor_cost,
        ceb_pp_cost
      FROM pse_energy_prices
      WHERE cen_cost IS NOT NULL
        AND cor_cost IS NOT NULL
        AND ceb_pp_cost IS NOT NULL
      ORDER BY dtime DESC
      LIMIT 1`
    );

    // Get NEAREST FUTURE CSDAC (forecast for current/next 15min period)
    // Use JavaScript Date to handle timezone correctly
    const now = new Date();
    const oneMinuteAhead = new Date(now.getTime() + 60 * 1000);
    console.log('[DEBUG] Now:', now.toISOString(), '| Looking for CSDAC >= ', oneMinuteAhead.toISOString());

    const csdacResult = await pool.query(
      `SELECT
        dtime,
        period,
        csdac_pln
      FROM pse_energy_prices
      WHERE csdac_pln IS NOT NULL
        AND dtime >= $1
      ORDER BY dtime ASC
      LIMIT 1`,
      [oneMinuteAhead]
    );

    if (completeResult.rows.length === 0 && csdacResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No data available',
        message: 'Database is empty. Make sure n8n workflow is running and collecting data.'
      });
    }

    const complete = completeResult.rows[0] || {};

    // Helper: Generate period string from dtime (Poland timezone: CET/CEST)
    // Automatically handles winter (UTC+1) and summer (UTC+2) time
    const generatePeriod = (dtime) => {
      if (!dtime) return null;
      const dt = new Date(dtime);
      const startDt = new Date(dt.getTime() - 15 * 60 * 1000);

      // Use Europe/Warsaw timezone (auto-handles CET/CEST)
      const formatTime = (date) => {
        const parts = date.toLocaleString('pl-PL', {
          timeZone: 'Europe/Warsaw',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).split(':');
        return `${parts[0]}:${parts[1]}`;
      };

      return `${formatTime(startDt)} - ${formatTime(dt)}`;
    };

    // Get CSDAC - try future first, then fallback to latest
    let csdac = csdacResult.rows[0];
    console.log('[DEBUG] CSDAC future query result:', {
      rowCount: csdacResult.rows.length,
      firstRow: csdacResult.rows[0]
    });
    if (!csdac) {
      console.log('[DEBUG] No future CSDAC found, using fallback');
      const fallback = await pool.query(
        `SELECT dtime, period, csdac_pln FROM pse_energy_prices
         WHERE csdac_pln IS NOT NULL ORDER BY dtime DESC LIMIT 1`
      );
      csdac = fallback.rows[0] || {};
      console.log('[DEBUG] Fallback CSDAC:', csdac);
    }

    // Calculate change from previous record
    const prevResult = await pool.query(
      `SELECT cen_cost FROM pse_energy_prices
       WHERE dtime < $1 AND cen_cost IS NOT NULL
       ORDER BY dtime DESC
       LIMIT 1`,
      [complete.dtime]
    );

    const cen_change = prevResult.rows.length > 0 && complete.cen_cost
      ? ((complete.cen_cost - prevResult.rows[0].cen_cost) / prevResult.rows[0].cen_cost) * 100
      : 0;

    const response = {
      // Complete data (CEN, COR, CEBpp) - may be from yesterday
      dtime: complete.dtime,
      period: complete.period || generatePeriod(complete.dtime),
      cen_cost: complete.cen_cost,
      cor_cost: complete.cor_cost,
      ceb_pp_cost: complete.ceb_pp_cost,
      cen_change,

      // Latest CSDAC (forecast) - from today
      csdac_dtime: csdac.dtime,
      csdac_period: csdac.period || generatePeriod(csdac.dtime),
      csdac_pln: csdac.csdac_pln
    };

    cache.set(cacheKey, response);
    res.json({ ...response, cached: false });
  } catch (error) {
    console.error('Error fetching current prices:', error);
    res.status(500).json({
      error: 'Failed to fetch current prices',
      message: error.message
    });
  }
});

/**
 * GET /api/history?hours=24
 * Returns historical energy prices from database
 */
app.get('/api/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const cacheKey = `history_${hours}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log(`✓ Returning cached history for ${hours} hours`);
      return res.json({ data: cached, cached: true });
    }

    // Query historical data from database
    const result = await pool.query(
      `SELECT
        dtime,
        cen_cost,
        csdac_pln,
        cor_cost,
        ceb_pp_cost
      FROM pse_energy_prices
      WHERE dtime >= NOW() - INTERVAL '${hours} hours'
      ORDER BY dtime DESC`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No historical data available',
        message: `No data found for the last ${hours} hours`
      });
    }

    cache.set(cacheKey, result.rows);
    res.json({ data: result.rows, cached: false });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({
      error: 'Failed to fetch historical data',
      message: error.message
    });
  }
});

/**
 * GET /api/stats
 * Returns statistics (min, max, avg) calculated from database
 */
app.get('/api/stats', async (req, res) => {
  try {
    const cacheKey = 'stats';
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log('✓ Returning cached stats');
      return res.json({ ...cached, cached: true });
    }

    // Calculate statistics using SQL aggregation
    const result = await pool.query(
      `SELECT
        AVG(cen_cost) as avg,
        MIN(cen_cost) as min,
        MAX(cen_cost) as max,
        COUNT(*) as count,
        (SELECT dtime FROM pse_energy_prices WHERE cen_cost = MIN(cen_cost) ORDER BY dtime DESC LIMIT 1) as min_time,
        (SELECT dtime FROM pse_energy_prices WHERE cen_cost = MAX(cen_cost) ORDER BY dtime DESC LIMIT 1) as max_time
      FROM pse_energy_prices
      WHERE dtime >= NOW() - INTERVAL '24 hours'`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No data available for statistics'
      });
    }

    const stats = {
      ...result.rows[0],
      timestamp: new Date()
    };

    cache.set(cacheKey, stats);
    res.json({ ...stats, cached: false });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      timestamp: new Date(),
      database: 'connected',
      cache_size: cache.keys().length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * POST /api/cache/clear
 * Clear cache manually
 */
app.post('/api/cache/clear', (req, res) => {
  cache.flushAll();
  console.log('✓ Cache cleared');
  res.json({ message: 'Cache cleared successfully' });
});

/**
 * POST /api/trigger-refresh
 * Manually trigger n8n workflow to collect fresh data from PSE API
 */
app.post('/api/trigger-refresh', async (req, res) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const authHeader = process.env.N8N_WEBHOOK_AUTH_HEADER || 'Authorization';
    const authValue = process.env.N8N_WEBHOOK_AUTH_VALUE;

    if (!webhookUrl) {
      return res.status(500).json({
        error: 'n8n webhook not configured',
        message: 'Please set N8N_WEBHOOK_URL in .env.local'
      });
    }

    console.log('🔄 Triggering n8n workflow via webhook...');

    // Build headers
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add authentication header if configured
    if (authValue) {
      headers[authHeader] = authValue;
    }

    // Call n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        trigger: 'manual',
        source: 'dashboard',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n webhook responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json().catch(() => ({ success: true }));

    // Clear cache so next request gets fresh data
    cache.flushAll();

    console.log('✅ Workflow triggered successfully via webhook');

    res.json({
      success: true,
      message: 'Data collection triggered. Refresh dashboard in a few seconds.',
      workflow_response: data
    });
  } catch (error) {
    console.error('❌ Error triggering workflow:', error);
    res.status(500).json({
      error: 'Failed to trigger workflow',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`\n🚀 PSE Energy Monitor Backend Server`);
  console.log(`   Running on: http://localhost:${port}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   Cache TTL: ${cache.options.stdTTL}s`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
