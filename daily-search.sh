#!/bin/bash
# Daily job search runner — called by launchd at 8am
# Hits the app's daily-search endpoint if the app is running,
# otherwise runs the search directly via Node.

APP_URL="http://localhost:3000"
LOG_FILE="$HOME/Library/Logs/job-search-daily.log"

echo "$(date): Running daily job search" >> "$LOG_FILE"

# Check if app is running
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  curl -s -X POST "$APP_URL/api/daily-search" \
    -H "Content-Type: application/json" \
    -d '{"force":false}' >> "$LOG_FILE" 2>&1
  echo "$(date): Done via running app" >> "$LOG_FILE"
else
  echo "$(date): App not running — open the app and it will auto-refresh" >> "$LOG_FILE"
fi
