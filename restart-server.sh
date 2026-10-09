#!/bin/bash
# Restart script for MADA AI Backend
cd /Users/vohuy/Downloads/MADA\ AI\ ASSISTANT/mada-ai-assistant

# Kill old server on port 3009
lsof -ti :3009 | xargs kill -9 2>/dev/null
sleep 1

# Start server
npm run server
