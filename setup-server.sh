#!/bin/bash
set -e

echo "=========================================================="
echo " Setting up Dual Domain Reverse Proxy for:                "
echo "  1) app.konwertindiamotors.com  -> Omni ERP (Port 8082)   "
echo "  2) one.konwertindiamotors.com  -> Orbx KIM  (Port 8081)   "
echo "=========================================================="

# 1. Locate directories
OMNI_DIR=""
ORBX_DIR=""

for d in ~/omnierp /root/omnierp /var/www/omnierp; do
  if [ -f "$d/docker-compose.yml" ]; then OMNI_DIR="$d"; break; fi
done

for d in ~/orbx-kim /root/orbx-kim ~/CRM-Finance /root/CRM-Finance; do
  if [ -f "$d/docker-compose.yml" ]; then ORBX_DIR="$d"; break; fi
done

if [ -z "$OMNI_DIR" ]; then
  OMNI_DIR=$(pwd)
fi

echo ">> Omni ERP directory: $OMNI_DIR"
if [ -n "$ORBX_DIR" ]; then
  echo ">> Orbx KIM directory: $ORBX_DIR"
fi

# 2. Update Omni ERP docker-compose.yml port to 8082
echo ">> Configuring Omni ERP to use internal port 8082..."
cd "$OMNI_DIR"
# Stop running containers if any
docker compose down || true

# Update frontend/web port in docker-compose.yml
python3 -c "
import re
with open('docker-compose.yml', 'r') as f:
    content = f.read()
# Replace frontend/web port mappings 80:80 and 443:443 with 127.0.0.1:8082:80
content = re.sub(r'-\s*\"?80:80\"?', '- \"127.0.0.1:8082:80\"', content)
content = re.sub(r'-\s*\"?443:443\"?', '', content)
with open('docker-compose.yml', 'w') as f:
    f.write(content)
"

# 3. Update Orbx KIM docker-compose.yml port to 8081
if [ -n "$ORBX_DIR" ]; then
  echo ">> Configuring Orbx KIM to use internal port 8081..."
  cd "$ORBX_DIR"
  docker compose down || true

  python3 -c "
import re
with open('docker-compose.yml', 'r') as f:
    content = f.read()
content = re.sub(r'-\s*\"\$\{WEB_PORT:-80\}:80\"', '- \"127.0.0.1:8081:80\"', content)
content = re.sub(r'-\s*\"\$\{SSL_PORT:-443\}:443\"', '', content)
content = re.sub(r'-\s*\"?80:80\"?', '- \"127.0.0.1:8081:80\"', content)
content = re.sub(r'-\s*\"?443:443\"?', '', content)
with open('docker-compose.yml', 'w') as f:
    f.write(content)
"
  echo ">> Starting Orbx KIM on port 8081..."
  docker compose up -d --remove-orphans
fi

# 4. Start Omni ERP on port 8082
echo ">> Starting Omni ERP on port 8082..."
cd "$OMNI_DIR"
docker compose up -d --remove-orphans

# 5. Install Host Nginx and Certbot
echo ">> Installing Nginx and Certbot on host..."
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# 6. Configure Nginx virtual hosts
echo ">> Creating Nginx configurations for subdomains..."

cat << 'EOF' > /etc/nginx/sites-available/app.konwertindiamotors.com
server {
    listen 80;
    server_name app.konwertindiamotors.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

cat << 'EOF' > /etc/nginx/sites-available/one.konwertindiamotors.com
server {
    listen 80;
    server_name one.konwertindiamotors.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable configurations
ln -sf /etc/nginx/sites-available/app.konwertindiamotors.com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/one.konwertindiamotors.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verify and reload Nginx
nginx -t
systemctl restart nginx

# 7. Issue SSL Certificates
echo ">> Issuing SSL certificates via Certbot..."
certbot --nginx -d app.konwertindiamotors.com -d one.konwertindiamotors.com --non-interactive --agree-tos -m admin@konwertindiamotors.com --redirect || {
    echo ">> Certbot warning: If DNS has not propagated yet, run: certbot --nginx -d app.konwertindiamotors.com -d one.konwertindiamotors.com"
}

echo "=========================================================="
echo " Setup Complete! Both applications are running:           "
echo "  👉 Omni ERP: https://app.konwertindiamotors.com         "
echo "  👉 Orbx KIM: https://one.konwertindiamotors.com         "
echo "=========================================================="
