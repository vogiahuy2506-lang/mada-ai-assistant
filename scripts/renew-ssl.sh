#!/bin/bash
# ===========================================
# SSL Auto-Renewal Script
# Chạy tự động mỗi ngày hoặc manual
# ===========================================
set -e

DOMAIN="mada.digiso.vn"
NGINX_CERTS_DIR="$(pwd)/nginx/certs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      SSL Certificate Renewal Check        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# ---- Kiểm tra certbot ----
if ! command -v certbot &> /dev/null; then
    echo -e "${RED}❌ Certbot chưa được cài đặt${NC}"
    echo -e "${YELLOW}💡 Chạy setup-ssl.sh trước${NC}"
    exit 1
fi

# ---- Dry-run để xem có cần renew không ----
echo -e "${YELLOW}🔍 Đang kiểm tra certificate...${NC}"
certbot certificates 2>/dev/null | grep -A5 "$DOMAIN" || echo "Không tìm thấy certificate cho $DOMAIN"
echo ""

# ---- Thử renew ----
echo -e "${YELLOW}🔄 Đang thử renew certificate...${NC}"
certbot renew --quiet --deploy-hook "echo 'Renew successful'" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Certificate renewal thành công!${NC}"

    # Copy certs mới sang nginx
    LIVE_DIR="/etc/letsencrypt/live/$DOMAIN"
    if [ -d "$LIVE_DIR" ]; then
        echo -e "${YELLOW}📋 Copy certificates mới...${NC}"
        cp "$LIVE_DIR/fullchain.pem" "$NGINX_CERTS_DIR/"
        cp "$LIVE_DIR/privkey.pem" "$NGINX_CERTS_DIR/"
        chmod 644 "$NGINX_CERTS_DIR"/*.pem
    fi

    # Reload nginx
    echo -e "${YELLOW}🔁 Reload nginx...${NC}"
    docker exec mada-nginx nginx -s reload 2>/dev/null || nginx -s reload 2>/dev/null || true
    echo -e "${GREEN}✅ Nginx đã reload với certificate mới${NC}"
else
    echo -e "${YELLOW}⚠️  Certificate chưa cần renew hoặc có lỗi${NC}"
    echo -e "${BLUE}💡 Certificate Let's Encrypt có hiệu lực 90 ngày${NC}"
fi

echo ""
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
