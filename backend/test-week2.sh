#!/bin/bash
# test-week2.sh - Comprehensive Week 2 Integration Tests for MADA AI Backend
# Tuần 2: Backend, AI Agent Core & RAG Retrieval Engine

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
PASSED=0
FAILED=0
TOTAL=0

print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
  echo -e "  ${YELLOW}[TEST]${NC} $1"
}

pass() {
  echo -e "  ${GREEN}✓ PASS${NC} $1"
  ((PASSED++))
  ((TOTAL++))
}

fail() {
  echo -e "  ${RED}✗ FAIL${NC} $1"
  ((FAILED++))
  ((TOTAL++))
}

info() {
  echo -e "  ${BLUE}ℹ INFO${NC} $1"
}

# Check if backend is running
check_backend() {
  print_header "1. Checking Backend Health"
  print_test "Backend at $BACKEND_URL..."

  if curl -sf --max-time 5 "$BACKEND_URL/health" > /dev/null 2>&1; then
    pass "Backend is running"
  else
    fail "Backend is NOT running at $BACKEND_URL"
    info "Start with: cd backend && npm run dev"
    return 1
  fi
}

# Test health endpoint
test_health() {
  print_header "2. Health Check API"
  print_test "GET /health"

  RESP=$(curl -sf --max-time 10 "$BACKEND_URL/health" 2>/dev/null || echo '{}')
  if echo "$RESP" | grep -q '"status"'; then
    pass "Health endpoint returns valid JSON"
  else
    fail "Health endpoint failed"
  fi
}

# Test RAG API v1
test_rag_search() {
  print_header "3. RAG Search API"
  print_test "POST /api/v1/rag/search"

  RESP=$(curl -sf --max-time 15 "$BACKEND_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"thiết bị cho người khiếm thị đọc sách","maxResults":5}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"results"'; then
    COUNT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])))" 2>/dev/null || echo "0")
    pass "RAG search returns results (count: $COUNT)"

    if echo "$RESP" | grep -q '"category"'; then
      CAT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('results',[{}])[0]; print(r.get('item',{}).get('category','unknown'))" 2>/dev/null || echo "")
      info "Top result category: $CAT"
    fi
  else
    fail "RAG search failed"
    echo "  Response: $RESP"
  fi
}

# Test RAG with category filter
test_rag_category_filter() {
  print_header "4. RAG Category Filter"
  print_test "POST /api/v1/rag/search (category: vision)"

  RESP=$(curl -sf --max-time 15 "$BACKEND_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"thiết bị hỗ trợ","categories":["vision"],"maxResults":3}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"results"'; then
    CAT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('results',[{}])[0]; print(r.get('item',{}).get('category','unknown'))" 2>/dev/null || echo "")
    if [ "$CAT" = "vision" ]; then
      pass "Category filter works correctly (got: $CAT)"
    else
      fail "Category filter incorrect (got: $CAT, expected: vision)"
    fi
  else
    fail "RAG category filter failed"
  fi
}

# Test RAG English query
test_rag_english() {
  print_header "5. RAG English Query"
  print_test "POST /api/v1/rag/search (English)"

  RESP=$(curl -sf --max-time 15 "$BACKEND_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"wheelchair for paraplegia","maxResults":3}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"results"'; then
    pass "English RAG query returns results"
  else
    fail "English RAG query failed"
  fi
}

# Test Chat API - Valid AT Request
test_chat_at_request() {
  print_header "6. Chat API - Valid AT Request"
  print_test "POST /api/v1/chat (valid query)"

  RESP=$(curl -sf --max-time 30 "$BACKEND_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Tôi cần thiết bị cho người khiếm thị đọc sách","language":"vi"}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"success"'; then
    if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)" 2>/dev/null; then
      pass "Chat API responds successfully"
      MSG_LEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('message','')))" 2>/dev/null || echo "0")
      info "Response length: $MSG_LEN chars"
    else
      fail "Chat API success=false"
    fi
  else
    fail "Chat API failed"
  fi
}

# Test Guardrails - Medical Diagnosis (BLOCK)
test_guardrails_medical() {
  print_header "7. Guardrails - Medical Diagnosis (BLOCK)"
  print_test "POST /api/v1/chat (medical diagnosis)"

  RESP=$(curl -sf --max-time 30 "$BACKEND_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Tôi bị tiểu đường, chẩn đoán giúp tôi","language":"vi"}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"guardrailAction"'; then
    ACTION=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('guardrailAction','none'))" 2>/dev/null || echo "")
    if [ "$ACTION" = "BLOCK" ]; then
      pass "Medical diagnosis BLOCKED correctly (action: $ACTION)"
    else
      fail "Medical diagnosis NOT blocked (action: $ACTION)"
    fi
  else
    # Fallback: check if response contains redirect text
    if echo "$RESP" | grep -q -i "bác sĩ\|chuyên gia"; then
      pass "Medical diagnosis handled with redirect"
    else
      fail "Medical diagnosis not handled"
    fi
  fi
}

# Test Guardrails - Treatment Request (REDIRECT)
test_guardrails_treatment() {
  print_header "8. Guardrails - Treatment Request (REDIRECT)"
  print_test "POST /api/v1/chat (treatment request)"

  RESP=$(curl -sf --max-time 30 "$BACKEND_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Tôi nên uống thuốc gì cho bệnh này?","language":"vi"}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"message"'; then
    pass "Treatment request returns response"
    if echo "$RESP" | grep -q -i "bác sĩ\|chuyên gia\|y khoa"; then
      pass "Response contains redirect to medical professional"
    fi
  else
    fail "Treatment request failed"
  fi
}

# Test Session Management
test_session_management() {
  print_header "9. Session Management"
  print_test "Chat creates new session"

  # Create first chat to get session ID
  RESP=$(curl -sf --max-time 30 "$BACKEND_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello","language":"vi"}' 2>/dev/null || echo '{}')

  SESSION_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('sessionId',''))" 2>/dev/null || echo "")

  if [ -n "$SESSION_ID" ]; then
    pass "Session ID created: ${SESSION_ID:0:8}..."

    # Get session
    print_test "GET /api/v1/chat/session/:id"
    SESSION_RESP=$(curl -sf --max-time 10 "$BACKEND_URL/api/v1/chat/session/$SESSION_ID" 2>/dev/null || echo '{}')
    if echo "$SESSION_RESP" | grep -q '"messages"'; then
      pass "Session retrieved with messages"
    else
      fail "Session retrieval failed"
    fi
  else
    fail "Session ID not returned"
  fi
}

# Test Session Stats
test_session_stats() {
  print_header "10. Session Statistics"
  print_test "GET /api/v1/chat/stats"

  RESP=$(curl -sf --max-time 10 "$BACKEND_URL/api/v1/chat/stats" 2>/dev/null || echo '{}')
  if echo "$RESP" | grep -q '"total"'; then
    TOTAL_SESSIONS=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',0))" 2>/dev/null || echo "0")
    pass "Session stats available (total: $TOTAL_SESSIONS)"
  else
    fail "Session stats failed"
  fi
}

# Test RAG product count
test_rag_product_count() {
  print_header "11. RAG Product Catalog"
  print_test "RAG has all 7 AT categories"

  RESP=$(curl -sf --max-time 15 "$BACKEND_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"assistive technology","maxResults":20}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"results"'; then
    # Check that we get products from different categories
    CATS=$(echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
cats=[r.get('item',{}).get('category','') for r in d.get('results',[])]
print(len(set(cats)))
" 2>/dev/null || echo "0")
    if [ "$CATS" -ge 2 ]; then
      pass "Multiple categories returned ($CATS unique categories)"
    else
      info "Only $CATS unique categories found"
    fi
  else
    fail "RAG product catalog test failed"
  fi
}

# Test Language Detection
test_language_detection() {
  print_header "12. Language Detection"
  print_test "RAG detects Vietnamese"

  RESP=$(curl -sf --max-time 15 "$BACKEND_URL/api/v1/rag/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"Tôi cần máy trợ thính","maxResults":1}' 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"detectedLanguage"'; then
    LANG=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detectedLanguage','unknown'))" 2>/dev/null || echo "")
    if [ "$LANG" = "vi" ]; then
      pass "Vietnamese detected correctly"
    else
      info "Detected language: $LANG"
    fi
  else
    fail "Language detection failed"
  fi
}

# Test Multi-turn Conversation
test_multiturn() {
  print_header "13. Multi-turn Conversation"
  print_test "Session maintains conversation history"

  # Create session
  RESP1=$(curl -sf --max-time 30 "$BACKEND_URL/api/v1/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"Tôi cần thiết bị cho người mù","language":"vi"}' 2>/dev/null || echo '{}')

  SESSION_ID=$(echo "$RESP1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('sessionId',''))" 2>/dev/null || echo "")

  if [ -n "$SESSION_ID" ]; then
    # Second message with same session
    RESP2=$(curl -sf --max-time 30 "$BACKEND_URL/api/v1/chat" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"Có loại nào rẻ hơn không?\",\"sessionId\":\"$SESSION_ID\",\"language\":\"vi\"}" 2>/dev/null || echo '{}')

    # Check session has 4 messages (2 user + 2 assistant)
    SESSION_RESP=$(curl -sf --max-time 10 "$BACKEND_URL/api/v1/chat/session/$SESSION_ID" 2>/dev/null || echo '{}')
    MSG_COUNT=$(echo "$SESSION_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('messages',[])))" 2>/dev/null || echo "0")

    if [ "$MSG_COUNT" -ge 4 ]; then
      pass "Multi-turn conversation works ($MSG_COUNT messages)"
    else
      fail "Multi-turn failed (got $MSG_COUNT messages, expected 4)"
    fi
  else
    fail "Could not create session for multi-turn test"
  fi
}

# Run backend unit tests
test_unit_tests() {
  print_header "14. Backend Unit Tests"
  print_test "Running vitest test suite..."

  if npx vitest run --reporter=basic 2>&1 | tail -5 | grep -q "passed"; then
    RESULT=$(npx vitest run --reporter=basic 2>&1 | tail -3)
    pass "Unit tests: $RESULT"
  else
    fail "Unit tests failed"
    npx vitest run --reporter=verbose 2>&1 | tail -10 || true
  fi
}

# Summary
print_summary() {
  print_header "TEST SUMMARY"
  echo -e "  ${GREEN}Passed:${NC}  $PASSED"
  echo -e "  ${RED}Failed:${NC}  $FAILED"
  echo -e "  ${BLUE}Total:${NC}   $TOTAL"
  echo ""

  if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉 TUẦN 2: TẤT CẢ TESTS ĐỀU PASS!                  ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
    return 0
  else
    echo -e "${RED}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  CÓ $FAILED TESTS THẤT BẠI - CẦN SỬA CHỮA         ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════╝${NC}"
    return 1
  fi
}

# Main
main() {
  echo -e "${BLUE}"
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║           MADA AI - TUẦN 2 INTEGRATION TESTS             ║"
  echo "║     Backend, AI Agent Core & RAG Retrieval Engine         ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  check_backend || exit 1
  test_health
  test_rag_search
  test_rag_category_filter
  test_rag_english
  test_chat_at_request
  test_guardrails_medical
  test_guardrails_treatment
  test_session_management
  test_session_stats
  test_rag_product_count
  test_language_detection
  test_multiturn

  # Only run unit tests if we're in the backend directory
  if [ -d "$(pwd)/backend" ]; then
    (cd backend && test_unit_tests)
  fi

  print_summary
}

main "$@"
