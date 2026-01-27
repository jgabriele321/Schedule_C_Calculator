# Quick Deployment Checklist

Deploy Schedule C Calculator to `tax.dwings.app` in 9 steps:

## 🖥️ Local Machine

- [ ] 1. Run `./deploy-to-server.sh` (builds frontend + backend)

## 🌐 On Server (SSH)

- [ ] 2. Create directories:
  ```bash
  sudo mkdir -p /var/www/tax/{frontend,backend,data}
  sudo chown -R defibeats:defibeats /var/www/tax
  ```

## 🖥️ Local Machine

- [ ] 3. Copy files to server:
  ```bash
  scp -r my-app/out/* defibeats@YOUR_SERVER:/var/www/tax/frontend/
  scp backend/schedcalc-backend defibeats@YOUR_SERVER:/var/www/tax/backend/
  scp .env defibeats@YOUR_SERVER:/var/www/tax/backend/.env
  ssh defibeats@YOUR_SERVER 'chmod +x /var/www/tax/backend/schedcalc-backend'
  ```

## 🌐 On Server

- [ ] 4. Create systemd service:
  ```bash
  sudo nano /etc/systemd/system/tax-backend.service
  # Paste content from deploy/tax-backend.service
  sudo systemctl daemon-reload
  sudo systemctl enable tax-backend
  sudo systemctl start tax-backend
  ```

- [ ] 5. Update Caddy:
  ```bash
  sudo nano /etc/caddy/Caddyfile
  # Add content from deploy/Caddyfile.snippet
  sudo systemctl reload caddy
  ```

- [ ] 6. Update Cloudflare Tunnel:
  ```bash
  sudo nano /etc/cloudflared/config.yml
  # Add line from deploy/cloudflared.snippet (BEFORE 404 catch-all)
  sudo systemctl restart cloudflared
  ```

## ☁️ Cloudflare Dashboard

- [ ] 7. Add DNS record:
  - Type: `CNAME`
  - Name: `tax`
  - Target: `<your-tunnel-id>.cfargotunnel.com`
  - Proxy: `ON` (orange cloud)

## ✅ Verify

- [ ] 8. Test backend: `curl http://localhost:8083/health` (on server)
- [ ] 9. Test live: `curl https://tax.dwings.app` (anywhere)

## 🎉 Done!

Visit: **https://tax.dwings.app**
