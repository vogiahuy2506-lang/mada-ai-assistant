#!/bin/bash

# MADA AI Assistant - Auto Start (Parallel + Auto-Restart)
# Chạy: bash start-mada.sh

LOG_DIR="/tmp/mada-logs"
mkdir -p "$LOG_DIR"

echo "🚀 MADA AI Assistant - Starting (parallel mode)..."

cd "/Users/vohuy/Downloads/MADA AI ASSISTANT/mada-ai-assistant"

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5174 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    pkill -P $$ 2>/dev/null || true
    lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# Start backend in background
echo "⚡ Starting backend (port 3001)..."
nohup npm run server > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!

# Start frontend in background (parallel)
echo "🎨 Starting frontend (port 5173)..."
nohup npm run dev > "$LOG_DIR/vite.log" 2>&1 &
FRONTEND_PID=$!

echo "📋 PIDs: backend=$SERVER_PID  frontend=$FRONTEND_PID"
echo "📂 Logs:  $LOG_DIR/server.log  $LOG_DIR/vite.log"

# Wait for both services (max 30s)
echo "⏳ Waiting for services to come up..."
for i in {1..30}; do
    BACKEND_OK=false
    FRONTEND_OK=false
    curl -s http://localhost:3001/api/health > /dev/null 2>&1 && BACKEND_OK=true
    curl -s http://localhost:5173 > /dev/null 2>&1 && FRONTEND_OK=true

    if $BACKEND_OK && $FRONTEND_OK; then
        break
    fi
    sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Status:"

if $BACKEND_OK; then
    echo "   ✅ Backend  → http://localhost:3001"
    STATS=$(curl -s http://localhost:3001/api/knowledge/stats 2>/dev/null)
    DOCS=$(echo "$STATS" | grep -o '"totalDocuments":[0-9]*' | grep -o '[0-9]*' || echo "?")
    echo "      KB: $DOCS documents"
else
    echo "   ❌ Backend failed — check: tail -f $LOG_DIR/server.log"
fi

if $FRONTEND_OK; then
    echo "   ✅ Frontend → http://localhost:5173"
else
    echo "   ❌ Frontend failed — check: tail -f $LOG_DIR/vite.log"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 Admin login: admin@mada.vn / Admin@123"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Tail logs so user sees output
tail -f "$LOG_DIR/server.log" "$LOG_DIR/vite.log" &
TAIL_PID=$!

# Wait until killed
wait $SERVER_PID $FRONTEND_PID 2>/dev/null
kill $TAIL_PID 2>/dev/null
cleanup