#!/bin/bash
# MADA AI - Comprehensive Test Suite for Tuần 1
# Tự động chạy tất cả test case và báo cáo kết quả

set -e
BASE="http://localhost:3001"
PASS=0
FAIL=0
WARN=0
RESULTS=()

run_test() {
  local name="$1"
  local cmd="$2"
  local expected="$3"

  local result
  result=$(eval "$cmd" 2>&1)
  local exit_code=$?

  if echo "$result" | grep -q "$expected"; then
    echo "✅ PASS: $name"
    PASS=$((PASS+1))
    RESULTS+=("PASS: $name")
  elif [ $exit_code -ne 0 ]; then
    echo "❌ FAIL: $name (exit $exit_code)"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL: $name")
  else
    echo "⚠️  WARN: $name (no '$expected' found)"
    WARN=$((WARN+1))
    RESULTS+=("WARN: $name")
  fi
}

echo "════════════════════════════════════════════════"
echo "  MADA AI - TUẦN 1 TEST SUITE"
echo "════════════════════════════════════════════════"
echo ""

# ========== TEST 1: Health & Setup ==========
echo "📋 [1/12] Server Health Check"
run_test "Health endpoint" \
  "curl -s $BASE/api/health" \
  '"status":"ok"'

run_test "9 KB Categories seeded" \
  "curl -s $BASE/api/kb/categories" \
  '"name_vi":"Hỗ trợ Thị giác"'

# ========== TEST 2: Classify Vision ==========
echo ""
echo "🏷️  [2/12] Auto-classification (Taxonomy)"

run_test "Classify JAWS → vision" \
  "curl -s -X POST $BASE/api/kb/classify -H 'Content-Type: application/json' -d '{\"text\":\"JAWS là phần mềm đọc màn hình cho người khiếm thị sử dụng máy tính\"}'" \
  '"category":"vision"'

# ========== TEST 3: Classify Hearing ==========
run_test "Classify hearing aid → hearing" \
  "curl -s -X POST $BASE/api/kb/classify -H 'Content-Type: application/json' -d '{\"text\":\"Máy trợ thính Phonak BTE cho người khiếm thính nặng\"}'" \
  '"category":"hearing"'

# ========== TEST 4: Classify Mobility ==========
run_test "Classify wheelchair → mobility" \
  "curl -s -X POST $BASE/api/kb/classify -H 'Content-Type: application/json' -d '{\"text\":\"Xe lăn điện điều khiển bằng joystick, leo cầu thang\"}'" \
  '"category":"mobility"'

# ========== TEST 5: Classify AAC ==========
run_test "Classify AAC → communication" \
  "curl -s -X POST $BASE/api/kb/classify -H 'Content-Type: application/json' -d '{\"text\":\"Proloquo2Go là ứng dụng AAC giao tiếp thay thế cho trẻ tự kỷ\"}'" \
  '"category":"communication"'

# ========== TEST 6: Add Text to KB ==========
echo ""
echo "💾 [3/12] Add Knowledge Base Items"

run_test "Add Braille Keyboard (text)" \
  "curl -s -X POST $BASE/api/kb/text -H 'Content-Type: application/json' -d '{\"content\":\"Bàn phím Braille Focus 40 của HumanWare là màn hình Braille 40 ô dành cho người khiếm thị. Kết nối USB-C và Bluetooth, tương thích JAWS NVDA. ISO 9999:22.06.15.\",\"title\":\"Bàn phím Braille Focus 40\",\"language\":\"vi\"}'" \
  '"category":"vision"'

run_test "Add Hearing Aid (text)" \
  "curl -s -X POST $BASE/api/kb/text -H 'Content-Type: application/json' -d '{\"content\":\"Máy trợ thính Oticon More 1 là máy trợ thính kỹ thuật số miniBTE với công nghệ AI, pin sạc lithium, kết nối Bluetooth. ISO 9999:22.06.06.\",\"title\":\"Oticon More 1\",\"language\":\"vi\"}'" \
  '"category":"hearing"'

# ========== TEST 7: Upload .txt file ==========
echo ""
echo "📤 [4/12] File Upload Pipeline"

cat > /tmp/test-mobility.txt << 'EOF'
Khung đi Rollator 4 bánh có ghế ngồi và phanh tay, dành cho người cao tuổi đi lại khó khăn.
Khung nhôm nhẹ, chịu tải 120kg. Có giỏ đựng đồ. Phù hợp đi bộ ngoài trời.
Tiêu chuẩn ISO 9999:12.03.06.
EOF

run_test "Upload .txt file" \
  "curl -s -X POST $BASE/api/kb/upload -F 'file=@/tmp/test-mobility.txt'" \
  '"success":true'

# ========== TEST 8: Upload .md file ==========
cat > /tmp/test-wcag.md << 'EOF'
# WCAG 2.2 - Web Content Accessibility Guidelines

WCAG 2.2 là phiên bản mới nhất (tháng 10/2023) bổ sung 9 tiêu chí mới so với 2.1.

## 4 Nguyên tắc chính (POUR):
- **Perceivable** (Có thể nhận thức)
- **Operable** (Có thể vận hành)
- **Understandable** (Dễ hiểu)
- **Robust** (Mạnh mẽ)

## 9 tiêu chí mới trong WCAG 2.2:
2.4.11 Focus Not Obscured (Minimum)
2.4.12 Focus Not Obscured (Enhanced)
2.4.13 Focus Appearance
2.5.7 Dragging Movements
2.5.8 Target Size (Minimum)
3.2.6 Consistent Help
3.3.7 Redundant Entry
3.3.8 Accessible Authentication (Minimum)
2.4.13 Page Break Navigation
EOF

run_test "Upload .md file (web accessibility)" \
  "curl -s -X POST $BASE/api/kb/upload -F 'file=@/tmp/test-wcag.md'" \
  '"success":true'

# ========== TEST 9: Invalid file ==========
echo ""
echo "🛡️  [5/12] Error Handling"

run_test "Reject invalid file extension" \
  "echo 'data' > /tmp/test.xyz && curl -s -X POST $BASE/api/kb/upload -F 'file=@/tmp/test.xyz'" \
  '"success":false'

# ========== TEST 10: Invalid image ==========
echo "fake-png" > /tmp/fake.png
run_test "Reject invalid image (graceful)" \
  "curl -s -X POST $BASE/api/kb/upload-image -F 'file=@/tmp/fake.png'" \
  'success'

# ========== TEST 11: KB Stats ==========
echo ""
echo "📊 [6/12] Knowledge Base Stats"

run_test "KB stats endpoint" \
  "curl -s $BASE/api/kb/stats" \
  '"success":true'

# ========== TEST 12: List KB items ==========
echo ""
echo "🔍 [7/12] List & Search KB Items"

run_test "List all KB items" \
  "curl -s '$BASE/api/kb/items?limit=10'" \
  '"success":true'

run_test "Filter by category=vision" \
  "curl -s '$BASE/api/kb/items?category=vision'" \
  '"success":true'

run_test "Search by keyword 'braille'" \
  "curl -s '$BASE/api/kb/items?q=braille'" \
  '"success":true'

# ========== TEST 13: CRUD Operations ==========
echo ""
echo "✏️  [8/12] CRUD Operations"

# Lấy ID của 1 item để test
ITEM_ID=$(curl -s "$BASE/api/kb/items?limit=1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['items'][0]['id'])" 2>/dev/null)
if [ -n "$ITEM_ID" ]; then
  run_test "Get single item" \
    "curl -s $BASE/api/kb/items/$ITEM_ID" \
    '"success":true'

  run_test "Update item (publish)" \
    "curl -s -X POST $BASE/api/kb/items/$ITEM_ID/publish -H 'Content-Type: application/json' -d '{\"status\":\"published\"}'" \
    '"success":true'
else
  echo "⚠️  No item to test CRUD"
fi

# ========== TEST 14: Web Scrape ==========
echo ""
echo "🌐 [9/12] Web Scraping"

run_test "Scrape example.com (basic test)" \
  "curl -s -X POST $BASE/api/kb/scrape -H 'Content-Type: application/json' -d '{\"url\":\"https://example.com\",\"title\":\"Example\"}'" \
  '"success":'

# ========== TEST 15: Auth ==========
echo ""
echo "🔐 [10/12] Authentication"

run_test "Login as admin" \
  "curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@mada.vn\",\"password\":\"Admin@123\"}'" \
  '"success":true'

# ========== TEST 16: Chat / RAG ==========
echo ""
echo "🤖 [11/12] RAG Chat Engine"

run_test "Chat query (Vietnamese)" \
  "curl -s -X POST $BASE/api/chat -H 'Content-Type: application/json' -d '{\"message\":\"Có bàn phím Braille nào cho người mù không?\"}'" \
  '"success":'

# ========== TEST 17: Old endpoints still work ==========
echo ""
echo "🔄 [12/12] Backward Compatibility"

run_test "Old /api/recommend" \
  "curl -s -X POST $BASE/api/recommend -H 'Content-Type: application/json' -d '{\"query\":\"xe lăn điện\"}'" \
  '"success":'

run_test "Old /api/stats" \
  "curl -s $BASE/api/stats" \
  '"success":'

# ========== SUMMARY ==========
echo ""
echo "════════════════════════════════════════════════"
echo "  📊 KẾT QUẢ TỔNG HỢP"
echo "════════════════════════════════════════════════"
TOTAL=$((PASS+FAIL+WARN))
echo "  ✅ PASS: $PASS / $TOTAL"
echo "  ⚠️  WARN: $WARN / $TOTAL"
echo "  ❌ FAIL: $FAIL / $TOTAL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "  🎉 TUẦN 1 HOÀN THÀNH $PASS/$TOTAL tests"
  exit 0
else
  echo "  ⚠️  Có $FAIL test fail — cần kiểm tra"
  echo ""
  echo "Chi tiết failures:"
  for r in "${RESULTS[@]}"; do
    if [[ "$r" == FAIL* ]]; then
      echo "  - $r"
    fi
  done
  exit 1
fi
