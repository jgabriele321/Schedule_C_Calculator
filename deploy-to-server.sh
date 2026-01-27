#!/bin/bash

# Schedule C Calculator - Server Deployment Script
# Target: tax.dwings.app

set -e  # Exit on any error

echo "🚀 Starting deployment for tax.dwings.app..."

# Configuration
APP_NAME="tax"
SERVER_USER="defibeats"
DEPLOY_DIR="/var/www/${APP_NAME}"
BACKEND_PORT="8083"
FRONTEND_PORT="8084"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Step 1: Building Frontend (Static)${NC}"
cd my-app
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm run build
if [ ! -d "out" ]; then
  echo -e "${YELLOW}⚠️  Frontend build failed - out/ directory not created${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Frontend built successfully (output: my-app/out/)${NC}"

echo -e "${BLUE}📦 Step 2: Building Go Backend${NC}"
cd ../backend
go build -o schedcalc-backend main.go
if [ ! -f "schedcalc-backend" ]; then
  echo -e "${YELLOW}⚠️  Backend build failed - binary not created${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Backend built successfully (binary: backend/schedcalc-backend)${NC}"
cd ..

echo -e "${YELLOW}⚠️  Manual steps required on server:${NC}"
echo ""
echo "1. SSH into your server and create directories:"
echo "   ${GREEN}sudo mkdir -p ${DEPLOY_DIR}/{frontend,backend,data}${NC}"
echo "   ${GREEN}sudo chown -R ${SERVER_USER}:${SERVER_USER} ${DEPLOY_DIR}${NC}"
echo ""
echo "2. Copy files to server:"
echo "   Frontend: ${GREEN}scp -r my-app/out/* ${SERVER_USER}@your-server:${DEPLOY_DIR}/frontend/${NC}"
echo "   Backend:  ${GREEN}scp backend/schedcalc-backend ${SERVER_USER}@your-server:${DEPLOY_DIR}/backend/${NC}"
echo "   Env file: ${GREEN}scp .env ${SERVER_USER}@your-server:${DEPLOY_DIR}/backend/.env${NC}"
echo ""
echo "3. Create systemd service file:"
echo "   ${GREEN}sudo nano /etc/systemd/system/${APP_NAME}-backend.service${NC}"
echo "   (Use the content from deploy/tax-backend.service)"
echo ""
echo "4. Update Caddy config:"
echo "   ${GREEN}sudo nano /etc/caddy/Caddyfile${NC}"
echo "   (Add the content from deploy/Caddyfile.snippet)"
echo ""
echo "5. Update Cloudflare Tunnel config:"
echo "   ${GREEN}sudo nano /etc/cloudflared/config.yml${NC}"
echo "   (Add the content from deploy/cloudflared.snippet BEFORE the 404 catch-all)"
echo ""
echo "6. Start services:"
echo "   ${GREEN}sudo systemctl enable ${APP_NAME}-backend${NC}"
echo "   ${GREEN}sudo systemctl start ${APP_NAME}-backend${NC}"
echo "   ${GREEN}sudo systemctl reload caddy${NC}"
echo "   ${GREEN}sudo systemctl restart cloudflared${NC}"
echo ""
echo "7. Add DNS record in Cloudflare Dashboard:"
echo "   Type: CNAME"
echo "   Name: tax"
echo "   Target: <your-tunnel-id>.cfargotunnel.com"
echo "   Proxy: ON (orange cloud)"
echo ""
echo "8. Verify deployment:"
echo "   ${GREEN}curl https://tax.dwings.app/health${NC}"
echo ""
echo -e "${GREEN}🎉 Build complete! Follow the manual steps above to deploy.${NC}"
