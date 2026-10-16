#!/bin/bash
# =====================================================
# MADA AI Assistant - VPS Setup Script
# =====================================================
# Chạy script này TRÊN VPS (Ubuntu/Debian) để:
#   1. Cài Docker + Docker Compose
#   2. Tạo thư mục project
#   3. Tạo file .env template
#   4. Setup firewall cơ bản
#
# Usage:
#   chmod +x setup-vps.sh
#   ./setup-vps.sh
# =====================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  MADA AI Assistant — VPS Setup Script      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# ---- Step 1: Check OS ----
echo -e "${BLUE}🔍 Checking OS...${NC}"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo -e "${GREEN}✅ OS: ${PRETTY_NAME}${NC}"
else
  echo -e "${RED}❌ Cannot detect OS. This script supports Ubuntu/Debian.${NC}"
  exit 1
fi

# ---- Step 2: Install Docker ----
echo ""
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version)
  echo -e "${GREEN}✅ Docker already installed: ${DOCKER_VERSION}${NC}"
else
  echo -e "${YELLOW}⚠️  Installing Docker...${NC}"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  sudo usermod -aG docker $USER
  echo -e "${GREEN}✅ Docker installed${NC}"
  echo -e "${YELLOW}⚠️  Please log out and log back in to use Docker without sudo${NC}"
fi

# ---- Step 3: Install Docker Compose plugin ----
echo ""
echo -e "${BLUE}🐳 Checking Docker Compose...${NC}"
if docker compose version &> /dev/null; then
  COMPOSE_VERSION=$(docker compose version)
  echo -e "${GREEN}✅ Docker Compose: ${COMPOSE_VERSION}${NC}"
else
  echo -e "${YELLOW}⚠️  Installing Docker Compose plugin...${NC}"
  sudo apt update
  sudo apt install -y docker-compose-plugin
  echo -e "${GREEN}✅ Docker Compose installed${NC}"
fi

# ---- Step 4: Tạo thư mục project ----
echo ""
echo -e "${BLUE}📁 Creating project directories...${NC}"
sudo mkdir -p /app/mada-assistant
sudo mkdir -p /app/mada-assistant/nginx/certs
sudo mkdir -p /app/mada-assistant/backup
sudo chown -R $USER:$USER /app/mada-assistant
echo -e "${GREEN}✅ Directories created: /app/mada-assistant${NC}"

# ---- Step 5: Tạo file .env nếu chưa có ----
echo ""
echo -e "${BLUE}📝 Creating .env template...${NC}"
if [ -f /app/mada-assistant/.env ]; then
  echo -e "${YELLOW}⚠️  .env already exists - skipping${NC}"
else
  cat > /app/mada-assistant/.env <<'EOF'
# ===========================================
# MADA AI Assistant - Production Environment
# ===========================================
# Image GHCR (thay <github-user> bằng username thật)
MADA_IMAGE=ghcr.io/<github-user>/mada-ai-assistant:latest

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here

# Auth
JWT_SECRET=change-me-with-openssl-rand-hex-32
ADMIN_EMAIL=admin@mada.vn
ADMIN_PASSWORD=Admin@123

# Server
NODE_ENV=production
PORT=3000
EOF
  echo -e "${GREEN}✅ .env created at /app/mada-assistant/.env${NC}"
  echo -e "${YELLOW}�️  Please edit /app/mada-assistant/.env and fill in real values${NC}"
fi

# ---- Step 6: Setup firewall (UFW) ----
echo ""
echo -e "${BLUE}🛡️  Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
  sudo ufw --force reset
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow ssh
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  echo "y" | sudo ufw enable
  sudo ufw status
  echo -e "${GREEN}✅ Firewall configured${NC}"
else
  echo -e "${YELLOW}⚠️  UFW not found, skipping firewall setup${NC}"
fi

# ---- Step 7: Setup auto-backup cron ----
echo ""
echo -e "${BLUE}💾 Setting up automatic backup (daily at 3 AM)...${NC}"
BACKUP_SCRIPT="/app/mada-assistant/backup-db.sh"
sudo tee $BACKUP_SCRIPT > /dev/null <<'BACKUP_EOF'
#!/bin/bash
# Daily backup SQLite database
BACKUP_DIR="/app/mada-assistant/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Get DB from volume
docker run --rm \
  -v mada-assistant_mada-data:/source:ro \
  -v "$BACKUP_DIR":/backup \
  alpine \
  tar czf "/backup/mada-db-${TIMESTAMP}.tgz" -C /source .

# Keep only last 7 days
find "$BACKUP_DIR" -name "mada-db-*.tgz" -mtime +7 -delete

echo "✅ Backup completed: mada-db-${TIMESTAMP}.tgz"
BACKUP_EOF

sudo chmod +x $BACKUP_SCRIPT

# Add to crontab (skip if already exists)
( crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" ; echo "0 3 * * * $BACKUP_SCRIPT" ) | crontab -
echo -e "${GREEN}✅ Cron job added (runs daily at 3 AM)${NC}"

# ---- Done ----
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅ VPS SETUP COMPLETED                ║${NC}"
echo -e "${GREEN}�════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "   1. Edit ${BLUE}/app/mada-assistant/.env${NC} và điền API keys thật"
echo -e "   2. Copy ${BLUE}docker-compose.yml${NC} và ${BLUE}nginx/nginx.conf${NC} vào /app/mada-assistant/"
echo -e "   3. Setup GitHub Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY"
echo -e "   4. Push code lên GitHub - CI/CD sẽ tự động deploy"
echo ""
echo -e "${YELLOW}🔧 Useful commands:${NC}"
echo -e "   ${BLUE}cd /app/mada-assistant && docker compose pull && docker compose up -d${NC}"
echo -e "   ${BLUE}docker compose logs -f app${NC}"
echo -e "   ${BLUE}docker compose restart app${NC}"
echo -e "   ${BLUE}curl http://localhost/api/health${NC}"
echo ""
