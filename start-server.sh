#!/bin/bash
cd /Users/vohuy/Downloads/MADA\ AI\ ASSISTANT/mada-ai-assistant
export PORT=3009
export TSX_NO_WATCH=1
export TSX_NO_INSPECTOR=1

# Start server and keep it running
exec npx tsx server/index.ts >> server3009.log 2>&1
