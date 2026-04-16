const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

// ---------------- DB CONNECTION ----------------
const pool = new Pool({
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'postgres',
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'bigstore',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
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
      expires_at BIGINT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR PRIMARY KEY,
      payload JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
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
  const expires_at = Date.now() + 5 * 60 * 1000;

  try {
    await pool.query(
      `INSERT INTO otps (mobile, otp, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (mobile)
       DO UPDATE SET otp = EXCLUDED.otp,
                     expires_at = EXCLUDED.expires_at`,
      [mobile, otp, expires_at]
    );

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

    // expiry check
    if (Date.now() > parseInt(rec.expires_at, 10)) {
      await pool.query('DELETE FROM otps WHERE mobile=$1', [mobile]);
      return res.status(400).json({ error: 'expired' });
    }

    // match check
    if (rec.otp !== otp) {
      return res.status(400).json({ error: 'verify_failed' });
    }

    // delete OTP after success
    await pool.query('DELETE FROM otps WHERE mobile=$1', [mobile]);

    // save order
    if (order && order.id) {
      try {
        await pool.query(
          `INSERT INTO orders (id, payload, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [order.id, JSON.stringify(order)]
        );
      } catch (e) {
        console.error('save order error:', e);
      }
    }

    return res.json({ ok: true });

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
