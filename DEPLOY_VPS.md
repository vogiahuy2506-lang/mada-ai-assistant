# ===== FIX DEPLOY - chạy tuần tự =====

cd /home/hotro_digibook/mada-ai-assistant

# Bước 1: Reset về origin/main (mất uncommitted changes trên VPS)
git fetch origin
git reset --hard origin/main

# Verify:
git log --oneline -3
ls -la ecosystem.config.cjs   # phải tồn tại

# Bước 2: Cài dependencies BAO GỒM devDependencies (vì cần esbuild để build)
npm ci

# Bước 3: Build lại
npm run build

# Bước 4: Restart app
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save

# Bước 5: Verify
sleep 5
pm2 status
pm2 logs mada-ai --lines 30 --nostream
curl -s -o /dev/null -w "Health: %{http_code}\n" http://localhost:3001/api/health
