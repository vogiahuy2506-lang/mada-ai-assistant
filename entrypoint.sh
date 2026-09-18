#!/bin/sh
# =====================================================
# MADA AI Assistant - Container Entrypoint
# =====================================================
# Chạy khi container khởi động:
#   1. Tạo thư mục data + uploads
#   2. Set ownership cho user nodejs
#   3. (Tuỳ chọn) Migrate dữ liệu vào Pinecone
#   4. Khởi động server
# =====================================================
set -e

echo "🚀 MADA AI Assistant - Starting..."
echo "📦 Node: $(node --version)"
echo "🗄️  Database path: ${DATABASE_PATH:-/app/data/mada.db}"

# ---- Step 1: Chuẩn bị thư mục ----
# Container chạy với user nodejs (UID 1001) không thể tạo dir ở /
# Phải đảm bảo data dir đã tồn tại (volume mount) và writable
mkdir -p /app/data /app/uploads 2>/dev/null || {
  echo "⚠️  Cannot create dirs (running as non-root) - assuming volume already mounted"
}

# ---- Step 2: Validate env quan trọng ----
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "test" ]; then
  echo "⚠️  GEMINI_API_KEY is empty/test - AI features will not work"
fi

if [ -z "$PINECONE_API_KEY" ] || [ "$PINECONE_API_KEY" = "test" ]; then
  echo "ℹ️  PINECONE_API_KEY is empty/test - using fallback vector store"
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change-me-in-production" ] || [ "$JWT_SECRET" = "test-secret" ]; then
  echo "⚠️  JWT_SECRET is empty or default - please set a strong secret in production!"
fi

# ---- Step 3: Check DB writable ----
if [ -d /app/data ]; then
  if touch /app/data/.write_test 2>/dev/null; then
    rm -f /app/data/.write_test
    echo "✅ Data directory writable"
  else
    echo "⚠️  Cannot write to /app/data - check volume permissions"
  fi
fi

# ---- Step 4: Cleanup seed data from suggested_questions ----
# Database can be at /app/data/mada.db (volume) or /app/mada-ai-assistant/data/mada.db
for DB_PATH in /app/data/mada.db /app/mada-ai-assistant/data/mada.db; do
  if [ -f "$DB_PATH" ]; then
    echo "🧹 Checking $DB_PATH for seed questions..."
    SEED_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM suggested_questions WHERE id LIKE 'sq_%';" 2>/dev/null || echo "0")
    if [ "$SEED_COUNT" != "0" ] && [ -n "$SEED_COUNT" ]; then
      sqlite3 "$DB_PATH" "DELETE FROM suggested_questions WHERE id LIKE 'sq_%';"
      echo "🗑️  Deleted $SEED_COUNT seed questions from $DB_PATH"
    else
      echo "✅ No seed questions found in $DB_PATH"
    fi
    break
  fi
done

# ---- Step 5: Optional - Migrate to Pinecone nếu flag được bật ----
if [ "${RUN_PINEONE_MIGRATE:-false}" = "true" ]; then
  echo "🔄 Running Pinecone migration..."
  npm run pinecone:migrate || echo "⚠️  Migration failed - continuing"
fi

# ---- Step 5: Khởi động server ----
echo "✅ Starting server..."
exec "$@"