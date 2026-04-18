# Big Store Web

## Overview

This repository contains the Big Store demo application with:

- A static frontend in `frontend/`
- A Node.js / Express backend in `backend/`
- PostgreSQL persistence for OTPs and order transactions
- Kubernetes manifests in `k8s/` for deployment into a cluster

The application stores order transactions in Postgres with fields for transaction ID, customer name, email, mobile, shipping address, product details, order total, and timestamps.

## Project structure

- `frontend/` — static website assets, checkout flow, order history page, and success UI
- `backend/` — Express API server, PostgreSQL connection, OTP verification, order persistence
- `database/` — database-related files and schema artifacts
- `k8s/` — Kubernetes deployment and service manifests

## Run locally

### Backend

```powershell
cd c:\big_store_web\backend
npm install
copy .env.example .env
npm start
```

The backend listens on `http://localhost:3000` by default.

### Frontend

Serve the `frontend/` directory with a static web server or open from a local file server. The frontend expects API requests to reach `/api/*`.

## Backend endpoints

- `POST /api/send-otp` — request OTP for a mobile number
- `POST /api/verify-otp` — verify OTP and save order transaction
- `POST /api/send-email` — optional transactional email sending
- `GET /api/orders` — fetch saved orders with user details
- `GET /api/users-analytics` — get user analytics (name, email, mobile, address, login count, order count, total amount)

## Environment

The backend reads these environment variables from `backend/.env.example`:

- `PORT`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Database Schema

The backend creates these tables automatically:

- `users` — user accounts (id, name, email, mobile, address, created_at)
- `logins` — login history (id, user_id, login_time)
- `orders` — transactions (id, user_id, transaction_id, amount, status, products, created_at, verified_at, verified_by)
- `otps` — OTP storage (mobile, otp, expires_at, created_at)

The `/api/users-analytics` endpoint provides the analytics table you requested, showing user details with login and order counts.

## Kubernetes

The `k8s/` folder contains deployment and service YAML for:

- `backend`
- `frontend`
- `postgres`
- `pgadmin`

## Notes for GitHub / Jenkins

- Push changes to GitHub to trigger your Jenkins pipeline if it is configured to monitor this repository.
- Ensure `backend/.env` and production database credentials are provided in the deployment environment.
- The current code now persists order records to Postgres and exposes `/api/orders` for order history.

## Fixes included

- Updated the success page to use a robust icon rendering method so it displays correctly in browsers
- Added project documentation for local startup and deployment
- Confirmed the order persistence flow saves transaction data to the database
