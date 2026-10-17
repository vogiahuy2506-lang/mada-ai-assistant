#!/bin/bash
# ===========================================
# MADA AI - Production Fix Script
# ===========================================

set -e

echo "🚀 Starting MADA AI Production Fix..."

# Step 1: Kill ALL node processes to free ports
echo "📛 Step 1: Killing all node processes..."
sudo pkill -9 -f "node.*server" 2>/dev/null || true
sudo pkill -9 -f "npm" 2>/dev/null || true
sleep 2

# Step 2: Verify ports are free
echo "🔍 Step 2: Verifying ports are free..."
for port in 3001 3002 3003 3004 3005 3006 3007 3008; do
  if ss -tlnp 2>/dev/null | grep -q ":$port "; then
    echo "⚠️  Port $port is still in use, killing..."
    sudo fuser -k $port/tcp 2>/dev/null || true
  else
    echo "✅ Port $port is free"
  fi
done
sleep 2

# Step 3: Navigate to project directory
echo "📁 Step 3: Navigating to project directory..."
cd ~/mada-ai-assistant

# Step 4: Pull latest code
echo "📥 Step 4: Pulling latest code from Git..."
git pull origin main

# Step 5: Ensure .env file exists with correct PORT
echo "📝 Step 5: Checking .env file..."
if [ ! -f .env ]; then
  echo "⚠️  .env file not found! Creating from template..."
  cat > .env << 'EOF'
# ===========================================
# MADA AI - Production Environment Variables
# ===========================================

# SERVER CONFIG
PORT=3001
NODE_ENV=production

# FRONTEND CONFIG  
VITE_API_URL=https://mada.digiso.vn

# API KEYS - Replace with your actual keys
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# JWT SECRET - Use a secure random string in production
JWT_SECRET=mada-production-jwt-secret-2024-change-this

# MAIL CONFIG - Replace with your actual credentials
MAIL_HOST=mail.digiso.vn
MAIL_PORT=465
MAIL_USERNAME=mada.noreply@digiso.vn
MAIL_PASSWORD=YOUR_MAIL_PASSWORD_HERE
MAIL_FROM=mada.noreply@digiso.vn
MAIL_SECURE=true
EOF
  echo "⚠️  Please edit .env and add your API keys and secrets!"
fi

# Update PORT to 3001 for nginx compatibility
grep -q "^PORT=" .env || echo "PORT=3001" >> .env

# Step 6: Rebuild server
echo "🔨 Step 6: Building server..."
npm run build:server

# Step 7: Clear PM2 and restart
echo "🔄 Step 7: Restarting PM2..."
pm2 delete all 2>/dev/null || true
pm2 start dist/server.mjs --name mada-ai
pm2 save

# Step 8: Wait for server to start
echo "⏳ Step 8: Waiting for server to start..."
sleep 5

# Step 9: Check server status
echo "📊 Step 9: Checking server status..."
pm2 logs mada-ai --lines 20 --nostream

# Step 10: Test API
echo "🧪 Step 10: Testing APIs..."
echo "Health check:"
curl -s http://localhost:3001/api/health | head -c 200
echo ""
echo ""
echo "Products by bot:"
for bot in hearing vision speech cognitive neuro mobility regulatory; do
  count=$(curl -s "http://localhost:3001/api/public/products/by-agent/bot-$bot" 2>/dev/null | grep -o '"total":[0-9]*' | head -1 || echo '"total":0')
  echo "  bot-$bot: $count"
done

echo ""
echo "✅ Fix script completed!"
echo ""
echo "📋 Summary of PM2 processes:"
pm2 list
