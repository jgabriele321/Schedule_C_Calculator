# 🚀 Tax App Server Deployment

Quick reference guide for deploying Schedule C Calculator to `tax.dwings.app`.

---

## 📋 Quick Start Checklist

### On Your Local Machine

1. **Build the app:**
   ```bash
   cd /Users/giovannigabriele/Documents/Code/SchedCCalc
   ./deploy-to-server.sh
   ```

2. **Copy to server** (replace `YOUR_SERVER_IP` with actual IP):
   ```bash
   # Create directories on server first
   ssh defibeats@YOUR_SERVER_IP 'sudo mkdir -p /var/www/tax/{frontend,backend,data} && sudo chown -R defibeats:defibeats /var/www/tax'
   
   # Copy files
   scp -r my-app/out/* defibeats@YOUR_SERVER_IP:/var/www/tax/frontend/
   scp backend/schedcalc-backend defibeats@YOUR_SERVER_IP:/var/www/tax/backend/
   scp .env defibeats@YOUR_SERVER_IP:/var/www/tax/backend/.env
   ssh defibeats@YOUR_SERVER_IP 'chmod +x /var/www/tax/backend/schedcalc-backend'
   ```

### On Your Server (SSH)

3. **Create systemd service:**
   ```bash
   sudo tee /etc/systemd/system/tax-backend.service > /dev/null <<EOF
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
   
   sudo systemctl daemon-reload
   sudo systemctl enable tax-backend
   sudo systemctl start tax-backend
   ```

4. **Update Caddy config:**
   ```bash
   sudo tee -a /etc/caddy/Caddyfile > /dev/null <<EOF
   
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

5. **Update Cloudflare Tunnel** (edit `/etc/cloudflared/config.yml`):
   ```bash
   sudo nano /etc/cloudflared/config.yml
   ```
   
   Add this line **BEFORE** the `http_status:404` line:
   ```yaml
     - hostname: tax.dwings.app
       service: http://localhost:8084
   ```
   
   Then restart:
   ```bash
   sudo systemctl restart cloudflared
   ```

### On Cloudflare Dashboard

6. **Add DNS record:**
   - Go to: https://dash.cloudflare.com → dwings.app → DNS
   - Click **Add record**
   - Type: `CNAME`
   - Name: `tax`
   - Target: `<your-tunnel-id>.cfargotunnel.com` (copy from existing records)
   - Proxy: `ON` ✅

---

## ✅ Verify

```bash
# On server
curl http://localhost:8083/health
curl http://localhost:8084

# From anywhere
curl https://tax.dwings.app
```

Visit: **https://tax.dwings.app**

---

## 🔧 Common Commands

```bash
# Check service status
sudo systemctl status tax-backend
sudo systemctl status caddy
sudo systemctl status cloudflared

# View logs
sudo journalctl -u tax-backend -f
sudo journalctl -u caddy -f
sudo journalctl -u cloudflared -f

# Restart services
sudo systemctl restart tax-backend
sudo systemctl reload caddy
sudo systemctl restart cloudflared

# Check what's running on ports
sudo lsof -i :8083
sudo lsof -i :8084
```

---

## 🔄 Update Deployment

```bash
# Local: rebuild
./deploy-to-server.sh

# Local: copy new files
scp -r my-app/out/* defibeats@YOUR_SERVER_IP:/var/www/tax/frontend/
scp backend/schedcalc-backend defibeats@YOUR_SERVER_IP:/var/www/tax/backend/

# Server: restart backend
ssh defibeats@YOUR_SERVER_IP 'sudo systemctl restart tax-backend'
```

---

## 💾 Backup Database

```bash
# On server
cp /var/www/tax/data/schedccalc.db /var/www/tax/data/schedccalc.db.backup-$(date +%Y%m%d)

# Or download locally
scp defibeats@YOUR_SERVER_IP:/var/www/tax/data/schedccalc.db ./backup.db
```

---

## 🏗️ Architecture

```
Internet → Cloudflare → Cloudflare Tunnel → Caddy
                                               ├── :8084 → Static Frontend
                                               └── :8083 → Go Backend → SQLite
```

**Ports:**
- 8083: Backend API (Go)
- 8084: Frontend (Static files)

**Paths:**
- Frontend: `/var/www/tax/frontend/`
- Backend: `/var/www/tax/backend/`
- Database: `/var/www/tax/data/schedccalc.db`
- Logs: `journalctl -u tax-backend`
