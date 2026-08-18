#!/bin/bash
# =====================================================
# MADA AI Assistant - Verify Deploy Script
# =====================================================
# Kiểm tra deployment sau khi CI/CD chạy xong:
#   - Containers running
#   - Health check OK
#   - Database accessible
#   - Logs không có lỗi
#
# Usage:
#   bash scripts/verify-deploy.sh           # dùng .deploy-config
#   VPS_HOST=1.2.3.4 VPS_USER=vohuy bash scripts/verify-deploy.sh
# =====================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load config
if [ -f "$PROJECT_DIR/.deploy-config" ]; then
  source "$PROJECT_DIR/.deploy-config"
fi

# Override từ env vars
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-$(whoami)}"

if [ -z "$VPS_HOST" ]; then
  echo -e "${RED}❌ VPS_HOST chưa được set. Chạy:${NC}"
  echo -e "   ${YELLOW}export VPS_HOST=1.2.3.4 && export VPS_USER=vohuy${NC}"
  echo -e "   ${YELLOW}hoặc chạy scripts/master-deploy.sh trước${NC}"
  exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MADA AI Assistant - Verify Deploy                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Target: ${GREEN}$VPS_USER@$VPS_HOST${NC}"
echo ""

PASS=0
FAIL=0

check() {
  local label="$1"
  local cmd="$2"

  if ssh -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST" "$cmd" > /tmp/verify.out 2>&1; then
    echo -e "${GREEN}✅ $label${NC}"
    if [ -s /tmp/verify.out ]; then
      echo "   $(head -1 /tmp/verify.out)"
    fi
    PASS=$((PASS+1))
  else
    echo -e "${RED}❌ $label${NC}"
    cat /tmp/verify.out
    echo ""
    FAIL=$((FAIL+1))
  fi
}

# ---- Check 1: Docker daemon ----
echo -e "${BLUE}[1/8] Checking Docker daemon...${NC}"
check "Docker daemon" "docker info > /dev/null"
echo ""

# ---- Check 2: Docker Compose project ----
echo -e "${BLUE}[2/8] Checking Docker Compose project...${NC}"
check "Docker Compose config valid" "cd /app/mada-assistant && docker compose config > /dev/null"
echo ""

# ---- Check 3: Containers running ----
echo -e "${BLUE}[3/8] Checking containers...${NC}"
check "App container running" "docker ps --format '{{.Names}}' | grep -q mada-app"
check "Nginx container running" "docker ps --format '{{.Names}}' | grep -q mada-nginx"
echo ""

# ---- Check 4: Health endpoint ----
echo -e "${BLUE}[4/8] Checking health endpoint...${NC}"
check "App /api/health responds 200" "curl -sf http://localhost/api/health | grep -q '\"status\":\"ok\"'"
echo ""

# ---- Check 5: Database ----
echo -e "${BLUE}[5/8] Checking database...${NC}"
check "SQLite DB exists" "docker exec mada-app test -f /app/data/mada.db"
check "SQLite DB readable" "docker exec mada-app sqlite3 /app/data/mada.db 'SELECT COUNT(*) FROM users' | grep -qE '^[0-9]+\$'"
echo ""

# ---- Check 6: Persistent volumes ----
echo -e "${BLUE}[6/8] Checking volumes...${NC}"
check "mada-data volume exists" "docker volume ls --format '{{.Name}}' | grep -q mada-assistant_mada-data"
check "mada-uploads volume exists" "docker volume ls --format '{{.Name}}' | grep -q mada-assistant_mada-uploads"
echo ""

# ---- Check 7: Logs không có lỗi fatal ----
echo -e "${BLUE}[7/8] Checking recent logs...${NC}"
check "No FATAL errors in app logs (last 100 lines)" "! docker logs --tail=100 mada-app 2>&1 | grep -qiE 'fatal|cannot find module|error.*spawn'"
echo ""

# ---- Check 8: Backup cron ----
echo -e "${BLUE}[8/8] Checking backup cron...${NC}"
check "Backup cron configured" "crontab -l 2>/dev/null | grep -q 'backup-db.sh'"
echo ""

# ---- Summary ----
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS+FAIL))
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All $PASS/$TOTAL checks passed!${NC}"
  echo -e "${GREEN}🎉 Deploy đang chạy ổn định!${NC}"
else
  echo -e "${YELLOW}⚠️  $PASS/$TOTAL passed, $FAIL failed${NC}"
  echo -e "${YELLOW}📋 Check chi tiết bằng:${NC}"
  echo -e "   ${BLUE}ssh $VPS_USER@$VPS_HOST 'cd /app/mada-assistant && docker compose logs --tail=50'${NC}"
fi
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Useful commands:${NC}"
echo -e "   ${BLUE}ssh $VPS_USER@$VPS_HOST 'cd /app/mada-assistant && docker compose logs -f'${NC}"
echo -e "   ${BLUE}ssh $VPS_USER@$VPS_HOST 'cd /app/mada-assistant && docker compose ps'${NC}"
echo -e "   ${BLUE}curl http://$VPS_HOST/api/health${NC}"
echo ""

exit $FAIL