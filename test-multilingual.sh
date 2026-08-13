#!/bin/bash
# =====================================================
# MADA AI - Test Multi-language (AR/FR) Script
# =====================================================
# Run: bash test-multilingual.sh
# =====================================================

set -e

BASE_URL="${API_BASE_URL:-http://localhost:3001}"

echo "========================================"
echo "MADA AI - Multilingual Testing (VI/EN/AR/FR)"
echo "========================================"
echo "Base URL: $BASE_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

info() {
    echo -e "${BLUE}ℹ INFO${NC}: $1"
}

# =====================================================
# TEST 1: Language Detection
# =====================================================
echo ""
echo "========================================"
echo "TEST 1: Language Detection"
echo "========================================"

# Test Vietnamese detection
info "Testing Vietnamese detection..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/detect-language" \
    -H "Content-Type: application/json" \
    -d '{"text":"Tôi cần một thiết bị hỗ trợ người khiếm thị"}')
if echo "$RESP" | grep -q '"language":"vi"'; then
    pass "Vietnamese detection"
else
    fail "Vietnamese detection - Got: $RESP"
fi

# Test English detection
info "Testing English detection..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/detect-language" \
    -H "Content-Type: application/json" \
    -d '{"text":"I need a device for blind people"}')
if echo "$RESP" | grep -q '"language":"en"'; then
    pass "English detection"
else
    fail "English detection - Got: $RESP"
fi

# Test Arabic detection
info "Testing Arabic detection..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/detect-language" \
    -H "Content-Type: application/json" \
    -d '{"text":"أحتاج جهازًا للأشخاص المكفوفين"}')
if echo "$RESP" | grep -q '"language":"ar"'; then
    pass "Arabic detection"
else
    fail "Arabic detection - Got: $RESP"
fi

# Test French detection
info "Testing French detection..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/detect-language" \
    -H "Content-Type: application/json" \
    -d '{"text":"J\'ai besoin d\'un appareil pour les personnes aveugles"}')
if echo "$RESP" | grep -q '"language":"fr"'; then
    pass "French detection"
else
    fail "French detection - Got: $RESP"
fi

# =====================================================
# TEST 2: Chat Response - Vietnamese
# =====================================================
echo ""
echo "========================================"
echo "TEST 2: Chat Response - Vietnamese (VI)"
echo "========================================"

info "Testing VI chat response..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{
        "message": "Tôi bị khiếm thị, cho tôi gợi ý thiết bị hỗ trợ",
        "language": "vi",
        "sessionId": "test-vi-session"
    }')

if echo "$RESP" | grep -q '"response"'; then
    # Check if response contains Vietnamese
    if echo "$RESP" | grep -q "Việt\|thiết bị\|hỗ trợ\|khiếm thị\|mù\|đọc"; then
        pass "VI chat response (contains VI keywords)"
    else
        info "VI chat response (checking response length)"
        LEN=$(echo "$RESP" | grep -o '"response":"[^"]*"' | wc -c)
        if [ "$LEN" -gt 50 ]; then
            pass "VI chat response (length: $LEN chars)"
        else
            fail "VI chat response too short"
        fi
    fi
else
    fail "VI chat - No response field"
fi

# =====================================================
# TEST 3: Chat Response - English
# =====================================================
echo ""
echo "========================================"
echo "TEST 3: Chat Response - English (EN)"
echo "========================================"

info "Testing EN chat response..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{
        "message": "I am visually impaired, recommend assistive devices",
        "language": "en",
        "sessionId": "test-en-session"
    }')

if echo "$RESP" | grep -q '"response"'; then
    pass "EN chat response"
else
    fail "EN chat - No response field"
fi

# =====================================================
# TEST 4: Chat Response - Arabic
# =====================================================
echo ""
echo "========================================"
echo "TEST 4: Chat Response - Arabic (AR)"
echo "========================================"

info "Testing AR chat response..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{
        "message": "أنا ضعيف البصر، أوصي بأجهزة مساعدة",
        "language": "ar",
        "sessionId": "test-ar-session"
    }')

if echo "$RESP" | grep -q '"response"'; then
    # Check if response contains Arabic characters
    if echo "$RESP" | grep -qE '[\u0600-\u06FF]'; then
        pass "AR chat response (contains Arabic text)"
    else
        info "AR chat response - checking content"
        LEN=$(echo "$RESP" | grep -o '"response":"[^"]*"' | wc -c)
        if [ "$LEN" -gt 50 ]; then
            pass "AR chat response (length: $LEN chars)"
        else
            fail "AR chat response too short or no Arabic text"
        fi
    fi
else
    fail "AR chat - No response field"
fi

# =====================================================
# TEST 5: Chat Response - French
# =====================================================
echo ""
echo "========================================"
echo "TEST 5: Chat Response - French (FR)"
echo "========================================"

info "Testing FR chat response..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{
        "message": "Je suis malvoyant, recommandez des appareils d\'assistance",
        "language": "fr",
        "sessionId": "test-fr-session"
    }')

if echo "$RESP" | grep -q '"response"'; then
    # Check if response contains French characters/words
    if echo "$RESP" | grep -qE '(appareil|assistance|malvoyant|dispositif|français)'; then
        pass "FR chat response (contains French keywords)"
    else
        info "FR chat response - checking content"
        LEN=$(echo "$RESP" | grep -o '"response":"[^"]*"' | wc -c)
        if [ "$LEN" -gt 50 ]; then
            pass "FR chat response (length: $LEN chars)"
        else
            fail "FR chat response too short"
        fi
    fi
else
    fail "FR chat - No response field"
fi

# =====================================================
# TEST 6: RAG Retrieval - Vietnamese
# =====================================================
echo ""
echo "========================================"
echo "TEST 6: RAG Retrieval - Vietnamese (VI)"
echo "========================================"

info "Testing VI RAG retrieval..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{
        "query": "thiết bị hỗ trợ người khiếm thị",
        "language": "vi",
        "maxResults": 3
    }')

if echo "$RESP" | grep -q '"results"'; then
    pass "VI RAG retrieval"
else
    fail "VI RAG - No results field"
fi

# =====================================================
# TEST 7: RAG Retrieval - English
# =====================================================
echo ""
echo "========================================"
echo "TEST 7: RAG Retrieval - English (EN)"
echo "========================================"

info "Testing EN RAG retrieval..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{
        "query": "assistive devices for blind people",
        "language": "en",
        "maxResults": 3
    }')

if echo "$RESP" | grep -q '"results"'; then
    pass "EN RAG retrieval"
else
    fail "EN RAG - No results field"
fi

# =====================================================
# TEST 8: RAG Retrieval - Arabic
# =====================================================
echo ""
echo "========================================"
echo "TEST 8: RAG Retrieval - Arabic (AR)"
echo "========================================"

info "Testing AR RAG retrieval..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{
        "query": "أجهزة مساعدة للمكفوفين",
        "language": "ar",
        "maxResults": 3
    }')

if echo "$RESP" | grep -q '"results"'; then
    pass "AR RAG retrieval"
else
    fail "AR RAG - No results field"
fi

# =====================================================
# TEST 9: RAG Retrieval - French
# =====================================================
echo ""
echo "========================================"
echo "TEST 9: RAG Retrieval - French (FR)"
echo "========================================"

info "Testing FR RAG retrieval..."
RESP=$(curl -s -X POST "$BASE_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{
        "query": "appareils d\'assistance pour aveugles",
        "language": "fr",
        "maxResults": 3
    }')

if echo "$RESP" | grep -q '"results"'; then
    pass "FR RAG retrieval"
else
    fail "FR RAG - No results field"
fi

# =====================================================
# TEST 10: Knowledge Base Categories - Multi-language
# =====================================================
echo ""
echo "========================================"
echo "TEST 10: Knowledge Base Categories (4 Languages)"
echo "========================================"

info "Testing KB categories..."
RESP=$(curl -s "$BASE_URL/api/kb/categories")

# Check for all 4 language fields
if echo "$RESP" | grep -q '"name_vi"'; then
    pass "KB categories have VI names"
else
    fail "KB categories - missing VI names"
fi

if echo "$RESP" | grep -q '"name_en"'; then
    pass "KB categories have EN names"
else
    fail "KB categories - missing EN names"
fi

if echo "$RESP" | grep -q '"name_ar"'; then
    pass "KB categories have AR names"
else
    fail "KB categories - missing AR names"
fi

if echo "$RESP" | grep -q '"name_fr"'; then
    pass "KB categories have FR names"
else
    fail "KB categories - missing FR names"
fi

# =====================================================
# TEST 11: Health Check
# =====================================================
echo ""
echo "========================================"
echo "TEST 11: API Health Check"
echo "========================================"

info "Testing API health..."
RESP=$(curl -s "$BASE_URL/api/health")
if echo "$RESP" | grep -q '"status"'; then
    pass "API health check"
else
    fail "API health - unexpected response"
fi

# =====================================================
# SUMMARY
# =====================================================
echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ Some tests failed. Please review.${NC}"
    exit 1
fi
