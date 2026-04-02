# SDKs & Examples

Auto-generated typed clients and working examples for calling the Firecrawl Agent from any language.

Generated from [agent-core/openapi.yaml](../agent-core/openapi.yaml) using [OpenAPI Generator](https://openapi-generator.tech/).

## Quick start

```bash
firecrawl-agent init my-agent -t express
firecrawl-agent dev my-agent
```

Then call it from any language:

```bash
cd agent-sdks/python/examples && python main.py
cd agent-sdks/go/examples && go run main.go
cd agent-sdks/curl && bash run.sh
```

## All SDKs

Each SDK includes an `examples/` directory with a working sample.

| Language | Install | Run example |
|----------|---------|-------------|
| [Python](./python/) | `pip install ./agent-sdks/python` | `python agent-sdks/python/examples/main.py` |
| [Go](./go/) | `go get` | `go run agent-sdks/go/examples/main.go` |
| [JavaScript/TypeScript](./javascript/) | `npm install ./agent-sdks/javascript` | `npx tsx agent-sdks/javascript/examples/index.ts` |
| [Ruby](./ruby/) | `gem build && gem install` | `ruby agent-sdks/ruby/examples/main.rb` |
| [Java](./java/) | `mvn install` | `javac agent-sdks/java/examples/Main.java && java -cp agent-sdks/java/examples Main` |
| [Kotlin](./kotlin/) | `gradle build` | `kotlinc -script agent-sdks/kotlin/examples/main.kts` |
| [Rust](./rust/) | `cargo build` | `rustc agent-sdks/rust/examples/main.rs && ./main` |
| [C#](./csharp/) | `dotnet build` | `cd agent-sdks/csharp/examples && dotnet run` |
| [PHP](./php/) | `composer install` | `php agent-sdks/php/examples/main.php` |
| [Dart](./dart/) | `dart pub get` | `dart run agent-sdks/dart/examples/main.dart` |
| [Elixir](./elixir/) | `mix deps.get` | `elixir agent-sdks/elixir/examples/main.exs` |
| [Scala](./scala/) | `sbt compile` | `scala-cli run agent-sdks/scala/examples/Main.scala` |
| [R](./r/) | `install.packages()` | `Rscript agent-sdks/r/examples/main.R` |
| [Perl](./perl/) | `perl Makefile.PL && make` | `perl agent-sdks/perl/examples/main.pl` |
| [C++](./cpp/) | `cmake && make` | `clang++ -std=c++17 agent-sdks/cpp/examples/main.cpp && ./a.out` |
| [Swift](./swift/) | SPM dependency | - |
| [PowerShell](./powershell/) | `Import-Module` | - |
| [curl](./curl/) | - | `bash agent-sdks/curl/run.sh` |

## Configuration

Override the agent URL with `AGENT_URL`:

```bash
AGENT_URL=https://my-agent.railway.app/api/v1 python agent-sdks/python/examples/main.py
```

## Regenerating

When [openapi.yaml](../agent-core/openapi.yaml) changes:

```bash
./.internal/generate-sdks.sh
```
