# Big Store API

The `backend/` folder contains the Express API server for the Big Store application.

## What it does

- Sends OTP codes to mobile numbers for verification
- Verifies OTP codes
- Stores order transactions in PostgreSQL
- Sends optional transactional emails
- Exposes orders for frontend order history

## Setup

```powershell
cd c:\big_store_web\backend
npm install
copy .env.example .env
```

Edit `backend/.env` to configure database and SMTP credentials.

## Run

```powershell
npm start
```

The API listens on the port configured in `PORT`, default `3000`.

## Endpoints

- `POST /api/send-otp` — body: `{ "mobile": "1234567890" }`
- `POST /api/verify-otp` — body: `{ "mobile": "1234567890", "otp": "123456", "order": { ... } }`
- `POST /api/send-email` — body: `{ "to": "user@example.com", "subject": "...", "text": "..." }`
- `GET /api/orders` — returns stored orders

## Database

The backend stores data in PostgreSQL and creates these tables automatically:

- `otps`
- `orders`

The `orders` table now includes fields for:

- `id` / `transaction_id`
- `name`
- `email`
- `mobile`
- `products` (JSONB)
- `address`
- `total`
- `created_at`
- `verified_at`
- `verified_by`

## Notes

- The backend uses `pg` to connect to PostgreSQL.
- The frontend should call backend routes through `/api/`.
- This README is aligned with the current repository structure.
