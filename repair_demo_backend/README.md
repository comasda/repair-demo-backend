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

## Cloud Storage Configuration (Implemented)

✅ **腾讯云COS统一存储已实施**：系统使用腾讯云COS进行图片存储，网页端可以直接访问。

### 配置说明
1. 创建腾讯云COS存储桶并设置为公开读
2. 获取API密钥并配置到`.env`文件：

```bash
# Tencent Cloud Credentials
TENCENT_SECRET_ID=your_secret_id_here
TENCENT_SECRET_KEY=your_secret_key_here

# COS Bucket Configuration
COS_BUCKET_NAME=your_bucket_name_here
TENCENT_REGION=ap-guangzhou

# WeChat Configuration (for migration)
WECHAT_APPID=your_wechat_appid
WECHAT_SECRET=your_wechat_secret
WECHAT_ENV_ID=your_wechat_env_id
```

3. 系统会自动将微信云开发的图片迁移到COS，并返回可直接访问的URL。

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
