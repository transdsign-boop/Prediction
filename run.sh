#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies…"
pip install -q -r requirements.txt

echo "Starting Kalshi BTC Auto-Trader on http://0.0.0.0:8000"
uvicorn web:app --host 0.0.0.0 --port 8000 --reload
