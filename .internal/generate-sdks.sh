#!/usr/bin/env bash
# Generate all SDKs from the OpenAPI spec.
# Requires: Java (brew install openjdk), npx
set -euo pipefail

SPEC="agent-core/openapi.yaml"
OUT="sdks"
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

gen() {
  local lang="$1" generator="$2"; shift 2
  echo "  $lang..."
  npx @openapitools/openapi-generator-cli generate \
    -i "$SPEC" -g "$generator" -o "$OUT/$lang" "$@" \
    2>&1 | grep -cE "^\[main\].*writing" | xargs -I{} echo "    {} files written"
}

echo "Generating SDKs from $SPEC"
echo "=================================================="

gen python        python          --additional-properties=packageName=firecrawl_agent,projectName=firecrawl-agent
gen go            go              --additional-properties=packageName=firecrawlagent
gen javascript    typescript-fetch --additional-properties=npmName=@firecrawl/agent-sdk,typescriptThreePlus=true,supportsES6=true
gen ruby          ruby            --additional-properties=gemName=firecrawl_agent,moduleName=FirecrawlAgent
gen java          java            --additional-properties=groupId=com.firecrawl,artifactId=agent-sdk,apiPackage=com.firecrawl.agent.api,modelPackage=com.firecrawl.agent.model
gen kotlin        kotlin          --additional-properties=groupId=com.firecrawl,artifactId=agent-sdk,packageName=com.firecrawl.agent
gen swift         swift6          --additional-properties=projectName=FirecrawlAgent
gen rust          rust            --additional-properties=packageName=firecrawl-agent
gen csharp        csharp          --additional-properties=packageName=FirecrawlAgent,netCoreProjectFile=true
gen php           php             --additional-properties=packageName=FirecrawlAgent,invokerPackage=FirecrawlAgent
gen dart          dart            --additional-properties=pubName=firecrawl_agent
gen elixir        elixir          --additional-properties=packageName=firecrawl_agent
gen scala         scala-sttp      --additional-properties=mainPackage=com.firecrawl.agent
gen r             r
gen perl          perl
gen cpp           cpp-restsdk     --additional-properties=packageName=FirecrawlAgent
gen powershell    powershell      --additional-properties=packageName=FirecrawlAgent

echo ""
echo "Done. 17 SDKs generated in $OUT/"
