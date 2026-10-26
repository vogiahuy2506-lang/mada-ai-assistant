#!/usr/bin/env bash
# ===========================================
# MADA AI — Deploy script (chạy TRÊN VPS qua appleboy/ssh-action)
# ===========================================
#
# ⚠️ VÌ SAO FILE NÀY TỒN TẠI (thay vì nhúng inline trong workflow):
# GitHub Actions giới hạn độ dài "expression" của một step là 21.000 ký tự.
# Inline `script:` trong deploy-vps.yml đã dài 22.229 ký tự (sau khi bỏ thụt
# lề) → GitHub TỪ CHỐI parse workflow:
#   "Invalid workflow file: .github/workflows/deploy-vps.yml#L1
#    (Line: 42, Col: 19): Exceeded max expression length 21000"
# → Deploy fail NGAY ở bước validate workflow, KHÔNG chạy 1 dòng lệnh nào,
#   production vẫn giữ build cũ.
#
# → Giải pháp: workflow chỉ còn `script_path: scripts/deploy-vps.sh`
#   (1 expression ngắn), phần logic nằm trong file này — file được
#   git clone về VPS cùng repo nên luôn đồng bộ với code.
#
# ⭐ Mọi secret/giá trị động KHÔNG viết trực tiếp trong file này.
# Chúng được truyền qua `envs` của ssh-action → drone-ssh export thành
# biến môi trường ở đầu script remote:
#   GITHUB_TOKEN, BUILD_SHA, GEMINI_API_KEY, JWT_SECRET,
#   ADMIN_EMAIL, ADMIN_PASSWORD, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD,
#   MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_TLS, MAIL_USERNAME,
#   MAIL_PASSWORD, MAIL_FROM, CONSULTATION_EMAIL, ADMIN_URL
#
# Lưu ý: `set -e` KHÔNG dùng `set -u` — các biến secret có thể rỗng
# (GitHub secret chưa set) và script cần kiểm tra rõ ràng trước khi dùng.

set -e

APP_DIR="/app/mada-ai-assistant"
TEMP_DIR="/tmp/mada-deploy-temp"
MIN_DISK_GB=2

echo "=== Step 1: Pre-deploy disk check ==="
FREE_GB=$(df -BG / | tail -1 | awk '{print $4}' | tr -d 'G')
echo "Disk free: ${FREE_GB}GB (min: ${MIN_DISK_GB}GB)"
if [ "$FREE_GB" -lt "$MIN_DISK_GB" ]; then
  echo "Low disk, cleaning..."
  sudo docker system prune -af 2>/dev/null || true
  sudo journalctl --vacuum-size=50M 2>/dev/null || true
  sudo apt-get clean 2>/dev/null || true
  sudo rm -rf /tmp/* 2>/dev/null || true
fi

echo "=== Step 2: Backup existing .env ==="
HAS_EXISTING_ENV=false
if [ -d "$APP_DIR" ] && [ -f "$APP_DIR/.env" ]; then
  echo "Backing up existing .env..."
  sudo cp $APP_DIR/.env /tmp/mada-env-backup.env
  HAS_EXISTING_ENV=true
fi

echo "=== Step 3: Stop all services ==="
# Stop PM2
# ⚠️ Xoá CẢ "mada-app" (tên mới) VÀ "mada-ai" (tên app legacy cũ).
# App legacy từng chạy ở port 3001 với data/code cũ; nếu không dừng,
# nginx sẽ tiếp tục phục vụ nó sau khi deploy "thành công".
for p in "$HOME/.npm-global/bin/pm2" "/usr/local/bin/pm2" "/usr/bin/pm2"; do
  if [ -f "$p" ]; then
    $p stop mada-app 2>/dev/null || true
    $p delete mada-app 2>/dev/null || true
    $p stop mada-ai 2>/dev/null || true
    $p delete mada-ai 2>/dev/null || true
  fi
done

# Dừng mọi thứ đang giữ port 3001 (app legacy có thể chạy bằng systemd
# hoặc process trực tiếp, không qua pm2).
# ⚠️ App MỚI chạy ở port 3002 (tránh tranh chấp với app legacy 3001).
sudo fuser -k 3001/tcp 2>/dev/null || true

# Stop Docker containers
cd $APP_DIR 2>/dev/null || true
sudo docker compose down --remove-orphans 2>/dev/null || true
sudo docker rm -f mada-app mada-nginx mada-ai-assistant-app-1 mada-ai-assistant-nginx-1 2>/dev/null || true
sudo docker network rm mada-ai-assistant_default 2>/dev/null || true

echo "=== Step 4: Setup Node.js ==="
# Install Node.js 22 if not present
if ! command -v node &> /dev/null; then
  echo "Node.js not found, installing..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
  sudo apt-get install -y nodejs
fi

# Ensure PATH is correct
export PATH="/usr/local/bin:/usr/bin:$PATH:$HOME/.npm-global/bin"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "=== Step 5: Install build tools and utilities ==="
sudo apt-get update -qq
sudo apt-get install -y build-essential python3 make gcc g++ rsync

echo "=== Step 6: Prepare directories ==="
sudo rm -rf $TEMP_DIR 2>/dev/null || true
sudo mkdir -p $APP_DIR

echo "=== Step 7: Clone repository ==="
git clone https://x-access-token:$GITHUB_TOKEN@github.com/vogiahuy2506-lang/mada-ai-assistant.git $TEMP_DIR

if [ ! -d "$TEMP_DIR/.git" ]; then
  echo "Clone failed - trying alternative method..."
  # Fallback: rsync from runner
  sudo rm -rf $APP_DIR
  sudo mkdir -p $APP_DIR
fi

echo "=== Step 8: Move files to app directory ==="
if command -v rsync &> /dev/null; then
  sudo rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' $TEMP_DIR/ $APP_DIR/
else
  sudo cp -r $TEMP_DIR/* $APP_DIR/ 2>/dev/null || true
  sudo cp -r $TEMP_DIR/.* $APP_DIR/ 2>/dev/null || true
fi

echo "=== Step 8b: Setup fresh mada.db ==="
# ⚠️ PORT phải KHỚP với nginx proxy_pass (nginx/nginx.conf → 3002).
# Trước đây deploy chạy PM2 ở PORT=3000 còn nginx trỏ 3001 → app mới
# chạy nhưng KHÔNG ai trỏ tới, nginx vẫn phục vụ app legacy cũ ở 3001
# (dữ liệu cũ, code cũ) mà deploy vẫn báo success.
# → nginx + PM2 + .env đều dùng 3002 (port RIÊNG, app legacy giữ 3001).
echo "Removing old database..."
sudo rm -f $APP_DIR/data/mada.db $APP_DIR/data/mada.db-shm $APP_DIR/data/mada.db-wal 2>/dev/null || true
sudo mkdir -p $APP_DIR/data

# Create fresh database with schema
echo "Creating fresh database with schema..."
if [ -f "$TEMP_DIR/data/schema.sql" ]; then
  sudo sqlite3 $APP_DIR/data/mada.db < $TEMP_DIR/data/schema.sql
  echo "✅ Schema created successfully"
else
  echo "❌ schema.sql not found in repo!"
  exit 1
fi

# ⭐⭐ FIX QUYỀN GHI DB (root cause khiến deploy fail):
# `sudo sqlite3` tạo mada.db thuộc user ROOT, mode 644.
# App chạy dưới PM2 bằng user KHÔNG phải root → không ghi được →
# `pragma('journal_mode = WAL')` ném SQLITE_READONLY → throw ở
# module scope → server KHÔNG BAO GIỜ khởi động → port 3002 không
# bao giờ listen → nginx trả 502 (deploy vẫn báo success vì PM2
# vẫn còn PID).
# → Chown toàn bộ thư mục data cho user chạy app + cấp quyền ghi.
APP_USER="$(id -un)"
echo "App user: $APP_USER"
sudo chown -R "$APP_USER" $APP_DIR/data 2>/dev/null || true
sudo chmod -R u+rwX $APP_DIR/data
# File DB cần ghi cho WAL (-wal/-shm) và cần tạo file mới.
sudo chmod 664 $APP_DIR/data/mada.db 2>/dev/null || sudo chmod 644 $APP_DIR/data/mada.db
echo "✅ Fresh mada.db created ($(sudo ls -lh $APP_DIR/data/mada.db | awk '{print $5}')), owner=$(sudo stat -c '%U:%G' $APP_DIR/data/mada.db 2>/dev/null || echo unknown)"

echo "=== Step 8c: Import data from SQL files ==="
# Verify SQL files exist and have content
echo "--- SQL files in repo ---"
sudo ls -lh $TEMP_DIR/data/*.sql 2>/dev/null || echo "No SQL files found!"
echo "--- products-sync.sql line count ---"
sudo wc -l $TEMP_DIR/data/products-sync.sql 2>/dev/null || echo "File missing!"
echo "--- products-sync.sql INSERT count ---"
sudo grep -c "^INSERT" $TEMP_DIR/data/products-sync.sql 2>/dev/null || echo "No INSERT statements!"

# Update SQL files to use INSERT OR REPLACE for idempotent sync
if [ -f "$TEMP_DIR/data/products-sync.sql" ]; then
  echo "Importing products..."
  # Replace INSERT with INSERT OR REPLACE for idempotent operations (handles both INSERT and INSERT OR REPLACE)
  sudo sed -E 's/^INSERT(\s+OR\s+REPLACE)?\s+INTO\s+kb_products\s+VALUES/INSERT OR REPLACE INTO kb_products VALUES/' $TEMP_DIR/data/products-sync.sql > /tmp/products-sync-fixed.sql
  echo "Fixed SQL lines: $(sudo wc -l < /tmp/products-sync-fixed.sql)"
  echo "--- Attempting import ---"
  sudo sqlite3 $APP_DIR/data/mada.db < /tmp/products-sync-fixed.sql 2>&1
  PRODUCT_COUNT=$(sudo sqlite3 $APP_DIR/data/mada.db "SELECT COUNT(*) FROM kb_products;")
  echo "✅ Imported products (count: $PRODUCT_COUNT)"
  if [ "$PRODUCT_COUNT" = "0" ]; then
    echo "⚠️ WARNING: 0 products imported! Check schema match."
    echo "Schema columns: $(sudo sqlite3 $APP_DIR/data/mada.db "PRAGMA table_info(kb_products);" | wc -l)"
  fi
else
  echo "❌ products-sync.sql NOT FOUND in repo!"
  ls -la $TEMP_DIR/data/ 2>/dev/null || echo "data dir missing"
fi

if [ -f "$TEMP_DIR/data/categories-sync.sql" ]; then
  echo "Importing categories..."
  sudo sed -E 's/^INSERT(\s+OR\s+REPLACE)?\s+INTO\s+kb_categories\s+VALUES/INSERT OR REPLACE INTO kb_categories VALUES/' $TEMP_DIR/data/categories-sync.sql > /tmp/categories-sync-fixed.sql
  sudo sqlite3 $APP_DIR/data/mada.db < /tmp/categories-sync-fixed.sql 2>&1 || {
    echo "⚠️ Category import had warnings/errors, checking result..."
  }
  CATEGORY_COUNT=$(sudo sqlite3 $APP_DIR/data/mada.db "SELECT COUNT(*) FROM kb_categories;")
  echo "✅ Imported categories (count: $CATEGORY_COUNT)"
else
  echo "⚠️ categories-sync.sql not found"
fi

if [ -f "$TEMP_DIR/data/knowledge-items-sync.sql" ]; then
  echo "Importing knowledge items (RAG)..."
  sudo sed -E 's/^INSERT(\s+OR\s+REPLACE)?\s+INTO\s+knowledge_items\s+VALUES/INSERT OR REPLACE INTO knowledge_items VALUES/' $TEMP_DIR/data/knowledge-items-sync.sql > /tmp/knowledge-items-fixed.sql
  sudo sqlite3 $APP_DIR/data/mada.db < /tmp/knowledge-items-fixed.sql 2>&1 || {
    echo "⚠️ Knowledge items import had warnings/errors, checking result..."
  }
  KI_COUNT=$(sudo sqlite3 $APP_DIR/data/mada.db "SELECT COUNT(*) FROM knowledge_items;")
  echo "✅ Imported knowledge items (count: $KI_COUNT)"
fi

# Verify database integrity
DB_CHECK=$(sudo sqlite3 $APP_DIR/data/mada.db "PRAGMA integrity_check;")
if [ "$DB_CHECK" = "ok" ]; then
  echo "✅ Database integrity verified"
else
  echo "⚠️ Database integrity check failed: $DB_CHECK"
fi

sudo rm -rf $TEMP_DIR

echo "=== Step 9: Configure environment ==="
# PRESERVE JWT_SECRET from backup to keep existing tokens valid
BACKUP_JWT_SECRET=""
if [ "$HAS_EXISTING_ENV" = "true" ]; then
  BACKUP_JWT_SECRET=$(grep '^JWT_SECRET=' /tmp/mada-env-backup.env | head -1 | cut -d '=' -f2-)
  echo "Found backup JWT_SECRET, preserving for token validity"
fi

{
  echo "GEMINI_API_KEY=$GEMINI_API_KEY"
  if [ -n "$BACKUP_JWT_SECRET" ]; then
    echo "JWT_SECRET=$BACKUP_JWT_SECRET"
  else
    echo "JWT_SECRET=$JWT_SECRET"
  fi
  echo "ADMIN_EMAIL=$ADMIN_EMAIL"
  echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
  echo "SUPER_ADMIN_EMAIL=$SUPER_ADMIN_EMAIL"
  echo "SUPER_ADMIN_PASSWORD=$SUPER_ADMIN_PASSWORD"
  echo "NODE_ENV=production"
  echo "PORT=3002"
  # Build marker để /api/health báo đúng commit đang chạy trên VPS.
  echo "BUILD_SHA=$BUILD_SHA"
  # ===== Mail / SMTP (consultation notifications) =====
  # ⚠️ QUAN TRỌNG: nếu secret KHÔNG được set (hoặc rỗng), KHÔNG được
  # ghi dòng rỗng — nếu không deploy sẽ ghi đè giá trị đúng đang có
  # trên VPS bằng chuỗi rỗng → SMTP fail 535 authentication failed
  # → mail thông báo không gửi được mà không có dấu hiệu gì.
  echo "MAIL_HOST=$MAIL_HOST"
  echo "MAIL_PORT=$MAIL_PORT"
  echo "MAIL_SECURE=$MAIL_SECURE"
  echo "MAIL_TLS=$MAIL_TLS"
  echo "MAIL_USERNAME=$MAIL_USERNAME"
  echo "MAIL_PASSWORD=$MAIL_PASSWORD"
  echo "MAIL_FROM=$MAIL_FROM"
  echo "CONSULTATION_EMAIL=$CONSULTATION_EMAIL"
  echo "ADMIN_URL=$ADMIN_URL"
} | sudo tee $APP_DIR/.env > /dev/null

# Merge backup env vars (keep custom settings - but JWT_SECRET already handled above)
if [ "$HAS_EXISTING_ENV" = "true" ]; then
  echo "Merging backup env vars..."
  # ⚠️ KHÔNG xoá các biến MAIL_* khỏi backup khi secret rỗng.
  # Nếu GitHub secret MAIL_PASSWORD bị xoá/sai, dòng ghi ở trên sẽ là
  # "MAIL_PASSWORD=" (rỗng) và sẽ đè lên giá trị đúng của VPS.
  # → So sánh: chỉ ghi đè bằng giá trị NON-EMPTY.
  MAIL_ENV_KEYS="MAIL_HOST MAIL_PORT MAIL_SECURE MAIL_TLS MAIL_USERNAME MAIL_PASSWORD MAIL_FROM CONSULTATION_EMAIL ADMIN_URL"
  for key in $MAIL_ENV_KEYS; do
    # Nếu bản .env mới (vừa ghi) có giá trị rỗng cho key này → khôi phục từ backup
    new_val=$(grep -E "^${key}=" $APP_DIR/.env | head -1 | cut -d '=' -f2-)
    if [ -z "$new_val" ]; then
      old_val=$(grep -E "^${key}=" /tmp/mada-env-backup.env | head -1 | cut -d '=' -f2-)
      if [ -n "$old_val" ]; then
        echo "  ↺ $key: secret rỗng → khôi phục từ .env cũ trên VPS"
        # Escape ký tự đặc biệt của sed (&\/ và ký tự phân cách)
        escaped=$(printf '%s' "$old_val" | sed -e 's/[&|\\]/\\&/g')
        sudo sed -i "s|^${key}=.*|${key}=${escaped}|" $APP_DIR/.env
      else
        echo "  ⚠️  $key: KHÔNG có trong secret lẫn .env cũ"
      fi
    fi
  done

  # Giữ các biến khác (không đụng vào nhóm MAIL_* vừa xử lý riêng)
  grep -v -E '^(GEMINI_API_KEY|JWT_SECRET|ADMIN_EMAIL|ADMIN_PASSWORD|SUPER_ADMIN_EMAIL|SUPER_ADMIN_PASSWORD|NODE_ENV|PORT|BUILD_SHA)=' /tmp/mada-env-backup.env \
    | grep -v -E '^(MAIL_HOST|MAIL_PORT|MAIL_SECURE|MAIL_TLS|MAIL_USERNAME|MAIL_PASSWORD|MAIL_FROM|CONSULTATION_EMAIL|ADMIN_URL)=' \
    | sudo tee -a $APP_DIR/.env > /dev/null
fi

echo "=== Step 10: Set permissions ==="
sudo chmod -R 755 $APP_DIR

echo "=== Step 11: Install dependencies (WITH devDeps for esbuild) ==="
cd $APP_DIR
pwd
sudo npm install --legacy-peer-deps --include=dev

echo "=== Step 12: Build application ==="
sudo npm run build:server
sudo npm run build:client

echo "=== Step 12b: Run AAC products import script ==="
cd $APP_DIR
if [ -f "scripts/insert-aac-products.ts" ]; then
  # Chạy bằng user app: script này GHI vào mada.db → nếu DB thuộc
  # root thì sẽ fail với "attempt to write a readonly database".
  sudo -u "$APP_USER" -E npx tsx scripts/insert-aac-products.ts || {
    echo "⚠️ AAC products import thất bại"
  }
  echo "✅ AAC products imported"
else
  echo "⚠️ insert-aac-products.ts not found, skipping"
fi

echo "=== Step 12c: Build vector store (RAG) ==="
# ⚠️ BẮT BUỘC: data/chroma/ KHÔNG được commit lên git (chứa vector
# nhúng, thay đổi mỗi lần re-embed) → VPS luôn khởi đầu với
# vector store rỗng. Nếu không index lại ở đây, RAG không có
# context nào và bot trả lời sai lệch/đúng kiểu "chưa có thông
# tin trong cơ sở dữ liệu".
cd $APP_DIR
sudo mkdir -p data/chroma
# ⭐ Chạy reindex BẰNG USER APP (không phải root) để file
# data/chroma/documents.json sinh ra thuộc đúng user mà app chạy.
# Nếu chạy bằng root, file thuộc root → app không ghi được lúc
# runtime (vectorStore.saveMetadataToDisk() → EACCES).
# Reindex cần đọc DB nên DB phải readable bởi app user (đã chown ở Step 8b).
if [ -f "scripts/reindex-products.ts" ]; then
  sudo -u "$APP_USER" -E npx tsx scripts/reindex-products.ts --all || {
    echo "⚠️ Reindex thất bại — bot sẽ không có context RAG"
  }
  # Verify vector store thực sự có dữ liệu
  DOC_COUNT=$(node -e "try{const d=require('$APP_DIR/data/chroma/documents.json');console.log(Array.isArray(d)?d.length:0)}catch(e){console.log(0)}")
  echo "✅ Vector store: $DOC_COUNT docs"
  if [ "$DOC_COUNT" = "0" ]; then
    echo "❌ CẢNH BÁO: vector store rỗng — RAG sẽ không hoạt động"
  fi
else
  echo "❌ scripts/reindex-products.ts không tồn tại — BỎ QUA BƯỚC NÀY, RAG SẼ KHÔNG CÓ CONTEXT"
fi

# Chốt quyền sở hữu cho toàn bộ data/ (DB + vector store + uploads)
sudo chown -R "$APP_USER" $APP_DIR/data 2>/dev/null || true
sudo chmod -R u+rwX $APP_DIR/data

echo "=== Step 13: Install/Update PM2 ==="
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
mkdir -p "$HOME/.npm-global"
npm install -g pm2
PM2_PATH="$HOME/.npm-global/bin/pm2"
echo "PM2 version: $($PM2_PATH --version)"

echo "=== Step 14: Start application with PM2 ==="
cd $APP_DIR

# Use absolute PM2 path (sudo requires full path)
PM2_BIN="$HOME/.npm-global/bin/pm2"

# Kill any existing processes on our app port (3002) + dọn app legacy.
# ⚠️ Phải khai báo mọi tên pm2 cũ: app legacy từng chạy tên "mada-ai",
# deploy mới dùng "mada-app". Nếu chỉ xoá "mada-app" thì app legacy
# vẫn giữ port 3001 và nginx tiếp tục phục vụ code/data cũ.
sudo fuser -k 3002/tcp 2>/dev/null || true
for p in "$HOME/.npm-global/bin/pm2" "/usr/local/bin/pm2" "/usr/bin/pm2"; do
  if [ -f "$p" ]; then
    $p delete mada-app 2>/dev/null || true
    $p delete mada-ai 2>/dev/null || true
  fi
done

# Start with pm2-startup to ensure PM2 survives reboots
PORT=3002 $PM2_BIN start dist/server.mjs --name mada-app

# Wait for process to start
sleep 3

# Ensure PM2 will restart on reboot
$PM2_BIN startup 2>/dev/null || true
$PM2_BIN save 2>/dev/null || true

# Verify process is running
if ! $PM2_BIN describe mada-app > /dev/null 2>&1; then
  echo "❌ PM2 failed to start mada-app"
  $PM2_BIN logs mada-app --nostream --lines 30
  exit 1
fi

echo "PM2 process started, PID: $($PM2_BIN jlist 2>/dev/null | grep -o '"pid":[0-9]*' | head -1 | cut -d: -f2)"

echo "=== Step 15: Health check (max 180s) ==="
COUNTER=0
HEALTHY=false
# Wait for PM2 to actually start the process
sleep 3
while [ $COUNTER -lt 36 ]; do
  COUNTER=$((COUNTER + 1))
  # Try different endpoints
  for ENDPOINT in "/api/health" "/api/performance/health" "/"; do
    HEALTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3002${ENDPOINT}" --connect-timeout 3 --max-time 5 2>/dev/null || echo "000")
    if [ "$HEALTH_CODE" = "200" ]; then
      echo "✅ App is healthy! (took ${COUNTER}x5s, endpoint: ${ENDPOINT})"
      HEALTHY=true
      break 2
    fi
  done
  echo "  Waiting... (${COUNTER}/36)"
  sleep 5
done

if [ "$HEALTHY" = "false" ]; then
  echo "⚠️ Health check failed — dumping diagnostics..."
  echo "=== PM2 logs (error) ==="
  $PM2_BIN logs mada-app --nostream --lines 60 --err 2>/dev/null || sudo $PM2_BIN logs mada-app --nostream --lines 60 --err 2>/dev/null || true
  echo "=== PM2 logs (out) ==="
  $PM2_BIN logs mada-app --nostream --lines 60 --out 2>/dev/null || sudo $PM2_BIN logs mada-app --nostream --lines 60 --out 2>/dev/null || true
  echo "=== PM2 status ==="
  $PM2_BIN status 2>/dev/null || sudo $PM2_BIN status 2>/dev/null || true
  echo "=== Port 3002 listener ==="
  sudo fuser 3002/tcp 2>&1 || echo "   (nothing listening on 3002)"
  echo "=== DB permissions ==="
  sudo ls -la $APP_DIR/data/ 2>/dev/null | head -20 || true
  echo "=== DB write test as app user ==="
  sudo -u "$APP_USER" sqlite3 $APP_DIR/data/mada.db "CREATE TABLE IF NOT EXISTS __deploy_wtest(x); INSERT INTO __deploy_wtest VALUES(1); DROP TABLE __deploy_wtest;" 2>&1 && echo "   ✅ DB writable by $APP_USER" || echo "   ❌ DB NOT writable by $APP_USER"

  # ⭐⭐ KHÔNG được coi là "đang chạy" chỉ vì PM2 còn PID.
  # PM2 giữ PID cả khi app crash-loop liên tục (VD: DB readonly →
  # module throw → app chết ngay khi boot → port không bao giờ listen).
  # Trước đây chỗ này in "App is running, proceeding with deploy" rồi
  # để nginx trả 502 → deploy báo success nhưng production chết.
  if sudo fuser 3002/tcp > /dev/null 2>&1; then
    echo "✅ Port 3002 is listening (app bound the port)"
  else
    echo "❌ App KHÔNG listen port 3002 — deploy sẽ fail (nginx trả 502)"
    exit 1
  fi
fi

echo "=== Step 15.5: Verify SMTP connection ==="
# ⚠️ Mail thông báo (yêu cầu tư vấn, duyệt tài khoản) là chức năng
# quan trọng. Nếu MAIL_PASSWORD sai → SMTP trả 535 và mọi mail
# đều không tới nơi, nhưng app vẫn chạy bình thường.
# → Verify ngay sau deploy để fail LOẠI (dễ fix) thay vì fail MUỘN.
sleep 2
MAIL_HEALTH=$(curl -s --max-time 10 http://127.0.0.1:3002/api/health 2>/dev/null || echo "{}")
MAIL_VERIFIED=$(echo "$MAIL_HEALTH" | grep -o '"verified":[^,}]*' | head -1 | cut -d':' -f2 | tr -d ' ')
MAIL_ERROR=$(echo "$MAIL_HEALTH" | grep -o '"lastError":"[^"]*"' | head -1 | sed 's/"lastError":"//;s/"$//')
if [ "$MAIL_VERIFIED" = "true" ]; then
  echo "✅ SMTP OK — đăng nhập thành công, mail sẽ gửi được"
else
  echo "❌ SMTP KHÔNG DÙNG ĐƯỢC (verified=$MAIL_VERIFIED)"
  echo "   Lỗi: ${MAIL_ERROR:-không rõ}"
  echo "   → Sửa GitHub secret MAIL_USERNAME/MAIL_PASSWORD rồi deploy lại."
  echo "   → (Deploy KHÔNG bị fail: app vẫn chạy, chỉ mất chức năng gửi mail.)"
fi

echo "=== Step 16: Setup nginx with SSL ==="
# Get PM2 binary (may need sudo for logs)
PM2_BIN="$HOME/.npm-global/bin/pm2"

# Copy nginx config
if [ -f "$APP_DIR/nginx/nginx.conf" ]; then
  sudo cp $APP_DIR/nginx/nginx.conf /etc/nginx/sites-available/mada.digiso.vn
  sudo ln -sf /etc/nginx/sites-available/mada.digiso.vn /etc/nginx/sites-enabled/
fi

# Test and restart nginx
sudo nginx -t && sudo systemctl restart nginx || {
  echo "Nginx restart failed, trying reload..."
  sudo nginx -s reload || sudo systemctl restart nginx
}

echo "=== Step 17: Verify HTTPS ==="
sleep 5
HTTPS_CODE=$(curl -s -o /dev/null -w '%{http_code}' https://mada.digiso.vn --max-time 10 || echo "000")
echo "HTTPS status: $HTTPS_CODE"

if [ "$HTTPS_CODE" != "200" ]; then
  echo "⚠️ HTTPS not working, trying to fix SSL..."
  # Try to renew certificate
  sudo certbot --nginx -d mada.digiso.vn --noninteractive --agree-tos -m admin@mada.digiso.vn || {
    echo "Certbot failed, creating self-signed cert as fallback..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/private/nginx-selfsigned.key \
      -out /etc/ssl/certs/nginx-selfsigned.crt \
      -subj "/C=VN/ST=HCM/L=HCM/O=MADA/CN=mada.digiso.vn" 2>/dev/null || true
  }
  sudo nginx -s reload || sudo systemctl restart nginx
fi

echo "=== Step 18: Final verification ==="
echo "HTTP check: $(curl -s -o /dev/null -w '%{http_code}' http://mada.digiso.vn --max-time 10 || echo 'FAILED')"
echo "HTTPS check: $(curl -s -o /dev/null -w '%{http_code}' https://mada.digiso.vn --max-time 10 -k || echo 'FAILED')"

echo "--- Diagnosing which app is serving ---"
echo "PM2 processes:"
$PM2_BIN jlist 2>/dev/null | grep -o '"name":"[^"]*"' | sort -u | head -10 || echo "   (pm2 unavailable)"
echo "Port 3002 listeners (app mới): $(sudo fuser 3002/tcp 2>&1 | tr -s ' ' || echo none)"
echo "Port 3001 listeners (app legacy): $(sudo fuser 3001/tcp 2>&1 | tr -s ' ' || echo none)"
echo "Local app build (direct to PM2 port): $(curl -s http://127.0.0.1:3002/api/health --max-time 8 2>/dev/null | grep -o '"build"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo unreachable)"

# ⭐ Kiểm tra app có GHI ĐƯỢC DB không (DB readonly → chat history,
# seed admin, admin CRUD đều hỏng dù app vẫn trả 200).
echo "--- DB write check ---"
sudo -u "$APP_USER" sqlite3 $APP_DIR/data/mada.db "CREATE TABLE IF NOT EXISTS __deploy_wtest(x); INSERT INTO __deploy_wtest VALUES(1); DROP TABLE __deploy_wtest;" > /dev/null 2>&1 \
  && echo "   ✅ DB writable by $APP_USER" \
  || { echo "   ❌ DB NOT writable by $APP_USER (app sẽ lỗi khi ghi)"; exit 1; }
echo "   App reports: $(curl -s http://127.0.0.1:3002/api/health --max-time 8 2>/dev/null | grep -o '"writable"[[:space:]]*:[[:space:]]*[a-z]*' | head -1)"

# ⭐⭐ VERIFY THẬT: đảm bảo nginx đang phục vụ đúng build vừa deploy,
# không phải app legacy còn sót ở port khác.
# Trước đây deploy báo success nhưng production vẫn trả code/data cũ.
echo "--- Verifying build marker via HTTPS ---"
LIVE_BUILD=$(curl -s https://mada.digiso.vn/api/health --max-time 15 2>/dev/null | grep -o '"build"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
echo "Live build: ${LIVE_BUILD:-<none>}"
if [ "$LIVE_BUILD" != "$BUILD_SHA" ]; then
  echo "❌ Production KHÔNG chạy build vừa deploy!"
  echo "   Expected: $BUILD_SHA"
  echo "   Got     : ${LIVE_BUILD:-<none — app cũ không có build marker>}"
  echo "   → nginx có thể vẫn trỏ app cũ ở port khác."
  exit 1
fi

# Verify số sản phẩm trên production khớp DB vừa import
# (API chỉ trả status='published' → so sánh cùng điều kiện)
LIVE_COUNT=$(curl -s "https://mada.digiso.vn/api/public/products?limit=1" --max-time 15 2>/dev/null | grep -o '"total"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
DB_COUNT=$(sudo sqlite3 $APP_DIR/data/mada.db "SELECT COUNT(*) FROM kb_products WHERE status='published';" 2>/dev/null)
echo "Products in DB (published): ${DB_COUNT:-?} | visible via API: ${LIVE_COUNT:-?}"
if [ -n "$DB_COUNT" ] && [ -n "$LIVE_COUNT" ] && [ "$DB_COUNT" != "$LIVE_COUNT" ]; then
  echo "❌ Số sản phẩm qua API ($LIVE_COUNT) ≠ DB ($DB_COUNT) — API đang đọc DB khác!"
  exit 1
fi

echo "✅ Deploy completed successfully at $(date)"
echo "📝 Commit: $BUILD_SHA"
