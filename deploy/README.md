# 📚 Deployment Documentation Index

Welcome! Everything you need to deploy Schedule C Calculator to `tax.dwings.app`.

---

## 🚀 Quick Start (Pick One)

1. **TL;DR - Just want to deploy?**  
   → Open [`../DEPLOY.md`](../DEPLOY.md) ← **START HERE**
   
2. **Want a checklist?**  
   → Open [`QUICK_START.md`](QUICK_START.md)

3. **Want detailed explanation?**  
   → Open [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)

4. **Want copy-paste commands?**  
   → Open [`SERVER_SETUP_README.md`](SERVER_SETUP_README.md)

---

## 📖 All Documentation Files

### For Deployment

| File | Purpose | When to Use |
|------|---------|-------------|
| **[`../DEPLOY.md`](../DEPLOY.md)** | **Copy-paste deployment** | **First time deploying** ⭐ |
| [`QUICK_START.md`](QUICK_START.md) | Checkbox checklist | Like checklists |
| [`SERVER_SETUP_README.md`](SERVER_SETUP_README.md) | Quick reference card | Keep open while deploying |
| [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) | Complete detailed guide | Troubleshooting issues |

### For Understanding

| File | Purpose | When to Read |
|------|---------|-------------|
| [`DEPLOYMENT_SUMMARY.md`](DEPLOYMENT_SUMMARY.md) | What was prepared | Understanding what's included |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System diagrams | Understanding how it works |

### Configuration Files

| File | Purpose | How to Use |
|------|---------|-----------|
| [`tax-backend.service`](tax-backend.service) | Systemd service | Copy to `/etc/systemd/system/` |
| [`Caddyfile.snippet`](Caddyfile.snippet) | Caddy config | Append to `/etc/caddy/Caddyfile` |
| [`cloudflared.snippet`](cloudflared.snippet) | Tunnel config | Insert into `/etc/cloudflared/config.yml` |

---

## 🎯 Deployment in 3 Steps

### Step 1: Build
```bash
./deploy-to-server.sh
```

### Step 2: Deploy
Follow **one** of these guides:
- [`../DEPLOY.md`](../DEPLOY.md) ← Recommended
- [`QUICK_START.md`](QUICK_START.md)
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)

### Step 3: Verify
```bash
curl https://tax.dwings.app
```

---

## 🏗️ What Gets Deployed

```
tax.dwings.app
├── Frontend (Static) → Port 8084
├── Backend (Go API) → Port 8083
└── Database (SQLite) → /var/www/tax/data/
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for full diagrams.

---

## 📞 Need Help?

1. **Deployment failing?**  
   → Check [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) → Troubleshooting section

2. **Want to understand the system?**  
   → Read [`ARCHITECTURE.md`](ARCHITECTURE.md)

3. **Want a summary of what was built?**  
   → Read [`DEPLOYMENT_SUMMARY.md`](DEPLOYMENT_SUMMARY.md)

4. **Forgot server commands?**  
   → Check [`SERVER_SETUP_README.md`](SERVER_SETUP_README.md) → Common Commands

---

## 🔄 Updating Later

```bash
# Rebuild
./deploy-to-server.sh

# Copy new files
scp -r my-app/out/* defibeats@YOUR_SERVER:/var/www/tax/frontend/
scp backend/schedcalc-backend defibeats@YOUR_SERVER:/var/www/tax/backend/

# Restart backend
ssh defibeats@YOUR_SERVER 'sudo systemctl restart tax-backend'
```

---

## ✅ Success Checklist

- [ ] Built locally (`./deploy-to-server.sh`)
- [ ] Created server directories
- [ ] Copied files to server
- [ ] Created systemd service
- [ ] Updated Caddy config
- [ ] Updated Cloudflare Tunnel config
- [ ] Added DNS record in Cloudflare
- [ ] Tested: `curl https://tax.dwings.app`
- [ ] Visited in browser: https://tax.dwings.app

---

## 🎉 After Successful Deployment

Your app will be live at: **https://tax.dwings.app**

Features available:
- ✅ Upload CSV bank statements
- ✅ Categorize transactions
- ✅ Mark business vs personal expenses
- ✅ Calculate Schedule C deductions
- ✅ Export PDF/CSV reports
- ✅ Track mileage & home office deductions

---

**Ready to deploy? Start with [`../DEPLOY.md`](../DEPLOY.md)!** 🚀
