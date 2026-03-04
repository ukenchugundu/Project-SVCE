# EduHub Deployment Guide

## Deployment Options

### 1. Docker Deployment (Recommended)

#### Local Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Production Deployment
```bash
# Create environment file
cp .env.example .env.prod
# Edit .env.prod with production values

# Deploy with production config
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Render Deployment

Your `render.yaml` is already configured. To deploy:

1. Push code to GitHub
2. Connect repository to Render
3. Render will automatically deploy using the configuration

Services created:
- Database: PostgreSQL (Free tier)
- Backend: Node.js API
- Frontend: Static site

### 3. Vercel Deployment (Frontend Only)

For frontend-only deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 4. Manual Deployment

#### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- PM2 (for process management)

#### Steps

1. **Setup Database**
```bash
# Create database
createdb eduhub

# Run migrations
psql -d eduhub -f database/migrations/001_initial_schema.sql
psql -d eduhub -f database/migrations/002_initial_data.sql
psql -d eduhub -f database/migrations/003_create_quizzes_table.sql
psql -d eduhub -f database/migrations/004_create_questions_table.sql
psql -d eduhub -f database/migrations/005_alter_quizzes_table.sql
```

2. **Deploy Backend**
```bash
cd backend
npm install
npm run build
pm2 start dist/index.js --name eduhub-backend
```

3. **Deploy Frontend**
```bash
cd frontend
npm install
npm run build
# Serve dist/ folder with nginx or any static server
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/eduhub
DB_SSL=false
PORT=3000
NODE_ENV=production
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:3000
```

## Health Checks

- Backend: `GET /api` - Should return API status
- Frontend: Access root URL - Should load application
- Database: Check connection via backend logs

## Monitoring

### Docker Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### PM2 Monitoring
```bash
pm2 status
pm2 logs eduhub-backend
pm2 monit
```

## Scaling

### Docker Scaling
```bash
# Scale backend instances
docker-compose up -d --scale backend=3
```

### Load Balancer Configuration
Add nginx reverse proxy for multiple backend instances.

## Backup

### Database Backup
```bash
# Docker
docker exec eduhub-db pg_dump -U postgres eduhub > backup.sql

# Manual
pg_dump -U postgres eduhub > backup.sql
```

### File Uploads Backup
```bash
# Backup uploads directory
tar -czf uploads-backup.tar.gz backend/uploads/
```

## SSL/HTTPS Setup

For production, configure SSL certificates:

1. **Using Let's Encrypt with Docker**
```bash
# Add certbot to docker-compose
# Update nginx config for SSL
```

2. **Using Cloudflare**
- Point domain to server IP
- Enable SSL in Cloudflare dashboard

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database is running
   - Check network connectivity

2. **Frontend API Calls Failing**
   - Verify VITE_API_URL is correct
   - Check CORS configuration
   - Ensure backend is accessible

3. **File Upload Issues**
   - Check uploads directory permissions
   - Verify disk space
   - Check file size limits

### Debug Commands
```bash
# Check container status
docker-compose ps

# Check container logs
docker-compose logs [service-name]

# Access container shell
docker-compose exec backend sh
docker-compose exec database psql -U postgres eduhub
```