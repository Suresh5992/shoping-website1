require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

let twilioClient = null;
if(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN){
  const Twilio = require('twilio');
  twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

let sgMail = null;
if(process.env.SENDGRID_API_KEY){
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres connection
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined,
  host: process.env.POSTGRES_HOST || process.env.POSTGRES_HOSTNAME || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'bigstore',
  port: process.env.POSTGRES_PORT || 5432,
});

async function initDb(){
  await pool.query(`CREATE TABLE IF NOT EXISTS otps (
    mobile TEXT PRIMARY KEY,
    otp TEXT,
    expires BIGINT
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    payload JSONB
  )`);
}
initDb().catch(err=>console.error('db init failed', err));

app.get('/api/ping', (req,res)=> res.json({ok:true}));

app.post('/api/send-otp', async (req,res) => {
  const mobile = (req.body && req.body.mobile) || '';
  if(!mobile) return res.status(400).json({ error: 'mobile required' });

  const otp = Math.floor(100000 + Math.random()*900000).toString();
  const expires = Date.now() + 5*60*1000;
  try{
    await pool.query(`INSERT INTO otps(mobile, otp, expires) VALUES($1,$2,$3)
      ON CONFLICT(mobile) DO UPDATE SET otp = EXCLUDED.otp, expires = EXCLUDED.expires`, [mobile, otp, expires]);
  }catch(e){ console.error('db otp save', e); }

  try{
    if(twilioClient && process.env.TWILIO_FROM){
      await twilioClient.messages.create({ body: `Your OTP is ${otp}`, from: process.env.TWILIO_FROM, to: mobile });
      return res.json({ ok: true });
    }
    // demo fallback: return otp in response (for local testing only)
    console.log('[demo] OTP for', mobile, otp);
    return res.json({ ok: true, demoOtp: otp });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'sms_failed' });
  }
});

app.post('/api/verify-otp', async (req,res) => {
  const mobile = (req.body && req.body.mobile) || '';
  const otp = (req.body && req.body.otp) || '';
  const order = (req.body && req.body.order) || null;
  if(!mobile || !otp) return res.status(400).json({ error: 'mobile and otp required' });
  try{
    const r = await pool.query('SELECT otp, expires FROM otps WHERE mobile = $1', [mobile]);
    if(r.rowCount === 0) return res.status(400).json({ error: 'no_otp' });
    const rec = r.rows[0];
    if(Date.now() > parseInt(rec.expires,10)) { await pool.query('DELETE FROM otps WHERE mobile=$1', [mobile]); return res.status(400).json({ error: 'expired' }); }
    if(rec.otp !== otp) return res.status(400).json({ error: 'invalid' });
    // success: delete otp
    await pool.query('DELETE FROM otps WHERE mobile=$1', [mobile]);

    // optionally persist order to DB
    if(order && order.id){
      try{ await pool.query('INSERT INTO orders(id,payload) VALUES($1,$2) ON CONFLICT DO NOTHING', [order.id, order]); }catch(e){ console.error('save order', e); }
    }

    return res.json({ ok: true });
  }catch(e){ console.error('verify-otp error', e); return res.status(500).json({ error: 'verify_failed' }); }
});

app.post('/api/send-email', async (req,res) => {
  const { to, subject, text, html } = req.body || {};
  if(!to) return res.status(400).json({ error: 'to required' });

  try{
    if(sgMail){
      await sgMail.send({ to, from: process.env.SENDGRID_FROM, subject, text, html });
      return res.json({ ok: true });
    }

    if(process.env.SMTP_HOST && process.env.SMTP_USER){
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT||587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
      return res.json({ ok: true });
    }

    // demo fallback
    console.log('[demo] send-email', to, subject, text || html);
    return res.json({ ok: true, demo: true });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'send_failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Big Store API running on port', port));
