#!/bin/bash
# =====================================================
# MADA AI Assistant — Deploy Script
# Build Docker image (linux/amd64) and deploy to Cloud Run
# =====================================================
set -e

PROJECT_ID="gen-lang-client-0003620608"
SERVICE="mada-ai"
REGION="asia-southeast1"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MADA AI Assistant — Deploy to Cloud Run ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# ---- Step 1: Get current commit ----
if [ -d .git ]; then
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
  MESSAGE=$(git log -1 --pretty=%B 2>/dev/null | head -1 || echo "Manual deploy")
  echo -e "${YELLOW}📝 Commit:${NC} ${COMMIT}"
  echo -e "${YELLOW}💬 Message:${NC} ${MESSAGE}"
else
  COMMIT="manual"
  echo -e "${YELLOW}📝 Manual deploy (no git)${NC}"
fi
echo ""

# ---- Step 2: Check env ----
echo -e "${BLUE}🔍 Checking environment...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker not found${NC}"
  exit 1
fi

if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}❌ gcloud not found. Run: brew install --cask google-cloud-sdk${NC}"
  exit 1
fi

# Check auth
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
  echo -e "${YELLOW}⚠️  Not authenticated. Run: gcloud auth login${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Docker + gcloud ready${NC}"
echo ""

# ---- Step 3: Docker auth ----
echo -e "${BLUE}🔐 Configuring Docker for GCR...${NC}"
gcloud auth configure-docker gcr.io --quiet > /dev/null 2>&1
echo -e "${GREEN}✅ Done${NC}"
echo ""

# ---- Step 4: Build & push ----
TAG="${IMAGE}:${COMMIT}"
echo -e "${BLUE}🏗️  Building Docker image (linux/amd64)...${NC}"
echo -e "   ${TAG}"
docker buildx build --platform linux/amd64 \
  -t "${TAG}" \
  -t "${IMAGE}:latest" \
  --push \
  . 2>&1 | tail -3
echo -e "${GREEN}✅ Image built & pushed${NC}"
echo ""

# ---- Step 5: Deploy to Cloud Run ----
echo -e "${BLUE}🚀 Deploying to Cloud Run...${NC}"
gcloud run services update ${SERVICE} \
  --region=${REGION} \
  --image="${TAG}" \
  --quiet 2>&1 | tail -3
echo ""

# ---- Step 6: Show result ----
URL=$(gcloud run services describe ${SERVICE} --region=${REGION} --format='value(status.url)' 2>/dev/null)

echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ DEPLOY SUCCESSFUL             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}🌐 URL:${NC}      ${URL}"
echo -e "${GREEN}📝 Commit:${NC}   ${COMMIT}"
echo -e "${GREEN}🕐 Time:${NC}     $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Show health
echo -e "${BLUE}🏥 Health check:${NC}"
curl -s "${URL}/api/health" | python3 -m json.tool 2>/dev/null | head -5 || echo "(checking...)"
echo ""

# Open in browser
echo -e "${YELLOW}🌍 Opening ${URL} in browser...${NC}"
open "${URL}" 2>/dev/null || echo "   (open manually: ${URL})"
