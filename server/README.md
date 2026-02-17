Big Store API
=================

This small Express API provides endpoints for sending SMS OTPs and transactional emails used by the demo frontend.

Install
-------

1. cd to the server folder

```bash
cd web/server
npm install
```

2. Copy `.env.example` to `.env` and fill provider credentials (Twilio or SendGrid) if you want real SMS/email.

Run
---

```bash
npm start
```

Endpoints
---------
- POST /api/send-otp { mobile }
- POST /api/verify-otp { mobile, otp }
- POST /api/send-email { to, subject, text, html }

Notes
-----
- If Twilio or SendGrid credentials are not provided the server will log OTPs and email bodies and return a demo success response — useful for local testing.
- The OTP store is in-memory and not persistent. For production use replace with a short-lived DB or cache (Redis).

Docker
------
A Docker setup is included to run the frontend (nginx) and the API together.

Build and run with docker-compose from the `web` folder:

```bash
cd web
docker-compose up --build
```

- Frontend will be available at http://localhost:8080
- API will be available at http://localhost:3000 (also proxied at /api from frontend)
