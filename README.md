# Big Store Web

## Overview

This repository contains a simple ecommerce-style demo with a static frontend and a Node.js backend API. The app uses PostgreSQL for OTP verification and order persistence.

The current setup includes enhancements for a production-style experience, such as:

- Frontend footer version labels for `frontend` and `backend`
- A richer success page with live production badge, animated product image cards, promo blocks, and upcoming feature teasers
- Order history access restricted to signed-in users only
- Cart and price display converted to Indian Rupees (`₹`)

## Repository structure

- `frontend/` - static HTML/CSS/JS site and Nginx proxy configuration
- `backend/` - Express API service, dependencies, and environment example
- `database/` - placeholder for database deployment artifacts, SQL scripts, and schema files

## Technology stack

- Frontend: HTML, CSS, JavaScript, Bootstrap, Font Awesome, jQuery
- Backend: Node.js, Express, body-parser, cors, dotenv
- Database: PostgreSQL
- Optional integrations: Twilio SMS, SendGrid / SMTP email

## Ports and service mapping

| Service | Port | Description |
|---|---|---|
| Backend API | `3000` | Express app listens on port `3000` |
| PostgreSQL | `5432` | Default Postgres port |

## Backend local run

1. Open a terminal and go to the backend folder:

```powershell
cd c:\big_store_web\backend
```

2. Install dependencies:

```powershell
npm install
```

3. Copy environment example and configure values:

```powershell
copy .env.example .env
```

4. Start the backend:

```powershell
npm start
```

5. The API will be available at:

```text
http://localhost:3000
```

## API endpoints

- `GET /api/ping` — health check
- `POST /api/send-otp` — send or log OTP
- `POST /api/verify-otp` — verify OTP and optionally save order
- `POST /api/send-email` — send transactional email

### Example request body

```json
{
  "mobile": "+1234567890"
}
```

## Frontend hosting

The frontend lives in `frontend/` and is a static site. It is expected to be served by a static web server such as Nginx.

The frontend is configured to call backend APIs via the `/api/` path.

### `frontend/default.conf`

- Static assets are served from `/usr/share/nginx/html`
- Requests to `/api/` are proxied to the backend at `http://api:3000/api/`

> In local development, if you are not using service discovery, you may need to change the proxy target to `http://localhost:3000/api/` or configure your reverse proxy accordingly.

## Database

The backend uses PostgreSQL and expects these environment variables from `backend/.env.example`:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

The backend creates the following tables automatically:

- `otps`
- `orders`

## Notes

- There are no Dockerfiles, Docker Compose files, or Kubernetes manifests in this repo currently.
- The `database/` folder is reserved for future database deployment files.
- The project currently requires manual hosting of the frontend and backend.

## Connecting frontend to backend

1. Start the backend on `localhost:3000`.
2. Serve the contents of `frontend/` with a static server.
3. Ensure `/api/` requests from the frontend are proxied to `http://localhost:3000/api/`.

## Next steps

- Add a production-ready Nginx or static web server deployment for `frontend/`
- Add Kubernetes manifests for `frontend`, `backend`, and Postgres
- Add a CI/CD pipeline (Jenkinsfile) to build and deploy the app
