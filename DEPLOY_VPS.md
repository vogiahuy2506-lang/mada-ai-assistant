# ===== VPS DEPLOY - chạy từng lệnh một =====

# Bước 1: Vào thư mục project
cd /home/hotro_digibook/mada-ai-assistant
pwd   # phải in ra: /home/hotro_digibook/mada-ai-assistant

# Bước 2: Xóa hết PM2 process cũ (đang có 1 fork lỗi + 1 server thật)
pm2 delete all
pm2 kill
sleep 2

# Bước 3: Pull code mới
git pull origin main

# Bước 4: Cài dependencies
npm ci --omit=dev

# Bước 5: Build frontend
npm run build

# Bước 6: Khởi động lại với ecosystem file (dùng file có sẵn để tránh lỗi spawn bash)
# Kiểm tra trước:
ls ecosystem.config.cjs 2>/dev/null || ls ecosystem.config.js 2>/dev/null || ls ecosystem.config.json 2>/dev/null

# Bước 7: Khởi động app - DÙNG ecosystem file nếu có, không thì dùng lệnh này:
pm2 start npm --name mada-ai -- run server
pm2 save
pm2 startup   # copy lệnh mà PM2 in ra, chạy nó với sudo

# Bước 8: Verify
sleep 3
pm2 status
pm2 logs mada-ai --lines 30 --nostream
curl -s -o /dev/null -w "Health: %{http_code}\n" http://localhost:3001/api/health

# ===== DONE =====
