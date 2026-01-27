# 🏗️ Architecture Diagram - tax.dwings.app

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE DNS                                │
│                  tax.dwings.app (CNAME)                          │
│              → <tunnel-id>.cfargotunnel.com                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CLOUDFLARE TUNNEL (cloudflared)                  │
│                  Running on Ubuntu Server                        │
│                                                                   │
│  Config: /etc/cloudflared/config.yml                             │
│  - hostname: tax.dwings.app                                      │
│    service: http://localhost:8084                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CADDY WEB SERVER                              │
│                  Reverse Proxy + Static Host                     │
│                                                                   │
│  Config: /etc/caddy/Caddyfile                                    │
│                                                                   │
│  ┌─────────────────┐              ┌────────────────────┐        │
│  │  Port 8084      │              │  Port 8083         │        │
│  │  Static Files   │              │  Reverse Proxy     │        │
│  │  (Frontend)     │              │  (Backend API)     │        │
│  └────────┬────────┘              └──────────┬─────────┘        │
└───────────┼───────────────────────────────────┼──────────────────┘
            │                                   │
            ▼                                   ▼
┌───────────────────────┐        ┌──────────────────────────────┐
│   FRONTEND (Static)   │        │    BACKEND (Go Binary)       │
│                       │        │                              │
│  /var/www/tax/        │        │  /var/www/tax/backend/       │
│    frontend/          │        │    schedcalc-backend         │
│                       │        │                              │
│  • index.html         │        │  Service:                    │
│  • _next/*.js         │        │   tax-backend.service        │
│  • _next/*.css        │        │                              │
│  • assets/            │        │  Port: 8083                  │
│                       │        │  Env: .env file              │
│  Generated from:      │        │                              │
│   Next.js static      │        │  API Endpoints:              │
│   export              │        │   /health                    │
│                       │        │   /upload-csv                │
│                       │        │   /transactions              │
│                       │        │   /categorize                │
│                       │        │   /export/pdf                │
└───────────────────────┘        └──────────┬───────────────────┘
                                            │
                                            ▼
                               ┌────────────────────────┐
                               │   SQLite DATABASE      │
                               │                        │
                               │  /var/www/tax/data/    │
                               │    schedccalc.db       │
                               │                        │
                               │  Tables:               │
                               │   • transactions       │
                               │   • csv_files          │
                               │   • vendor_rules       │
                               │   • deduction_data     │
                               └────────────────────────┘
```

## Port Mapping

```
Cloudflare Tunnel → Caddy Port 8084 → Static Files
                                       (Frontend served by Caddy file_server)

Cloudflare Tunnel → Caddy Port 8083 → Backend App (Port 8083)
                                       (Proxied to Go binary)
```

## File Structure on Server

```
/var/www/tax/
├── frontend/              # Static Next.js build output
│   ├── index.html
│   ├── _next/
│   │   ├── static/
│   │   │   ├── chunks/
│   │   │   └── css/
│   │   └── ...
│   └── ...
│
├── backend/               # Go backend application
│   ├── schedcalc-backend  # Binary executable
│   ├── .env               # Environment variables (OPENROUTER_API_KEY)
│   └── uploads/           # Temporary CSV uploads (created automatically)
│
└── data/                  # Persistent data
    └── schedccalc.db      # SQLite database (created automatically)
```

## Service Management

```
systemd
  ├── tax-backend.service    → Go backend (auto-restart)
  ├── caddy.service          → Web server (shared)
  └── cloudflared.service    → Tunnel (shared)
```

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `tax-backend.service` | `/etc/systemd/system/` | Backend service definition |
| `Caddyfile` | `/etc/caddy/Caddyfile` | Web server routing |
| `config.yml` | `/etc/cloudflared/config.yml` | Tunnel routing |
| `.env` | `/var/www/tax/backend/.env` | API keys & secrets |

## Data Flow

### Upload CSV Flow
```
User Browser
   → tax.dwings.app/upload
   → Cloudflare
   → Cloudflare Tunnel
   → Caddy :8084 (Frontend)
   → User uploads file via frontend
   → Frontend makes API call to backend
   → Caddy :8083 (Backend)
   → Go Backend processes CSV
   → SQLite stores transactions
   ← Response back to user
```

### View Transactions Flow
```
User Browser
   → tax.dwings.app/dashboard
   → Cloudflare
   → Cloudflare Tunnel
   → Caddy :8084 (Frontend)
   → Frontend loads static page
   → Frontend fetches from backend API
   → Caddy :8083 (Backend)
   → Go Backend queries SQLite
   ← JSON response
   ← Rendered in browser
```

## Security Model

```
┌─────────────────────────────────────────┐
│ Cloudflare (Edge Security)              │
│ • DDoS Protection                       │
│ • SSL/TLS Termination                   │
│ • Rate Limiting                         │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Cloudflare Tunnel (Secure Connection)   │
│ • No public IP exposed                  │
│ • Encrypted tunnel                      │
│ • No inbound ports open                 │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Server (Ubuntu)                          │
│ • Systemd service isolation             │
│ • File permissions (defibeats user)     │
│ • No external database access           │
└─────────────────────────────────────────┘
```

## Monitoring & Logs

```
Service Logs:
  sudo journalctl -u tax-backend -f     → Backend logs
  sudo journalctl -u caddy -f           → Web server logs
  sudo journalctl -u cloudflared -f     → Tunnel logs

Service Status:
  sudo systemctl status tax-backend     → Backend health
  sudo systemctl status caddy           → Caddy health
  sudo systemctl status cloudflared     → Tunnel health

Port Checks:
  sudo lsof -i :8083                    → Backend port
  sudo lsof -i :8084                    → Frontend port

Database:
  ls -lh /var/www/tax/data/             → DB file size
  sqlite3 /var/www/tax/data/schedccalc.db ".tables"  → Show tables
```

## Comparison with Other Apps on Server

| App | Subdomain | Frontend | Backend | Port(s) |
|-----|-----------|----------|---------|---------|
| Sun Map | sunmap.dwings.app | Static (Vite) | None | 8080 |
| YouUp | youup.dwings.app | None | Node.js | 8081 |
| Weather | weather.dwings.app | Static | None | 8082 |
| **Tax** | **tax.dwings.app** | **Static (Next.js)** | **Go** | **8083, 8084** |

**Note:** Tax app uses two ports because frontend and backend are separate services.

## Backup Strategy

```
Database Backup:
  cp /var/www/tax/data/schedccalc.db \
     /var/www/tax/data/schedccalc.db.backup-$(date +%Y%m%d)

Or download locally:
  scp defibeats@SERVER:/var/www/tax/data/schedccalc.db \
      ./schedccalc-backup-$(date +%Y%m%d).db

Frontend Backup (if modified):
  tar -czf tax-frontend-$(date +%Y%m%d).tar.gz /var/www/tax/frontend/

Backend Binary Backup:
  cp /var/www/tax/backend/schedcalc-backend \
     /var/www/tax/backend/schedcalc-backend.backup
```

## Performance Characteristics

- **Frontend**: Static files served by Caddy (very fast, < 10ms)
- **Backend**: Go binary (compiled, fast startup, low memory ~50MB)
- **Database**: SQLite (embedded, no network overhead)
- **Overall**: Lightweight, efficient, suitable for personal use

## Scaling Considerations

Current setup is perfect for:
- ✅ Single user
- ✅ < 100,000 transactions
- ✅ Personal tax calculations
- ✅ Occasional CSV uploads

If you need to scale:
- Replace SQLite with PostgreSQL
- Add Redis for caching
- Use CDN for static assets
- Add load balancer for multiple backends
