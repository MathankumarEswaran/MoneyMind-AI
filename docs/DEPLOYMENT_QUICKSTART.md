# MoneyMind AI - Quick Deployment Guide

Get MoneyMind AI up and running in production in minutes.

## Option 1: Docker Compose (Easiest)

### Prerequisites
- Docker & Docker Compose installed
- Domain name (optional, works with localhost)

### Steps

1. **Clone and configure**
```bash
git clone https://github.com/yourusername/moneymind-ai.git
cd moneymind-ai
cp .env.example .env
```

2. **Generate secrets**
```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```
Add these to your `.env` file.

3. **Update .env**
```env
POSTGRES_PASSWORD=your-strong-password
JWT_ACCESS_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-secret>
CORS_ORIGINS=https://yourdomain.com  # or http://localhost:8080
COOKIE_SECURE=true  # if using HTTPS
DATABASE_URL=postgresql://moneymind:your-strong-password@postgres:5432/moneymind?schema=public
```

4. **Deploy**
```bash
docker compose up -d
```

5. **Access**
- Frontend: http://localhost:8080
- API: http://localhost:4000

Done! Migrations run automatically.

## Option 2: Manual Deployment

### Prerequisites
- Node.js 22+, PostgreSQL 16+

### Steps

1. **Install and build**
```bash
npm ci
npm run build
```

2. **Setup database**
```bash
# Create DB (in PostgreSQL)
createdb moneymind
```

3. **Configure environment**
```bash
cp apps/api/.env.example apps/api/.env
# Edit with your DATABASE_URL and JWT secrets
```

4. **Migrate**
```bash
cd apps/api
npx prisma migrate deploy
cd ../..
```

5. **Run**
```bash
# API
cd apps/api && NODE_ENV=production node dist/server.js &

# Web - serve dist/ with nginx or similar
```

## Verification

```bash
# Check API health
curl http://localhost:4000/api/v1/health

# Check API ready
curl http://localhost:4000/api/v1/ready
```

Expected response:
```json
{"data":{"status":"ok",...}}
```

## First User

1. Go to http://localhost:8080/register
2. Create your account
3. Start tracking finances!

## Need Help?

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed configuration, troubleshooting, and production best practices.
