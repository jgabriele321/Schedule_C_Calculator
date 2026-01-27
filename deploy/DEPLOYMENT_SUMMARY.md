# 📦 Deployment Summary - tax.dwings.app

## What Was Set Up

I've prepared everything needed to deploy your Schedule C Tax Calculator to `tax.dwings.app`. Here's what was done:

### ✅ Code Changes Made

1. **Backend (`backend/main.go`)**
   - ✅ Added support for `DB_PATH` environment variable (for database location flexibility)
   - ✅ Added multi-path `.env` file loading (works locally and on server)
   - ✅ Added logging to show which `.env` file was loaded and database path

2. **Frontend (my-app/)**
   - ✅ Already configured for static export (no changes needed)
   - ✅ Uses client-side API (no backend dependency for basic features)
   - ✅ Perfect for Caddy static file serving

### 📁 Files Created

```
/deploy-to-server.sh                    # Main build script
/deploy/
  ├── tax-backend.service               # Systemd service config
  ├── Caddyfile.snippet                 # Caddy reverse proxy config
  ├── cloudflared.snippet               # Cloudflare tunnel entry
  ├── DEPLOYMENT_GUIDE.md               # Complete detailed guide
  ├── QUICK_START.md                    # Checklist format
  ├── SERVER_SETUP_README.md            # Quick reference with commands
  └── DEPLOYMENT_SUMMARY.md (this file)
/DEPLOY.md                              # TL;DR copy-paste guide
```

### 🏗️ Architecture Design

```
Internet
   ↓
Cloudflare DNS (tax.dwings.app)
   ↓
Cloudflare Tunnel (cloudflared) - Port N/A
   ↓
Caddy Reverse Proxy
   ├── Port 8084 → Static Frontend Files (/var/www/tax/frontend/)
   │                 │
   │                 └── Next.js Static Export (HTML/JS/CSS)
   │
   └── Port 8083 → Go Backend API (/var/www/tax/backend/)
                      │
                      └── SQLite Database (/var/www/tax/data/schedccalc.db)
```

**Why this architecture?**
- ✅ **Static Frontend**: Faster, simpler, no Node.js process needed
- ✅ **Separate Data Directory**: Easier backups, cleaner updates
- ✅ **Systemd Service**: Auto-starts on boot, auto-restarts on crash
- ✅ **Follows Your Pattern**: Same setup as sunmap, youup, weather apps

### 🚀 Deployment Steps Overview

1. **Build locally** → `./deploy-to-server.sh`
2. **Copy to server** → Frontend files + Backend binary + .env
3. **Create systemd service** → Auto-manages Go backend
4. **Update Caddy** → Routes :8084 to frontend, :8083 to backend
5. **Update Cloudflare Tunnel** → Routes tax.dwings.app to :8084
6. **Add DNS record** → CNAME tax → tunnel
7. **Test** → `curl https://tax.dwings.app`

### 📊 Port Assignments

| Port | Service | Type | Path |
|------|---------|------|------|
| 8083 | Backend API | Go Binary | /var/www/tax/backend/ |
| 8084 | Frontend | Static Files | /var/www/tax/frontend/ |

**Existing ports:**
- 8080: sunmap.dwings.app
- 8081: youup.dwings.app
- 8082: weather.dwings.app
- 8083: **tax.dwings.app (backend)** ← NEW
- 8084: **tax.dwings.app (frontend)** ← NEW

### 🔐 Environment Variables

The backend needs `OPENROUTER_API_KEY` in `.env` file. Other variables are set in systemd service:
- `PORT=8083` (backend API port)
- `DB_PATH=/var/www/tax/data/schedccalc.db` (database location)

### 📝 Next Steps for You

**Choose your deployment guide:**

1. **Quick & Dirty**: Open `DEPLOY.md` → Copy-paste commands
2. **Detailed Guide**: Open `deploy/SERVER_SETUP_README.md`
3. **Checklist**: Open `deploy/QUICK_START.md`

**All guides do the same thing, just different formats!**

### 🧪 Testing After Deployment

```bash
# 1. On server - test locally
curl http://localhost:8083/health  # Should return: {"status":"healthy"...}
curl http://localhost:8084         # Should return: HTML content

# 2. Anywhere - test via domain
curl https://tax.dwings.app        # Should return: HTML content

# 3. Browser test
# Visit: https://tax.dwings.app
# Should see: Schedule C Tax Assistant interface
```

### 🔍 Troubleshooting Quick Reference

**Backend won't start:**
```bash
sudo journalctl -u tax-backend -n 50 --no-pager
```

**Frontend shows 404:**
```bash
ls -la /var/www/tax/frontend/  # Check if files exist
sudo systemctl status caddy     # Check Caddy status
```

**Domain not accessible:**
```bash
sudo systemctl status cloudflared
dig tax.dwings.app
```

**Check all services at once:**
```bash
sudo systemctl status tax-backend caddy cloudflared
```

### 📦 What Gets Deployed

**Frontend (Static):**
- `my-app/out/` → All HTML, JS, CSS, images
- Size: ~5-10 MB
- No runtime needed (just Caddy serving files)

**Backend (Go Binary):**
- `backend/schedcalc-backend` → Single executable
- Size: ~15-20 MB
- Includes all dependencies (SQLite driver, etc.)

**Database:**
- SQLite file at `/var/www/tax/data/schedccalc.db`
- Created automatically on first run
- Size grows with data (starts at ~100 KB)

### 🔄 Future Updates

To update the app later:

```bash
# Local machine
./deploy-to-server.sh
scp -r my-app/out/* defibeats@YOUR_SERVER:/var/www/tax/frontend/
scp backend/schedcalc-backend defibeats@YOUR_SERVER:/var/www/tax/backend/

# Server
ssh defibeats@YOUR_SERVER 'sudo systemctl restart tax-backend'
```

### 💡 Tips

- **Database Backups**: Copy `/var/www/tax/data/schedccalc.db` regularly
- **View Logs in Real-time**: `sudo journalctl -u tax-backend -f`
- **Check Port Usage**: `sudo lsof -i :8083` and `sudo lsof -i :8084`
- **Test Backend Directly**: `curl http://localhost:8083/health`

### 🎯 Success Criteria

You'll know deployment worked when:
- ✅ `https://tax.dwings.app` loads in browser
- ✅ You can upload a CSV file
- ✅ Transactions appear in the dashboard
- ✅ Backend logs show: `✅ Loaded environment from: /var/www/tax/backend/.env`
- ✅ Backend logs show: `📊 Using database: /var/www/tax/data/schedccalc.db`

### 📞 Help

If stuck:
1. Check logs: `sudo journalctl -u tax-backend -f`
2. Verify files exist: `ls -la /var/www/tax/`
3. Check services running: `sudo systemctl status tax-backend caddy cloudflared`
4. Read troubleshooting: `deploy/DEPLOYMENT_GUIDE.md` (bottom section)

---

## Ready to Deploy?

**Start here:** Open `DEPLOY.md` for copy-paste commands!

Good luck! 🚀
