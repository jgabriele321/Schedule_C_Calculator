# 🚀 Deploy to tax.dwings.app

## TL;DR - Copy & Paste This

**Replace `YOUR_SERVER_IP` with your actual server IP address in all commands below.**

### 1. Build locally:
```bash
cd /Users/giovannigabriele/Documents/Code/SchedCCalc && ./deploy-to-server.sh
```

### 2. Setup server directories:
```bash
ssh defibeats@YOUR_SERVER_IP 'sudo mkdir -p /var/www/tax/{frontend,backend,data} && sudo chown -R defibeats:defibeats /var/www/tax'
```

### 3. Copy files to server:
```bash
scp -r my-app/out/* defibeats@YOUR_SERVER_IP:/var/www/tax/frontend/ && \
scp backend/schedcalc-backend defibeats@YOUR_SERVER_IP:/var/www/tax/backend/ && \
scp .env defibeats@YOUR_SERVER_IP:/var/www/tax/backend/.env && \
ssh defibeats@YOUR_SERVER_IP 'chmod +x /var/www/tax/backend/schedcalc-backend'
```

### 4. Create backend service (on server):
```bash
sudo tee /etc/systemd/system/tax-backend.service > /dev/null <<'EOF'
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
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload && \
sudo systemctl enable tax-backend && \
sudo systemctl start tax-backend && \
sudo systemctl status tax-backend
```

### 5. Add Caddy config (on server):
```bash
sudo tee -a /etc/caddy/Caddyfile > /dev/null <<'EOF'

# Backend API (Go)
:8083 {
    reverse_proxy localhost:8083
}

# Frontend (Static Next.js)
:8084 {
    root * /var/www/tax/frontend
    file_server
    try_files {path} /index.html
    
    header Access-Control-Allow-Origin *
    header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "Content-Type, Authorization"
}
EOF

sudo systemctl reload caddy
```

### 6. Update Cloudflare Tunnel (on server):
```bash
# First, backup your config
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup

# Then edit it
sudo nano /etc/cloudflared/config.yml
```

**Add this line BEFORE the `http_status:404` line:**
```yaml
  - hostname: tax.dwings.app
    service: http://localhost:8084
```

**Then restart:**
```bash
sudo systemctl restart cloudflared
```

### 7. Add DNS in Cloudflare Dashboard:
Go to: https://dash.cloudflare.com → dwings.app → DNS → Add record
- Type: `CNAME`
- Name: `tax`
- Target: Get this from your existing records (ends with `.cfargotunnel.com`)
- Proxy: ON (orange cloud)

### 8. Test:
```bash
curl https://tax.dwings.app
```

Visit: **https://tax.dwings.app** 🎉

---

## Quick Commands

```bash
# Check status
sudo systemctl status tax-backend

# View logs
sudo journalctl -u tax-backend -f

# Restart
sudo systemctl restart tax-backend
```

---

## Full Documentation

See `deploy/SERVER_SETUP_README.md` for complete guide with troubleshooting.
