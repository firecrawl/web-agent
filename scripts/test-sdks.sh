#!/usr/bin/env bash
# Run a prompt against /api/v1/run for all SDK languages and save outputs.
# Usage: ./scripts/test-sdks.sh "your prompt here" [test-name] [maxSteps]
# Results saved to tests/<language>/<test-name>/output/
set -euo pipefail

PROMPT="${1:?Usage: test-sdks.sh \"prompt\" [test-name] [maxSteps]}"
TEST_NAME="${2:-$(echo "$PROMPT" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-40)}"
MAX_STEPS="${3:-5}"
BASE_URL="${API_URL:-http://localhost:3005/api/v1}"

LANGS=(python go javascript ruby java rust perl cpp php dart elixir kotlin csharp scala r)

echo "Running: $PROMPT"
echo "Test: $TEST_NAME | maxSteps: $MAX_STEPS | API: $BASE_URL"
echo "=================================================="

for lang in "${LANGS[@]}"; do
  dir="tests/$lang/$TEST_NAME/output"
  mkdir -p "$dir"
  curl -s -m 180 -X POST "$BASE_URL/run" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"prompt":"%s","maxSteps":%d}' "$PROMPT" "$MAX_STEPS")" \
    > "$dir/response.json" 2>/dev/null
  echo "  $lang: saved"
done

echo ""
echo "Results:"
echo "=================================================="

python3 << PYEOF
import json, os

langs = "$( IFS=,; echo "${LANGS[*]}" )".split(",")
test = "$TEST_NAME"

print(f"{'#':<3} {'Language':<12} {'Steps':<6} {'Tokens':<8} {'Preview'}")
print("-" * 95)

for i, lang in enumerate(langs, 1):
    path = f"tests/{lang}/{test}/output/response.json"
    try:
        with open(path) as f:
            d = json.load(f)
        steps = len(d.get("steps", []))
        tokens = d.get("usage", {}).get("totalTokens", "?")
        text = d.get("text", "").replace("\n", " ")[:70]
        print(f"{i:<3} {lang:<12} {steps:<6} {tokens:<8} {text}")
    except Exception as e:
        print(f"{i:<3} {lang:<12} {'—':<6} {'—':<8} ERROR: {e}")
PYEOF
