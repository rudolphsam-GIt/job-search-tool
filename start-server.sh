#!/bin/bash
# Load environment variables (including ANTHROPIC_API_KEY) from .env.local
set -a
[ -f .env.local ] && source .env.local
set +a
cd "$(dirname "$0")"
/usr/local/bin/node node_modules/.bin/next start
