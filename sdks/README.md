# SDKs

Auto-generated typed clients for calling the Firecrawl Agent API from any language.

Generated from [agent-core/openapi.yaml](../agent-core/openapi.yaml) using [OpenAPI Generator](https://openapi-generator.tech/).

## Quick start

1. Scaffold and start an agent:

```bash
firecrawl-agent init my-agent -t express
firecrawl-agent dev my-agent
```

2. Call it from any language:

**Python:**
```python
import requests
result = requests.post("http://localhost:3000/v1/run", json={
    "prompt": "get pricing for Vercel",
    "format": "json"
}).json()
```

**Go:**
```go
body, _ := json.Marshal(map[string]any{"prompt": "get pricing for Vercel"})
resp, _ := http.Post("http://localhost:3000/v1/run", "application/json", bytes.NewReader(body))
```

**TypeScript:**
```typescript
const result = await fetch("http://localhost:3000/v1/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "get pricing for Vercel" }),
}).then(r => r.json())
```

Or use the typed SDK clients below for full type safety.

## Available SDKs

| Language | Directory | Install |
|----------|-----------|---------|
| Python | `python/` | `pip install ./sdks/python` |
| Go | `go/` | `go get` |
| JavaScript/TypeScript | `javascript/` | `npm install ./sdks/javascript` |
| Ruby | `ruby/` | `gem build && gem install` |
| Java | `java/` | `mvn install` |
| Kotlin | `kotlin/` | `gradle build` |
| Swift | `swift/` | SPM dependency |
| Rust | `rust/` | `cargo build` |
| C# | `csharp/` | `dotnet build` |
| PHP | `php/` | `composer install` |
| Dart | `dart/` | `dart pub get` |
| Elixir | `elixir/` | `mix deps.get` |
| Scala | `scala/` | `sbt compile` |
| R | `r/` | `install.packages()` |
| Perl | `perl/` | `perl Makefile.PL && make` |
| C++ | `cpp/` | `cmake && make` |
| PowerShell | `powershell/` | `Import-Module` |

## Regenerating

When [openapi.yaml](../agent-core/openapi.yaml) changes:

```bash
./scripts/generate-sdks.sh
```

Requires Java (`brew install openjdk`).
