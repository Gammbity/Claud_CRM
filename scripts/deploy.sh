#!/bin/bash
# BTEC D.P8 — Manual Deployment Script
# Deploy updated images to EC2 with zero downtime
# Usage: ./scripts/deploy.sh [IMAGE_TAG]

set -e

EC2_HOST="${EC2_HOST:?Set EC2_HOST environment variable}"
EC2_USER="${EC2_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-~/.ssh/crm-keypair.pem}"
IMAGE_TAG="${1:-latest}"

echo "🚀 Deploying CRM Cloud — Tag: $IMAGE_TAG"
echo "   Host: $EC2_HOST"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << REMOTE
set -e
cd /opt/crm-cloud

# Pull new images
IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.prod.yml pull

# Rolling restart: backend first
docker compose -f docker-compose.prod.yml up -d --no-deps backend
sleep 15

# Verify health
curl -sf http://localhost/api/health | python3 -m json.tool

# Update frontend
docker compose -f docker-compose.prod.yml up -d --no-deps frontend

# Reload nginx config without downtime
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Cleanup
docker image prune -f

echo "✅ Deployment complete at \$(date)"
REMOTE

echo "✅ Deploy finished. App running at http://$EC2_HOST"
