# MoneyMind AI - Production Deployment Guide

This guide covers deploying MoneyMind AI to production environments. For local development, see [README.md](./README.md).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment (Recommended)](#docker-deployment-recommended)
- [Manual Deployment](#manual-deployment)
- [Database Migrations](#database-migrations)
- [Qdrant Setup (For AI/RAG Features)](#qdrant-setup-for-airag-features)
- [AI Provider Configuration](#ai-provider-configuration)
- [Security Checklist](#security-checklist)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js**: >= 22.0.0
- **PostgreSQL**: 16+
- **Docker & Docker Compose** (for containerized deployment)
- **Domain/SSL** (for production with HTTPS)
- **AI Provider API keys** (if using AI features - OpenAI, Anthropic, etc.)

## Environment Configuration

### 1. Create Environment Files

Copy the example environment files and configure them with secure values.

#### Root `.env` (for Docker Compose)
```bash
cp .env.example .env
```

Edit `.env` with production values:
```env
# PostgreSQL
POSTGRES_USER=moneymind
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=moneymind
POSTGRES_PORT=5432

# Qdrant
QDRANT_HTTP_PORT=6333
QDRANT_GRPC_PORT=6334

# Ports
API_PORT=4000
WEB_PORT=8080

# CORS - your production domain
CORS_ORIGINS=https://yourdomain.com

# Database URL (use postgres service name in Docker)
DATABASE_URL=postgresql://moneymind:<strong-password>@postgres:5432/moneymind?schema=public

# JWT Secrets - MUST be different and at least 32 chars
JWT_ACCESS_SECRET=<generate-with-crypto>
JWT_REFRESH_SECRET=<generate-with-crypto>

# Token TTL
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30

# Cookie settings
COOKIE_SECURE=true  # Required for HTTPS

# Rate limiting
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

#### API Environment (`apps/api/.env`)
```bash
cp apps/api/.env.example apps/api/.env
```

Configure with production values (same as above). Key settings:
- `NODE_ENV=production`
- `COOKIE_SECURE=true` (if behind HTTPS)
- `TRUST_PROXY=true` (if behind load balancer/ingress)
- Configure AI provider settings (see [AI Provider Configuration](#ai-provider-configuration))

#### Web Environment (`apps/web/.env`)
For production builds, set `VITE_API_URL` if API is on different domain:
```env
VITE_API_URL=https://api.yourdomain.com/api
```
Otherwise leave unset to use same-origin requests.

## Docker Deployment (Recommended)

Docker Compose provides the complete stack: PostgreSQL, Qdrant, API migrations, API server, and web frontend.

### 1. Build and Start

```bash
# Build all services
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

### 2. Run Migrations

Migrations run automatically via the `migrate` service. To run manually:
```bash
docker compose run --rm migrate
```

### 3. Access the Application

- **Web**: http://localhost:8080 (or your configured WEB_PORT)
- **API**: http://localhost:4000 (or your configured API_PORT)
- **API Health**: http://localhost:4000/api/v1/health
- **API Ready**: http://localhost:4000/api/v1/ready
- **PostgreSQL**: localhost:5432
- **Qdrant**: http://localhost:6333

### 4. Stop and Clean Up

```bash
# Stop services
docker compose down

# Stop and remove volumes (WARNING: deletes all data)
docker compose down -v
```

## Manual Deployment

For deployment without Docker on a VPS/cloud instance.

### 1. Install Dependencies

```bash
npm ci --omit=dev=false
```

### 2. Build All Packages

```bash
npm run build
```

This builds `@moneymind/shared`, `@moneymind/api`, and `@moneymind/web`.

### 3. Setup PostgreSQL

Create database and user:
```sql
CREATE DATABASE moneymind;
CREATE USER moneymind WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE moneymind TO moneymind;
```

### 4. Run Migrations

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
cd ../..
```

### 5. Start API Server

```bash
cd apps/api
NODE_ENV=production node dist/server.js
```

Use a process manager like PM2 in production:
```bash
pm2 start dist/server.js --name moneymind-api
pm2 save
pm2 startup
```

### 6. Serve Web Frontend

The web app builds to static files in `apps/web/dist/`. Serve with:
- **Nginx** (recommended)
- **Apache**
- **CDN** (Cloudflare Pages, Vercel, Netlify, etc.)

Example Nginx config (see `apps/web/nginx.conf`):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/apps/web/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests (if same server)
    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Database Migrations

### Creating New Migrations (Development)

```bash
cd apps/api
npx prisma migrate dev --name migration_name
```

### Applying Migrations (Production)

```bash
cd apps/api
npx prisma migrate deploy
```

### Checking Migration Status

```bash
cd apps/api
npx prisma migrate status
```

### Rollback

Prisma doesn't have automatic rollback. For rollback:
1. Create a new migration that reverses the changes
2. Test in staging first
3. Apply with `prisma migrate deploy`

Always backup your database before migrations in production:
```bash
pg_dump -U moneymind -h localhost moneymind > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Qdrant Setup (For AI/RAG Features)

Qdrant is required for document ingestion and RAG features (Phases 4-5).

### Docker (Included)

Qdrant is included in docker-compose. Data persists in `qdrant-data` volume.

### Manual Installation

1. Download from [Qdrant releases](https://github.com/qdrant/qdrant/releases)
2. Run with configuration
3. Set `QDRANT_URL` in API env

### Configuration

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # Set if using Qdrant Cloud with auth
QDRANT_COLLECTION=moneymind_documents
```

### Health Check

```bash
curl http://localhost:6333/health
```

## AI Provider Configuration

MoneyMind AI supports multiple LLM providers. Configure in `apps/api/.env`.

### OpenAI

```env
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
AI_BASE_URL=  # Leave empty for default
```

### Anthropic

```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-sonnet-20241022
```

### Ollama (Local)

```env
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.1:8b
AI_API_KEY=  # Not needed for local Ollama
```

### Security Notes

- **Never** commit API keys to version control
- Store keys in environment variables or secret managers (AWS Secrets Manager, Vault, etc.)
- Use separate keys for dev/staging/production
- Set up rate limiting and quotas (already configured)
- Monitor usage and costs

### Embeddings

For RAG features, configure embeddings:

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

## Security Checklist

Before deploying to production:

- [ ] Generate strong, unique JWT secrets (min 32 chars)
- [ ] Set `NODE_ENV=production`
- [ ] Set `COOKIE_SECURE=true` (HTTPS only)
- [ ] Set `TRUST_PROXY=true` if behind reverse proxy
- [ ] Configure proper CORS origins (no wildcards)
- [ ] Use strong PostgreSQL password
- [ ] Enable HTTPS/TLS
- [ ] Set up firewall rules (only expose 80/443)
- [ ] Configure rate limiting appropriately
- [ ] Never commit `.env` files
- [ ] Set up database backups
- [ ] Configure log aggregation
- [ ] Review security headers (Helmet is enabled)
- [ ] Rotate secrets regularly
- [ ] Use secret management service
- [ ] Enable database SSL if using managed Postgres

## Monitoring & Health Checks

### Health Endpoints

- `GET /api/v1/health` - Basic health check (always returns 200 if server running)
- `GET /api/v1/ready` - Readiness check (includes database connectivity)
- `GET /api/v1/meta` - API capabilities and version

### Docker Health Checks

Both API and Web have health checks configured in Dockerfiles and docker-compose.

### Recommended Monitoring

- **Uptime monitoring**: UptimeRobot, Pingdom, etc.
- **Logs**: ELK Stack, CloudWatch, Datadog
- **APM**: Sentry, New Relic, etc.
- **Database**: pg_stat_monitor, pgAdmin
- **Metrics**: Prometheus + Grafana (custom setup needed)

## Troubleshooting

### API Won't Start

1. Check environment variables are set correctly
2. Verify PostgreSQL is reachable: `pg_isready -h host -p 5432`
3. Check migrations applied: `npx prisma migrate status`
4. Look at logs: `docker compose logs api` or PM2 logs

### Database Connection Issues

```bash
# Test connection
psql "postgresql://user:pass@host:5432/dbname"
```

### CORS Errors

- Verify `CORS_ORIGINS` includes your frontend domain
- Check protocol (http vs https)
- Ensure no trailing slashes

### Cookie/Auth Issues

- Set `COOKIE_SECURE=true` for HTTPS
- Set `TRUST_PROXY=true` behind proxy
- Check SameSite settings (Strict by default)
- Verify JWT secrets are set

### Build Failures

```bash
# Clean and rebuild
npm run clean
npm ci
npm run build
```

### Port Conflicts

Change ports in `.env` or stop conflicting services:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <pid> /F

# Linux
lsof -i :4000
kill <pid>
```

## Support

For issues and questions:
- Check [README.md](./README.md) for general setup
- Review [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for technical details
- Check logs for error details
- Open an issue on GitHub

---

**Last Updated**: October 2026  
**Version**: 0.1.0
