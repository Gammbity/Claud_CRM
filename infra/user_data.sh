#!/bin/bash
# BTEC D.P8 — EC2 Instance Bootstrap Script
# Runs on each new instance launched by the Auto Scaling Group
# Installs Docker, pulls images, starts CRM stack

set -e
LOG=/var/log/crm-bootstrap.log
exec > >(tee -a $LOG) 2>&1

echo "=== CRM Cloud Bootstrap Started: $(date) ==="

# Update system
apt-get update -y
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Install CloudWatch agent for monitoring (BTEC D.M4)
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb || true

# Create app directory
mkdir -p /opt/crm-cloud
cd /opt/crm-cloud

# Write environment file from Terraform template variables
cat > .env << 'EOF'
DATABASE_URL=postgresql://crmuser:${db_password}@${db_host}:5432/crmdb
JWT_SECRET=${jwt_secret}
JWT_EXPIRES=7d
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=*
EOF

# Write docker-compose for production (using pre-built images)
cat > docker-compose.prod.yml << 'EOF'
version: '3.9'

networks:
  crm-network:
    driver: bridge

services:
  backend:
    image: ${docker_image_backend}
    restart: unless-stopped
    env_file: .env
    networks:
      - crm-network
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ${docker_image_frontend}
    restart: unless-stopped
    networks:
      - crm-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    networks:
      - crm-network
    depends_on:
      - backend
      - frontend
EOF

# Pull and start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

echo "=== Bootstrap Complete: $(date) ==="
echo "=== Application running at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4) ==="
