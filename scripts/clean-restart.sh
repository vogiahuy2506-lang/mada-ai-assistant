#!/bin/bash

# MADA AI - Clean Restart Script
# Usage: ./scripts/clean-restart.sh

echo "🧹 MADA AI - Dọn dẹp và Restart sạch"
echo "========================================"

cd "$(dirname "$0")/.." || exit 1

# 1. Kill all Vite processes
echo "📦 Đang dừng các process Vite cũ..."
pkill -f "vite" 2>/dev/null || true
pkill -f "esbuild" 2>/dev/null || true

# 2. Wait for processes to die
sleep 2

# 3. Clear all caches
echo "🗑️  Đang xóa cache..."
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf .vite 2>/dev/null || true
rm -rf dist 2>/dev/null || true

# 4. Verify cache cleared
if [ -d "node_modules/.vite" ]; then
    echo "⚠️  Warning: Cache folder still exists"
else
    echo "✅ Cache đã xóa sạch"
fi

# 5. Find available port
echo "🔍 Tìm port trống..."
for PORT in 5173 5174 5175 5176 5177; do
    if ! lsof -i :$PORT >/dev/null 2>&1; then
        AVAILABLE_PORT=$PORT
        break
    fi
done

# 6. Start dev server
echo "🚀 Đang khởi động dev server trên port $AVAILABLE_PORT..."
npm run dev &
DEV_PID=$!

sleep 3

# 7. Verify server started
if curl -s http://localhost:$AVAILABLE_PORT >/dev/null 2>&1; then
    echo ""
    echo "✅ Dev server đã chạy!"
    echo "🌐 Mở trình duyệt: http://localhost:$AVAILABLE_PORT"
    echo ""
    echo "📝 Nếu có lỗi React, hãy:"
    echo "   1. Hard refresh trình duyệt: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)"
    echo "   2. Hoặc mở DevTools → Application → Storage → Clear site data"
else
    echo "❌ Dev server chưa start được. Kiểm tra log..."
fi
