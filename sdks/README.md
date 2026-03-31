# SDKs

Auto-generated typed clients for calling the Firecrawl Agent API from any language.

All SDKs are generated from `agent-core/openapi.yaml` using [OpenAPI Generator](https://openapi-generator.tech/).

## Available SDKs

| Language | Directory | Package Manager | Install |
|----------|-----------|-----------------|---------|
| Python | `python/` | pip | `pip install ./sdks/python` |
| Go | `go/` | go get | `go get github.com/...` |
| JavaScript/TypeScript | `javascript/` | npm | `npm install ./sdks/javascript` |
| Ruby | `ruby/` | gem | `gem build && gem install` |
| Java | `java/` | Maven | `mvn install` |
| Kotlin | `kotlin/` | Gradle | `gradle build` |
| Swift | `swift/` | SPM | Add as package dependency |
| Rust | `rust/` | cargo | `cargo build` |
| C# | `csharp/` | NuGet | `dotnet build` |
| PHP | `php/` | Composer | `composer install` |
| Dart | `dart/` | pub | `dart pub get` |
| Elixir | `elixir/` | hex | `mix deps.get` |
| Scala | `scala/` | sbt | `sbt compile` |
| R | `r/` | CRAN | `install.packages()` |
| Perl | `perl/` | CPAN | `perl Makefile.PL && make` |
| C++ | `cpp/` | CMake | `cmake && make` |
| PowerShell | `powershell/` | PSGallery | `Import-Module` |

## Usage

Every SDK works the same way. Point it at your deployed agent and call `run()`:

**Python:**
```python
from firecrawl_agent import DefaultApi, RunRequest, Configuration

api = DefaultApi(Configuration(host="https://your-agent.railway.app/api/v1"))
result = api.run(RunRequest(prompt="get pricing for Vercel", format="json"))
```

**Go:**
```go
cfg := firecrawlagent.NewConfiguration()
cfg.Servers[0].URL = "https://your-agent.railway.app/api/v1"
client := firecrawlagent.NewAPIClient(cfg)
result, _, _ := client.DefaultAPI.Run(ctx).RunRequest(...).Execute()
```

**TypeScript:**
```typescript
import { DefaultApi, Configuration } from '@firecrawl/agent-sdk'
const api = new DefaultApi(new Configuration({ basePath: 'https://your-agent.railway.app/api/v1' }))
const result = await api.run({ prompt: 'get pricing for Vercel' })
```

## Regenerating

When `agent-core/openapi.yaml` changes, regenerate all SDKs:

```bash
./scripts/generate-sdks.sh
```

Requires Java (`brew install openjdk`).
