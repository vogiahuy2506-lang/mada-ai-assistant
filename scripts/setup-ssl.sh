#!/bin/bash
# SSL Setup Script - Run on VPS
set -e

DOMAIN="mada.digiso.vn"
EMAIL="admin@mada.vn"
APP_DIR="/app/mada-ai-assistant"

echo "=== SSL Setup for $DOMAIN ==="

# 1. Cài certbot
echo "[1/6] Installing certbot..."
apt update && apt install -y certbot python3-certbot-nginx

# 2. Tạo thư mục
echo "[2/6] Creating directories..."
mkdir -p /var/www/certbot
mkdir -p "$APP_DIR/nginx/certs"

# 3. Tạo file test ACME
echo "[3/6] Creating ACME test file..."
mkdir -p /var/www/certbot/.well-known/acme-challenge
echo "certbot-verification" > /var/www/certbot/.well-known/acme-challenge/test

# 4. Cấp SSL
echo "[4/6] Issuing SSL certificate..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --domain="$DOMAIN" \
    --email="$EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring

# 5. Copy certs
echo "[5/6] Copying certificates..."
cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$APP_DIR/nginx/certs/"
cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem "$APP_DIR/nginx/certs/"
chmod 644 "$APP_DIR/nginx/certs"/*.pem

# 6. Setup auto-renewal cron
echo "[6/6] Setting up auto-renewal cron..."
CRON_JOB="0 3 * * * /usr/bin/certbot renew --quiet --deploy-hook 'docker exec mada-nginx nginx -s reload' >> /var/log/certbot-renewal.log 2>&1"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -

# 7. Update nginx.conf
echo "Updating nginx.conf..."
cat > "$APP_DIR/nginx/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    upstream mada_backend {
        server app:3000;
        keepalive 32;
    }

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name DOMAIN_PLACEHOLDER;

        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        root /app/dist/client;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://mada_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /ws {
            proxy_pass http://mada_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /health {
            proxy_pass http://mada_backend/api/health;
            access_log off;
        }
    }
}
EOF

# Thay DOMAIN_PLACEHOLDER bằng domain thật
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$APP_DIR/nginx/nginx.conf"

# 8. Restart nginx
echo "Restarting nginx..."
docker exec mada-nginx nginx -t && docker exec mada-nginx nginx -s reload

echo ""
echo "=== DONE! ==="
echo "Website: https://$DOMAIN"
echo "Auto-renewal: Enabled (3 AM daily)"
