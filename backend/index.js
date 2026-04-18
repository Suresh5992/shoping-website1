const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

// ---------------- DB CONNECTION ----------------
const dbConfig = {
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'postgres',
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'bigstore',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
};

console.log('DB config:', {
  user: dbConfig.user,
  host: dbConfig.host,
  database: dbConfig.database,
  port: dbConfig.port,
});

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on idle client', err);
});

const DB_CONNECT_RETRIES = parseInt(process.env.DB_CONNECT_RETRIES || '12', 10);
const DB_CONNECT_DELAY_MS = parseInt(process.env.DB_CONNECT_DELAY_MS || '5000', 10);

async function waitForDatabase() {
  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`✅ Database connected on attempt ${attempt}`);
      return;
    } catch (err) {
      const message = err.message || err.toString();
      console.warn(`Database connect attempt ${attempt} failed: ${message}`);
      if (attempt === DB_CONNECT_RETRIES) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, DB_CONNECT_DELAY_MS));
    }
  }
}

// ---------------- CREATE TABLES ----------------
async function initializeDatabase() {
  await waitForDatabase();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otps (
      mobile VARCHAR PRIMARY KEY,
      otp VARCHAR(6),
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      mobile TEXT UNIQUE NOT NULL,
      address TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logins (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      login_time TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      transaction_id VARCHAR,
      amount NUMERIC,
      status TEXT DEFAULT 'completed',
      products JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      verified_at TIMESTAMP,
      verified_by TEXT
    );
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id VARCHAR;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount NUMERIC;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS products JSONB;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_by TEXT;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name = 'payload'
      )
      OR EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
          AND column_name = 'id'
          AND data_type = 'character varying'
      ) THEN
        CREATE TABLE IF NOT EXISTS orders_new (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          transaction_id VARCHAR,
          amount NUMERIC,
          status TEXT DEFAULT 'completed',
          products JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          verified_at TIMESTAMP,
          verified_by TEXT
        );

        INSERT INTO users (mobile, name, email, address)
        SELECT DISTINCT
          payload->'shipping'->>'mobile',
          payload->'shipping'->>'name',
          payload->'shipping'->>'email',
          payload->'shipping'->>'address'
        FROM orders
        WHERE payload IS NOT NULL
          AND payload->'shipping'->>'mobile' IS NOT NULL
        ON CONFLICT (mobile) DO NOTHING;

        INSERT INTO orders_new (transaction_id, user_id, amount, products, verified_at, verified_by, created_at)
        SELECT
          o.id,
          u.id,
          (o.payload->>'total')::NUMERIC,
          o.payload->'products',
          NULLIF(o.payload->>'verified_at','')::TIMESTAMP,
          o.payload->>'verified_by',
          o.created_at
        FROM orders o
        LEFT JOIN users u ON u.mobile = o.payload->'shipping'->>'mobile'
        WHERE o.payload IS NOT NULL;

        DROP TABLE orders;
        ALTER TABLE orders_new RENAME TO orders;
      END IF;
    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'otps'
          AND column_name = 'expires_at'
          AND data_type = 'bigint'
      ) THEN
        ALTER TABLE otps
        ALTER COLUMN expires_at TYPE TIMESTAMP
        USING to_timestamp(expires_at / 1000.0);
      END IF;
    END
    $$;
  `);

  console.log("✅ Tables ready");
}

// ---------------- SEND OTP ----------------
app.post('/api/send-otp', async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ error: 'mobile required' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const insertOtpQuery = `INSERT INTO otps (mobile, otp, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
       ON CONFLICT (mobile)
       DO UPDATE SET otp = EXCLUDED.otp,
                     expires_at = EXCLUDED.expires_at`;

  console.log('[SEND OTP] query params:', { mobile, otp });

  try {
    await pool.query(insertOtpQuery, [mobile, otp]);

    console.log('[OTP SAVED]', mobile, otp);

    return res.json({ ok: true, demoOtp: otp });

  } catch (err) {
    console.error('db otp save error:', err);
    return res.status(500).json({ error: 'db_error' });
  }
});

// ---------------- VERIFY OTP ----------------
app.post('/api/verify-otp', async (req, res) => {
  const { mobile, otp, order } = req.body;

  if (!mobile || !otp) {
    return res.status(400).json({ error: 'mobile and otp required' });
  }

  try {
    const r = await pool.query(
      'SELECT otp, expires_at FROM otps WHERE mobile = $1',
      [mobile]
    );

    if (!r.rows.length) {
      return res.status(400).json({ error: 'no_otp' });
    }

    const rec = r.rows[0];

    console.log('[VERIFY OTP] mobile=', mobile, 'expected=', rec.otp, 'received=', otp, 'expires_at=', rec.expires_at);

    // expiry check
    const expiresAt = rec.expires_at instanceof Date
      ? rec.expires_at.getTime()
      : Date.parse(rec.expires_at);

    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      await pool.query('DELETE FROM otps WHERE mobile=$1', [mobile]);
      return res.status(400).json({ error: 'expired' });
    }

    // match check
    if (rec.otp !== String(otp)) {
      return res.status(400).json({ error: 'verify_failed' });
    }

    // delete OTP after success
    await pool.query('DELETE FROM otps WHERE mobile=$1', [mobile]);

    // Insert or update user
    const userResult = await pool.query(`
      INSERT INTO users (mobile, name, email, address)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (mobile) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        email = COALESCE(EXCLUDED.email, users.email),
        address = COALESCE(EXCLUDED.address, users.address)
      RETURNING id
    `, [mobile, null, null, null]);

    const userId = userResult.rows[0].id;

    // Insert login
    await pool.query(`
      INSERT INTO logins (user_id) VALUES ($1)
    `, [userId]);

    // save order
    if (order && order.id) {
      try {
        const shipping = order.shipping || {};
        await pool.query(`
          INSERT INTO orders (transaction_id, user_id, amount, products, verified_at, verified_by, created_at)
          VALUES ($1, $2, $3, $4, NOW(), $5, $6)
          ON CONFLICT (transaction_id) DO NOTHING
        `, [
          order.id,
          userId,
          order.total,
          JSON.stringify(order.products || []),
          mobile,
          order.date ? new Date(order.date) : new Date()
        ]);

        // Update user with shipping info
        await pool.query(`
          UPDATE users SET
            name = COALESCE($2, name),
            email = COALESCE($3, email),
            address = COALESCE($4, address)
          WHERE id = $1
        `, [userId, shipping.name, shipping.email, shipping.address]);
      } catch (e) {
        console.error('save order error:', e);
      }
    }

    return res.json({ ok: true, orderId: order?.id || null });

  } catch (e) {
    console.error('verify-otp error', e);
    return res.status(500).json({ error: 'verify_failed' });
  }
});

// ---------------- SEND EMAIL (OPTIONAL) ----------------
app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body || {};
  if (!to) return res.status(400).json({ error: 'to required' });

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'send_failed' });
  }
});

// ---------------- ORDERS LIST ----------------
app.get('/api/orders', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id, o.transaction_id, o.amount, o.status, o.products, o.created_at, o.verified_at, o.verified_by,
             u.name, u.email, u.mobile, u.address
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT 100
    `);
    return res.json({ ok: true, orders: result.rows });
  } catch (err) {
    console.error('orders fetch error', err);
    return res.status(500).json({ error: 'orders_fetch_failed' });
  }
});

// ---------------- USERS ANALYTICS ----------------
app.get('/api/users-analytics', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.name,
        u.email,
        u.mobile,
        u.address,
        COUNT(DISTINCT l.id) AS login_count,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.amount), 0) AS total_amount
      FROM users u
      LEFT JOIN logins l ON u.id = l.user_id
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY total_amount DESC
    `);
    return res.json({ ok: true, analytics: result.rows });
  } catch (err) {
    console.error('analytics fetch error', err);
    return res.status(500).json({ error: 'analytics_fetch_failed' });
  }
});

// ---------------- HEALTH CHECK ----------------
app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true });
  } catch (err) {
    console.error('healthz error', err);
    return res.status(503).json({ ok: false, error: 'db_unavailable' });
  }
});

// ---------------- START SERVER ----------------
const port = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(port, () => console.log('🚀 Big Store API running on port', port));
  })
  .catch((err) => {
    console.error('Failed to start server because database initialization failed:', err);
    process.exit(1);
  });
