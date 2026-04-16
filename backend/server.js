app.post('/api/send-otp', async (req, res) => {
  const { mobile } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = Date.now() + 5 * 60 * 1000;

  try {
    await db.query(
      "INSERT INTO otps (mobile, otp, expires_at) VALUES ($1, $2, $3)",
      [mobile, otp, expires_at]
    );

    res.json({ ok: true, demoOtp: otp });

  } catch (err) {
    console.error("db otp save error:", err);
    res.status(500).json({ error: "db_error" });
  }
});
