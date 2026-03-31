"""Minimal example: run the Firecrawl Agent and print the result."""

import os
import requests

BASE_URL = os.getenv("FIRECRAWL_AGENT_URL", "http://localhost:3000/api/v1")

resp = requests.post(
    f"{BASE_URL}/run",
    json={"prompt": "What is Firecrawl and what are its main features?"},
)
resp.raise_for_status()

result = resp.json()

print("--- Result ---")
print(result.get("text", ""))

usage = result.get("usage", {})
if usage:
    print(f"\nTokens  in: {usage.get('inputTokens', 0)}")
    print(f"Tokens out: {usage.get('outputTokens', 0)}")
