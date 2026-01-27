# 🚀 Deploy tax.dwings.app - Personalized Guide

**Server IP**: `100.111.61.25`  
**User**: `defibeats`  
**Tunnel ID**: `9a97175c-8e42-4834-859b-ed4697871cd0`  
**Domain**: `tax.dwings.app`

---

## Step 1: Build Locally (On Your Mac)

Open Terminal and run:

```bash
cd /Users/giovannigabriele/Documents/Code/SchedCCalc
./deploy-to-server.sh
```

**Expected output:**
- ✅ Frontend built successfully (output: my-app/out/)
- ✅ Backend built successfully (binary: backend/schedcalc-backend)

---

## Step 2: Prepare Server Directories

```bash
ssh defibeats@100.111.61.25 'sudo mkdir -p /var/www/tax/{frontend,backend,data} && sudo chown -R defibeats:defibeats /var/www/tax'
```

---

## Step 3: Copy Files to Server

```bash
# Copy frontend files
scp -r my-app/out/* defibeats@100.111.61.25:/var/www/tax/frontend/

# Copy backend binary
scp backend/schedcalc-backend defibeats@100.111.61.25:/var/www/tax/backend/

# Copy environment file
scp .env defibeats@100.111.61.25:/var/www/tax/backend/.env

# Make backend executable
ssh defibeats@100.111.61.25 'chmod +x /var/www/tax/backend/schedcalc-backend'
```

**Wait for all files to finish copying before proceeding.**

---

## Step 4: Create Backend Service (On Server)

SSH into your server:

```bash
ssh defibeats@100.111.61.25
```

Once connected, create the systemd service:

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
```

Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tax-backend
sudo systemctl start tax-backend
```

Check if it's running:

```bash
sudo systemctl status tax-backend
```

**Expected output:** Should say "active (running)" in green.

---

## Step 5: Update Caddy Config (Still on Server)

Add the new configuration:

```bash
sudo tee -a /etc/caddy/Caddyfile > /dev/null <<'EOF'

# Backend API (Go) - tax.dwings.app
:8083 {
    reverse_proxy localhost:8083
}

# Frontend (Static Next.js) - tax.dwings.app
:8084 {
    root * /var/www/tax/frontend
    file_server
    try_files {path} /index.html
    
    header Access-Control-Allow-Origin *
    header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    header Access-Control-Allow-Headers "Content-Type, Authorization"
}
EOF
```

Reload Caddy:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

**Expected output:** Should say "active (running)" in green.

---

## Step 6: Update Cloudflare Tunnel (Still on Server)

First, backup your config:

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup
```

Now edit the config:

```bash
sudo nano /etc/cloudflared/config.yml
```

**Find the ingress section** and add this line **BEFORE** the `http_status:404` line:

```yaml
  - hostname: tax.dwings.app
    service: http://localhost:8084
```

Your ingress section should now look like:

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

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

Restart Cloudflare Tunnel:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

**Expected output:** Should say "active (running)" in green.

---

## Step 7: Test Locally on Server (Still on Server)

```bash
# Test backend
curl http://localhost:8083/health

# Test frontend
curl http://localhost:8084
```

**Expected output:**
- Backend: JSON response with `"status":"healthy"`
- Frontend: HTML content

If both work, you can exit SSH:

```bash
exit
```

---

## Step 8: Add DNS Record in Cloudflare

1. Go to: https://dash.cloudflare.com
2. Click on **dwings.app** domain
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Fill in:
   - **Type**: `CNAME`
   - **Name**: `tax`
   - **Target**: `9a97175c-8e42-4834-859b-ed4697871cd0.cfargotunnel.com`
   - **Proxy status**: `Proxied` (orange cloud icon should be ON)
   - **TTL**: `Auto`
6. Click **Save**

---

## Step 9: Test Live Deployment

Wait 1-2 minutes for DNS to propagate, then test:

```bash
# From your Mac
curl https://tax.dwings.app
```

**Expected output:** HTML content starting with `<!DOCTYPE html>`

Then open in your browser:

🎉 **https://tax.dwings.app**

---

## ✅ Verification Checklist

Once the site loads, verify these features work:

- [ ] Homepage loads
- [ ] Upload a CSV file
- [ ] View transactions
- [ ] Mark transactions as business/personal
- [ ] See overview calculations

---

## 🔧 Troubleshooting

### Backend not starting

```bash
ssh defibeats@100.111.61.25
sudo journalctl -u tax-backend -n 50 --no-pager
```

### Frontend shows 404

```bash
ssh defibeats@100.111.61.25
ls -la /var/www/tax/frontend/  # Should show index.html and _next/ folder
```

### Domain not accessible

```bash
ssh defibeats@100.111.61.25
sudo systemctl status cloudflared
```

### Check all services

```bash
ssh defibeats@100.111.61.25
sudo systemctl status tax-backend caddy cloudflared
```

---

## 🔄 Future Updates

To update the app later:

```bash
# On your Mac
cd /Users/giovannigabriele/Documents/Code/SchedCCalc
./deploy-to-server.sh

# Copy new files
scp -r my-app/out/* defibeats@100.111.61.25:/var/www/tax/frontend/
scp backend/schedcalc-backend defibeats@100.111.61.25:/var/www/tax/backend/

# Restart backend
ssh defibeats@100.111.61.25 'sudo systemctl restart tax-backend'
```

---

## 📞 Quick Commands Reference

```bash
# SSH into server
ssh defibeats@100.111.61.25

# Check backend logs
sudo journalctl -u tax-backend -f

# Check backend status
sudo systemctl status tax-backend

# Restart backend
sudo systemctl restart tax-backend

# Restart all services
sudo systemctl restart tax-backend caddy cloudflared

# Backup database
cp /var/www/tax/data/schedccalc.db /var/www/tax/data/schedccalc.db.backup-$(date +%Y%m%d)
```

---

## 🎯 Success!

Your app is live at: **https://tax.dwings.app**

If you encounter any issues, check the troubleshooting section above or review the logs.
