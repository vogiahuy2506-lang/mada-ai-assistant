# ===== DEBUG - chạy từng lệnh =====

cd /home/hotro_digibook/mada-ai-assistant

# 1. Xem logs server
pm2 logs mada-ai --lines 80 --nostream

# 2. Kiểm tra port 3001 có listen không
pm2 delete all
sleep 2
netstat -tlnp 2>/dev/null | grep -E ':3001|:8080|:80' || ss -tlnp 2>/dev/null | grep -E ':3001|:8080|:80'

# 3. Xem package.json scripts để biết "npm run server" làm gì
cat package.json | grep -A 20 '"scripts"'

# 4. Chạy server foreground để xem lỗi trực tiếp (Ctrl+C để thoát)
NODE_ENV=production PORT=3001 npm run server