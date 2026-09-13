#!/bin/bash
# Helper script to view stream logs for debugging
# Usage: ./stream-logs.sh [stream_id]

STREAM_ID=$1

if [ -z "$STREAM_ID" ]; then
    echo "Usage: $0 <stream_id>"
    echo ""
    echo "Available streams:"
    supervisorctl status | grep "stagepi-stream-" | awk '{print $1}' | sed 's/stagepi-stream-/  - /'
    echo ""
    echo "Example: $0 abc123"
    exit 1
fi

PROGRAM_NAME="stagepi-stream-${STREAM_ID}"

echo "=== Stream Status ==="
supervisorctl status "$PROGRAM_NAME"
echo ""

echo "=== Stream Logs (stdout) ==="
tail -n 50 "/var/log/supervisor/stream-${STREAM_ID}.log" 2>/dev/null || echo "No stdout log found"
echo ""

echo "=== Stream Errors (stderr) ==="
tail -n 50 "/var/log/supervisor/stream-${STREAM_ID}-error.log" 2>/dev/null || echo "No stderr log found"
echo ""

echo "=== Follow logs (Ctrl+C to exit) ==="
tail -f "/var/log/supervisor/stream-${STREAM_ID}.log" "/var/log/supervisor/stream-${STREAM_ID}-error.log" 2>/dev/null
