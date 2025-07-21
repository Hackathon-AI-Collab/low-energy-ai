#!/bin/bash

# LEAI Multiple Workers Test Script
# This script helps you test multiple worker services

echo "🔗 LEAI Multiple Workers Test"
echo "=============================="
echo ""

# Check if Ollama is running
echo "🔍 Checking Ollama status..."
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "❌ Ollama is not running!"
    echo "   Start it with: ollama serve"
    exit 1
fi
echo "✅ Ollama is running"

# Check available models
echo ""
echo "📋 Available models:"
curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "   (No models found or jq not installed)"

echo ""
echo "🚀 Starting multiple workers..."

# Check available models and start workers accordingly
AVAILABLE_MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "")

echo "📋 Available models: $AVAILABLE_MODELS"

# Start workers based on available models
if echo "$AVAILABLE_MODELS" | grep -q "phi3"; then
    echo "🔧 Starting Phi3 worker..."
    python3 leai-ble-server.py --model phi3 --device-name "LEAI-Phi3" --port 11434 &
    PHI3_PID=$!
    WORKER_COUNT=1
else
    echo "⚠️  Phi3 model not available, skipping..."
    PHI3_PID=""
    WORKER_COUNT=0
fi

# For now, let's just use phi3 since that's what's available
# You can install more models with: ollama pull llama3.2 mistral codellama
echo ""
echo "💡 To add more models, run:"
echo "   ollama pull llama3.2"
echo "   ollama pull mistral" 
echo "   ollama pull codellama"

echo ""
if [ $WORKER_COUNT -gt 0 ]; then
    echo "✅ Workers started with PIDs:"
    if [ ! -z "$PHI3_PID" ]; then
        echo "   Phi3: $PHI3_PID"
    fi
    echo ""
    echo "📱 Your app should now discover these devices:"
    if [ ! -z "$PHI3_PID" ]; then
        echo "   • LEAI-Phi3 (phi3)"
    fi
else
    echo "⚠️  No workers started - no compatible models available"
fi
echo ""
echo "🛑 Press Ctrl+C to stop all workers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping workers..."
    if [ ! -z "$PHI3_PID" ]; then
        kill $PHI3_PID 2>/dev/null
    fi
    echo "✅ All workers stopped"
    exit 0
}

# Set up signal handler
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait 