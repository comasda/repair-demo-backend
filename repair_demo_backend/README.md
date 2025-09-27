# repair_demo_backend

Backend API for your WeChat mini-program. Matches `globalData.API = https://your-domain-or-ip:8080/api`.

## Quick Start (no Docker)

1. Install Node.js 18+ and MongoDB 6/7 on your Ubuntu server.
2. Copy `.env.example` to `.env` and adjust if needed.
3. Install deps & run:

```bash
npm install
npm run seed   # optional: load sample technicians & orders
npm start
```

API will run on `http://<server-ip>:8080`.

## With Docker (recommended)

```bash
docker compose up --build -d
# (optional) seed inside the container
docker compose exec api npm run seed
```

## REST API

- POST `/api/users/register` `{username, password, role?}`
- POST `/api/users/login` `{username, password}`
- GET  `/api/users/:id`

- GET  `/api/technicians`
- POST `/api/technicians` `{name}`

- GET  `/api/orders`
- POST `/api/orders` `{customer, customerId, device, issue}`
- GET  `/api/orders/:id`
- PUT  `/api/orders/:id/assign` `{technicianId, technicianName}`
- PUT  `/api/orders/:id/status` `{status: 'pending'|'assigned'|'done', note?}`
- DELETE `/api/orders/:id`

> Note: Passwords are stored in plaintext for MVP simplicity. For production,
> replace with bcrypt hashing + JWT auth.

## CORS

Default allows all origins. Adjust `CORS_ORIGINS` in `.env` as needed.

## Health Check

`GET /api/health` → `{ ok: true }`
