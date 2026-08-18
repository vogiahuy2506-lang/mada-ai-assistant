# ===========================================
# MADA AI Assistant - GitHub Secrets Setup
# ===========================================
# Chạy script này 1 LẦN DUY NHẤT trên máy local để in ra:
#   1. Giá trị cần thêm vào GitHub Secrets
#   2. Public key đã copy lên VPS
#
# Usage:
#   bash scripts/setup-github-secrets.sh
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MADA AI Assistant - GitHub Secrets Setup Helper       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ---- Check SSH key ----
SSH_KEY_PATH="${HOME}/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY_PATH" ]; then
  SSH_KEY_PATH="${HOME}/.ssh/id_rsa"
fi

if [ ! -f "$SSH_KEY_PATH" ]; then
  echo -e "${RED}❌ No SSH key found at ~/.ssh/id_ed25519 or ~/.ssh/id_rsa${NC}"
  echo -e "${YELLOW}💡 Generate one: ssh-keygen -t ed25519 -C 'github-actions'${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found SSH key: $SSH_KEY_PATH${NC}"
echo ""

# ---- Nhập thông tin VPS ----
echo -e "${BLUE}📝 Vui lòng nhập thông tin VPS:${NC}"
echo ""

read -p "$(echo -e ${YELLOW}IP VPS (vd: 34.123.45.67): ${NC})" VPS_HOST
while [ -z "$VPS_HOST" ]; do
  read -p "$(echo -e ${RED}IP VPS không được để trống: ${NC})" VPS_HOST
done

read -p "$(echo -e ${YELLOW}User SSH trên VPS [$(whoami)]: ${NC})" VPS_USER
VPS_USER=${VPS_USER:-$(whoami)}

read -p "$(echo -e ${YELLOW}GitHub username/org [vohuy]: ${NC})" GH_USER
GH_USER=${GH_USER:-vohuy}

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  COPY CÁC GIÁ TRỊ DƯỚI ĐÂY VÀO GITHUB SECRETS${NC}"
echo -e "${GREEN}  (Settings → Secrets and variables → Actions → New)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}─── Secret: VPS_HOST ───${NC}"
echo -e "${YELLOW}$VPS_HOST${NC}"
echo ""

echo -e "${BLUE}─── Secret: VPS_USER ───${NC}"
echo -e "${YELLOW}$VPS_USER${NC}"
echo ""

echo -e "${BLUE}─── Secret: VPS_SSH_KEY (toàn bộ nội dung private key) ───${NC}"
echo -e "${YELLOW}-----BEGIN COPY TỪ ĐÂY-----${NC}"
cat "$SSH_KEY_PATH"
echo -e "${YELLOW}-----END COPY ĐẾN ĐÂY-----${NC}"
echo ""

echo -e "${BLUE}─── GitHub Container Registry URL ───${NC}"
echo -e "${YELLOW}ghcr.io/$GH_USER/mada-ai-assistant:latest${NC}"
echo -e "(Dùng cho biến MADA_IMAGE trong file .env trên VPS)"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  PUBLIC KEY - COPY LÊN VPS${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

cat "${SSH_KEY_PATH}.pub"
echo ""

echo -e "${YELLOW}💡 Để copy lên VPS, chạy:${NC}"
echo -e "${BLUE}   ssh-copy-id -i ${SSH_KEY_PATH}.pub ${VPS_USER}@${VPS_HOST}${NC}"
echo -e "${YELLOW}💡 Hoặc copy public key ở trên và paste vào:${NC}"
echo -e "${BLUE}   ssh ${VPS_USER}@${VPS_HOST} 'mkdir -p ~/.ssh && echo \"...\" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'${NC}"
echo ""

# ---- Lưu thông tin ra file cho bước tiếp ----
cat > "$PROJECT_DIR/.deploy-config" <<EOF
VPS_HOST=$VPS_HOST
VPS_USER=$VPS_USER
GH_USER=$GH_USER
SSH_KEY_PATH=$SSH_KEY_PATH
EOF

echo -e "${GREEN}✅ Config saved to $PROJECT_DIR/.deploy-config${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BƯỚC TIẾP THEO${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Thêm 3 secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY) vào GitHub"
echo "2. Copy public key lên VPS (ssh-copy-id)"
echo "3. SSH vào VPS và chạy: bash /app/mada-assistant/scripts/setup-vps.sh"
echo "4. Copy docker-compose.yml + nginx.conf + .env lên VPS"
echo "5. git push origin main để trigger CI/CD deploy"
echo ""