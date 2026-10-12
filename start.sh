#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Starting MADA AI Assistant..."
echo ""
echo "Frontend: http://localhost:5181"
echo "Backend:  http://localhost:3008"
echo ""
npm run dev:all
