#!/bin/bash
set -e

# Organization ID dynamically found based on user's profile
ORG_ID="org-fancy-pond-57061061"
PROJECT_NAME=${1:-panfleto-miniflux}

echo "Creating Neon project '$PROJECT_NAME'..."

# Call neon CLI and output as JSON
OUTPUT=$(neon project create --name "$PROJECT_NAME" --org-id "$ORG_ID" -o json)

# Extract connection string using python
DB_URL=$(echo "$OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['connection_uris'][0]['connection_uri'])")

echo ""
echo "=========================================="
echo "Neon Database Created Successfully!"
echo "=========================================="
echo "DATABASE_URL: $DB_URL"
echo "=========================================="
echo "Please update the DATABASE_URL environment variable in your Render Dashboard."
