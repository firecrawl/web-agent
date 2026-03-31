#!/usr/bin/env bash
#
# curl examples for /api/v1/run
# Usage: ./run.sh
#
# Assumes the server is running at http://localhost:3000

set -euo pipefail

BASE_URL="http://localhost:3000/api/v1/run"

# --------------------------------------------------------------------------
# 1. Simple query (non-streaming)
# --------------------------------------------------------------------------
echo "=========================================="
echo " 1. Simple Query (non-streaming)"
echo "=========================================="

curl -s "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the main product on https://example.com?"
  }' | python3 -m json.tool

echo ""
echo ""

# --------------------------------------------------------------------------
# 2. Structured JSON extraction
# --------------------------------------------------------------------------
echo "=========================================="
echo " 2. Structured JSON Extraction"
echo "=========================================="

curl -s "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Extract the pricing tiers from https://example.com/pricing",
    "format": "json",
    "urls": ["https://example.com/pricing"],
    "schema": {
      "tiers": [
        {
          "name": "string",
          "price": "string",
          "features": ["string"]
        }
      ]
    }
  }' | python3 -m json.tool

echo ""
echo ""

# --------------------------------------------------------------------------
# 3. Streaming with SSE
# --------------------------------------------------------------------------
echo "=========================================="
echo " 3. Streaming with SSE"
echo "=========================================="

curl -N "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Summarize the homepage of https://example.com",
    "stream": true
  }'
