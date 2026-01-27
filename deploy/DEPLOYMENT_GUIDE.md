# Schedule C Calculator - Deployment Guide

## Overview

This guide will help you deploy the Schedule C Tax Calculator to `tax.dwings.app`.

**Architecture:**
- **Frontend**: Static Next.js app served by Caddy on port 8084
- **Backend**: Go API running on port 8083
- **Database**: SQLite at `/var/www/tax/data/schedccalc.db`

---

## Prerequisites

1. SSH access to your Ubuntu server
2. Cloudflare Tunnel already configured
3. Domain: `dwings.app` pointed to Cloudflare

---

## Deployment Steps

### 1. Build the Application (Local Machine)

```bash
# Make the deployment script executable
chmod +x deploy-to-server.sh

# Run the build script
./deploy-to-server.sh
```

This will:
- Build the Next.js frontend as static files
- Compile the Go backend binary
- Show you the next manual steps

---

### 2. Prepare Server Directories

SSH into your server:

```bash
ssh defibeats@your-server-ip
```

Create directory structure:

```bash
sudo mkdir -p /var/www/tax/{frontend,backend,data}
sudo chown -R defibeats:defibeats /var/www/tax
```

---

### 3. Copy Files to Server

From your local machine:

```bash
# Copy frontend (static files)
scp -r my-app/out/* defibeats@your-server:/var/www/tax/frontend/

# Copy backend binary
scp backend/schedcalc-backend defibeats@your-server:/var/www/tax/backend/

# Copy environment variables
scp .env defibeats@your-server:/var/www/tax/backend/.env

# Make backend executable
ssh defibeats@your-server 'chmod +x /var/www/tax/backend/schedcalc-backend'
```

---

### 4. Update Backend to Use Custom DB Path

The backend needs to read the `DB_PATH` environment variable. On the server, edit the `.env` file if needed:

```bash
ssh defibeats@your-server
nano /var/www/tax/backend/.env
```

Ensure it contains your `OPENROUTER_API_KEY` and any other required variables.

---

### 5. Create Systemd Service

On the server:

```bash
sudo nano /etc/systemd/system/tax-backend.service
```

Paste the contents from `deploy/tax-backend.service`:

```ini
[Unit]
Description=Schedule C Tax Calculator Backend (Go)
After=network.target

[Service]
Type=simple
User=defibeats
WorkingDirectory=/var/www/tax/backend
ExecStart=/var/www/tax/backend/schedcalc-backend
Environment=PORT=8083
Environment=DB_PATH=/var/www/tax/data/schedccalc.db
Restart=on-failure
RestartSec=5s

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tax-backend
sudo systemctl start tax-backend
sudo systemctl status tax-backend
```

---

### 6. Update Caddy Configuration

On the server:

```bash
sudo nano /etc/caddy/Caddyfile
```

Add these blocks (from `deploy/Caddyfile.snippet`):

```
# Backend API (Go)
:8083 {
    reverse_proxy localhost:8083
}

# Frontend (Static Next.js)
:8084 {
    root * /var/www/tax/frontend
    file_server
    try_files {path} /index.html
    
    # Enable CORS for API calls
    header Access-Control-Allow-Origin *
    header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "Content-Type, Authorization"
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

---

### 7. Update Cloudflare Tunnel Configuration

On the server:

```bash
sudo nano /etc/cloudflared/config.yml
```

Add this line **BEFORE** the `http_status:404` catch-all:

```yaml
  - hostname: tax.dwings.app
    service: http://localhost:8084
```

Your ingress section should look like:

```yaml
ingress:
  - hostname: sunmap.dwings.app
    service: http://localhost:8080
  - hostname: youup.dwings.app
    service: http://localhost:8081
  - hostname: weather.dwings.app
    service: http://localhost:8082
  - hostname: tax.dwings.app
    service: http://localhost:8084
  # IMPORTANT: catch-all must ALWAYS be last
  - service: http_status:404
```

Restart Cloudflare Tunnel:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

---

### 8. Add DNS Record in Cloudflare

1. Go to https://dash.cloudflare.com
2. Select your `dwings.app` domain
3. Go to **DNS → Records**
4. Click **Add record**
   - **Type**: CNAME
   - **Name**: tax
   - **Target**: `<your-tunnel-id>.cfargotunnel.com` (same as your other records)
   - **Proxy**: ON (orange cloud icon)
5. Click **Save**

---

### 9. Verify Deployment

Wait 1-2 minutes for DNS propagation, then test:

```bash
# Test backend health
curl http://localhost:8083/health

# Test frontend locally
curl http://localhost:8084

# Test via domain
curl https://tax.dwings.app

# Check logs if issues
sudo journalctl -u tax-backend -f
sudo journalctl -u caddy -f
sudo journalctl -u cloudflared -f
```

Visit in browser: **https://tax.dwings.app**

---

## Troubleshooting

### Backend won't start

```bash
# Check service status
sudo systemctl status tax-backend

# View logs
sudo journalctl -u tax-backend -n 50 --no-pager

# Check if port is in use
sudo lsof -i :8083

# Test binary directly
cd /var/www/tax/backend
./schedcalc-backend
```

### Frontend shows 404

```bash
# Check if files exist
ls -la /var/www/tax/frontend

# Check Caddy config syntax
sudo caddy validate --config /etc/caddy/Caddyfile

# Restart Caddy
sudo systemctl restart caddy
```

### Can't access via domain

```bash
# Check Cloudflare Tunnel status
sudo systemctl status cloudflared

# Verify DNS record exists
dig tax.dwings.app

# Check tunnel logs
sudo journalctl -u cloudflared -n 50 --no-pager
```

### Database permission issues

```bash
# Ensure proper ownership
sudo chown -R defibeats:defibeats /var/www/tax/data

# Check if database was created
ls -la /var/www/tax/data/
```

---

## Updates & Maintenance

### Updating the Application

From your local machine:

```bash
# Rebuild
./deploy-to-server.sh

# Copy new files
scp -r my-app/out/* defibeats@your-server:/var/www/tax/frontend/
scp backend/schedcalc-backend defibeats@your-server:/var/www/tax/backend/

# Restart backend
ssh defibeats@your-server 'sudo systemctl restart tax-backend'
```

### Backing Up Database

On the server:

```bash
# Create backup
cp /var/www/tax/data/schedccalc.db /var/www/tax/data/schedccalc.db.backup-$(date +%Y%m%d)

# Or download to local machine
scp defibeats@your-server:/var/www/tax/data/schedccalc.db ./schedccalc.db.backup
```

### Clearing All Data

```bash
# Stop backend
sudo systemctl stop tax-backend

# Remove database (or back it up first)
rm /var/www/tax/data/schedccalc.db

# Start backend (it will create fresh DB)
sudo systemctl start tax-backend
```

---

## Architecture Diagram

```
Internet
   ↓
Cloudflare DNS (tax.dwings.app)
   ↓
Cloudflare Tunnel (cloudflared)
   ↓
Caddy Reverse Proxy
   ├── Port 8084 → Static Frontend (/var/www/tax/frontend)
   └── Port 8083 → Go Backend API
                      ↓
                   SQLite DB (/var/www/tax/data/schedccalc.db)
```

---

## Environment Variables

The backend `.env` file should contain:

```bash
OPENROUTER_API_KEY=your_key_here
```

**Note**: The `PORT` and `DB_PATH` are set in the systemd service file, not in `.env`.

---

## Support

- Check service logs: `sudo journalctl -u tax-backend -f`
- Check Caddy logs: `sudo journalctl -u caddy -f`
- Check tunnel logs: `sudo journalctl -u cloudflared -f`
- List all running services: `sudo systemctl list-units --type=service --state=running`
