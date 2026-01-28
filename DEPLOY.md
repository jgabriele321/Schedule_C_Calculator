# 🚀 Deploy to tax.dwings.app

## TL;DR - Git-Based Deployment (Recommended)

**Server IP:** `100.111.61.25`

### Initial Setup (One-Time)

#### 1. Setup server directories:
```bash
ssh defibeats@100.111.61.25 'sudo mkdir -p /var/www/tax/{frontend,backend,data} && sudo chown -R defibeats:defibeats /var/www/tax'
```

#### 2. Clone the repository:
```bash
ssh defibeats@100.111.61.25
cd /var/www/tax/backend
git clone https://github.com/jgabriele321/Schedule_C_Calculator.git .
cd backend
go build -o schedcalc-backend main.go
exit
```

#### 3. Build and deploy frontend:
```bash
cd /Users/giovannigabriele/Documents/Code/SchedCCalc/my-app
npm install
npm run build
scp -r out/* defibeats@100.111.61.25:/var/www/tax/frontend/
```

#### 4. Copy environment file:
```bash
scp /Users/giovannigabriele/Documents/Code/SchedCCalc/.env defibeats@100.111.61.25:/var/www/tax/backend/backend/.env
```

---

### Future Updates (After Initial Setup)

#### Update Backend:
```bash
ssh defibeats@100.111.61.25
cd /var/www/tax/backend/backend
git pull origin main
go build -o schedcalc-backend main.go
sudo systemctl restart tax-backend
exit
```

#### Update Frontend:
```bash
cd /Users/giovannigabriele/Documents/Code/SchedCCalc/my-app
npm run build
scp -r out/* defibeats@100.111.61.25:/var/www/tax/frontend/
```

---

### Service Configuration (One-Time Setup on Server)

#### 5. Create backend service:
```bash
ssh defibeats@100.111.61.25

sudo tee /etc/systemd/system/tax-backend.service > /dev/null <<'EOF'
[Unit]
Description=Schedule C Tax Calculator Backend (Go)
After=network.target

[Service]
Type=simple
User=defibeats
WorkingDirectory=/var/www/tax/backend/backend
ExecStart=/var/www/tax/backend/backend/schedcalc-backend
Environment=PORT=8083
Environment=DB_PATH=/var/www/tax/data/schedccalc.db
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tax-backend
sudo systemctl start tax-backend
sudo systemctl status tax-backend
```

#### 6. Add Caddy config:
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

#### 7. Update Cloudflare Tunnel:
```bash
# Backup config
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup

# Edit config
sudo nano /etc/cloudflared/config.yml
```

**Add BEFORE the `http_status:404` line:**
```yaml
  - hostname: tax.dwings.app
    service: http://localhost:8084
```

**Restart tunnel:**
```bash
sudo systemctl restart cloudflared
exit
```

#### 8. Add DNS in Cloudflare Dashboard:
Go to: https://dash.cloudflare.com → dwings.app → DNS
- Type: `CNAME`
- Name: `tax`
- Target: `9a97175c-8e42-4834-859b-ed4697871cd0.cfargotunnel.com`
- Proxy: ON (orange cloud)

#### 9. Test:
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
