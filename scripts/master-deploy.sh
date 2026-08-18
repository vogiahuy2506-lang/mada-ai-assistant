#!/bin/bash
# =====================================================
# MADA AI Assistant - Master Deploy Script
# =====================================================
# Chạy script này trên máy LOCAL để tự động:
#   1. Copy SSH key lên VPS
#   2. Setup VPS (cài Docker, firewall, backup cron)
#   3. Copy docker-compose.yml + nginx.conf lên VPS
#   4. Tạo .env trên VPS
#   5. Test deploy locally (optional)
#
# Usage:
#   chmod +x scripts/master-deploy.sh
#   ./scripts/master-deploy.sh
# =====================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MADA AI Assistant - Master Deploy Script               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ---- Load config nếu có ----
if [ -f "$PROJECT_DIR/.deploy-config" ]; then
  source "$PROJECT_DIR/.deploy-config"
  echo -e "${GREEN}✅ Loaded config from .deploy-config${NC}"
  echo -e "   VPS_HOST=$VPS_HOST"
  echo -e "   VPS_USER=$VPS_USER"
  echo -e "   GH_USER=$GH_USER"
  echo ""
fi

# ---- Nhập thông tin ----
read -p "$(echo -e ${YELLOW}IP VPS [${VPS_HOST:-}]: ${NC})" INPUT
VPS_HOST=${INPUT:-$VPS_HOST}
while [ -z "$VPS_HOST" ]; do
  read -p "$(echo -e ${RED}IP VPS không được để trống: ${NC})" VPS_HOST
done

read -p "$(echo -e ${YELLOW}User SSH [${VPS_USER:-$(whoami)}]: ${NC})" INPUT
VPS_USER=${INPUT:-${VPS_USER:-$(whoami)}}

read -p "$(echo -e ${YELLOW}GitHub user/org [${GH_USER:-vohuy}]: ${NC})" INPUT
GH_USER=${INPUT:-${GH_USER:-vohuy}}

echo ""
echo -e "${BLUE}──────────────────────────────────────────────────────────${NC}"
echo -e "${YELLOW}  Thông tin:${NC}"
echo -e "  VPS: ${GREEN}$VPS_USER@$VPS_HOST${NC}"
echo -e "  GitHub image: ${GREEN}ghcr.io/$GH_USER/mada-ai-assistant:latest${NC}"
echo -e "${BLUE}──────────────────────────────────────────────────────────${NC}"
echo ""

# ---- Lưu config ----
cat > "$PROJECT_DIR/.deploy-config" <<EOF
VPS_HOST=$VPS_HOST
VPS_USER=$VPS_USER
GH_USER=$GH_USER
EOF

# ---- Test SSH connection ----
echo -e "${BLUE}🔌 Test kết nối SSH đến $VPS_USER@$VPS_HOST...${NC}"
if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "echo OK" 2>/dev/null; then
  echo -e "${GREEN}✅ SSH connection OK${NC}"
else
  echo -e "${RED}❌ Không thể kết nối SSH. Kiểm tra:${NC}"
  echo -e "   - IP VPS có đúng không"
  echo -e "   - VM có allow port 22 không (GCP firewall rules)"
  echo -e "   - SSH key đã authorized chưa (ssh-copy-id)"
  exit 1
fi
echo ""

# ---- Copy SSH key nếu chưa có ----
echo -e "${BLUE}🔑 Đảm bảo SSH key đã authorized trên VPS...${NC}"
if ssh -o BatchMode=yes -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" "echo OK" 2>/dev/null; then
  echo -e "${GREEN}✅ SSH key đã authorized${NC}"
else
  echo -e "${YELLOW}⚠️  Copy SSH key lên VPS (cần nhập password lần cuối)...${NC}"
  ssh-copy-id "$VPS_USER@$VPS_HOST"
fi
echo ""

# ---- Run setup-vps.sh trên VPS ----
echo -e "${BLUE}🛠️  Chạy setup-vps.sh trên VPS...${NC}"
ssh "$VPS_USER@$VPS_HOST" "bash -s" -- < "$SCRIPT_DIR/setup-vps.sh"
echo -e "${GREEN}✅ VPS setup hoàn tất${NC}"
echo ""

# ---- Copy docker-compose.yml ----
echo -e "${BLUE}📦 Copy docker-compose.yml lên VPS...${NC}"
scp "$PROJECT_DIR/docker-compose.yml" "$VPS_USER@$VPS_HOST:/app/mada-assistant/docker-compose.yml"
echo -e "${GREEN}✅ docker-compose.yml copied${NC}"
echo ""

# ---- Copy nginx config ----
echo -e "${BLUE}📦 Copy nginx/nginx.conf lên VPS...${NC}"
scp "$PROJECT_DIR/nginx/nginx.conf" "$VPS_USER@$VPS_HOST:/app/mada-assistant/nginx/nginx.conf"
ssh "$VPS_USER@$VPS_HOST" "mkdir -p /app/mada-assistant/nginx/certs"
echo -e "${GREEN}✅ nginx/nginx.conf copied${NC}"
echo ""

# ---- Tạo .env trên VPS nếu chưa có ----
echo -e "${BLUE}📝 Setup .env trên VPS...${NC}"
ssh "$VPS_USER@$VPS_HOST" <<REMOTE_EOF
if [ -f /app/mada-assistant/.env ]; then
  echo "✅ .env đã tồn tại, giữ nguyên"
else
  JWT_SECRET="\$(openssl rand -hex 32)"
  cat > /app/mada-assistant/.env <<EOF
MADA_IMAGE=ghcr.io/$GH_USER/mada-ai-assistant:latest
GEMINI_API_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=mada-knowledge-base
VECTOR_DB_PROVIDER=pinecone
DATABASE_PATH=/app/data/mada.db
JWT_SECRET=\$JWT_SECRET
ADMIN_EMAIL=admin@mada.vn
ADMIN_PASSWORD=\$(openssl rand -hex 12)
NODE_ENV=production
PORT=3000
EOF
  echo "✅ .env đã được tạo với JWT_SECRET random"
  echo "📝 Bạn cần edit .env và điền GEMINI_API_KEY, PINECONE_API_KEY:"
  echo "   ssh $VPS_USER@$VPS_HOST 'nano /app/mada-assistant/.env'"
fi
REMOTE_EOF
echo ""

# ---- Done ----
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         ✅ MASTER DEPLOY SETUP COMPLETED!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📋 Bước tiếp theo:${NC}"
echo ""
echo -e "${BLUE}1️⃣  Setup GitHub Secrets (chạy script helper):${NC}"
echo -e "   ${YELLOW}bash scripts/setup-github-secrets.sh${NC}"
echo ""
echo -e "${BLUE}2️⃣  Edit .env trên VPS với API keys thật:${NC}"
echo -e "   ${YELLOW}ssh $VPS_USER@$VPS_HOST 'nano /app/mada-assistant/.env'${NC}"
echo ""
echo -e "${BLUE}3️⃣  Test Docker build local (optional):${NC}"
echo -e "   ${YELLOW}docker build -t test . && docker run --rm -p 3456:3000 test${NC}"
echo ""
echo -e "${BLUE}4️⃣  Commit code + push lên GitHub:${NC}"
echo -e "   ${YELLOW}git add . && git commit -m 'Setup CI/CD' && git push origin main${NC}"
echo ""
echo -e "${BLUE}5️⃣  Xem CI/CD chạy:${NC}"
echo -e "   ${YELLOW}https://github.com/$GH_USER/mada-ai-assistant/actions${NC}"
echo ""
echo -e "${BLUE}6️⃣  Sau khi deploy xong, verify:${NC}"
echo -e "   ${YELLOW}bash scripts/verify-deploy.sh${NC}"
echo ""