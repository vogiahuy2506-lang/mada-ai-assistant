#!/bin/bash
# MADA AI - Run All Tests
# Chạy tất cả các loại test: QA, Performance, Integration

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           MADA AI - TEST SUITE RUNNER                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
echo -e "${BLUE}▸ Checking server status...${NC}"
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server is running"
else
    echo -e "${RED}✗${NC} Server is not running. Please start server first:"
    echo "   npm run server"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ 1. QA ACCURACY TESTS (RAG + Product Data)                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

npm run test:qa

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ 2. PERFORMANCE TESTS (API Response Time < 2s)              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

npm run test:performance

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ 3. PERFORMANCE BENCHMARK (10 iterations)                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

npm run test:performance:benchmark

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ ✓ ALL TESTS COMPLETED                                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
