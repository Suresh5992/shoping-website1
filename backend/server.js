app.post('/api/send-otp', async (req, res) => {
  const { mobile } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await db.query(
      "INSERT INTO otps (mobile, otp, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
      [mobile, otp]
    );

    res.json({ ok: true, demoOtp: otp });

  } catch (err) {
    console.error("db otp save error:", err);
    res.status(500).json({ error: "db_error" });
  }
});
