#!/bin/bash
set -e

# Generate secure admin credentials if not set
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-$(openssl rand -base64 12)}
DATABASE_URL="${DATABASE_URL}"
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

echo "Deploying Miniflux to Render..."
echo "Admin Username: $ADMIN_USERNAME"
echo "Admin Password: $ADMIN_PASSWORD"

# Create the service via Render CLI
# Render free tier does not accept 'plan free' in all commands or it uses --plan free
# Wait, Render free tier web service plan is 'free'.
# We can use --plan free, but if it fails we can omit it or check the default.
render services create \
  --name miniflux-rss-app \
  --type web_service \
  --image miniflux/miniflux:latest \
  --plan free \
  --env-var DATABASE_URL="$DATABASE_URL" \
  --env-var RUN_MIGRATIONS="1" \
  --env-var CREATE_ADMIN="1" \
  --env-var ADMIN_USERNAME="$ADMIN_USERNAME" \
  --env-var ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  --env-var PORT="8080" \
  --output json > deploy_output.json

echo "Deployment submitted. Parsing output..."
SERVICE_URL=$(cat deploy_output.json | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
SERVICE_ID=$(cat deploy_output.json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "=========================================="
echo "Miniflux Deployment Configuration"
echo "=========================================="
echo "Service ID: $SERVICE_ID"
echo "Public URL: $SERVICE_URL"
echo "Username: $ADMIN_USERNAME"
echo "Password: $ADMIN_PASSWORD"
echo "=========================================="
echo "Note: It may take a few minutes for the initial deployment and database migrations to complete."
