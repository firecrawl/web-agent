# Examples

Working examples for calling the Firecrawl Agent from 17 languages.

## Quick start

1. Scaffold and start an agent:

```bash
firecrawl-agent init my-agent -t express
firecrawl-agent dev my-agent
```

2. Run any example:

```bash
cd examples/python-basic && python main.py
cd examples/go-basic && go run main.go
cd examples/curl && bash run.sh
```

All examples hit `POST /v1/run` on `http://localhost:3000/api/v1` by default.

## All examples

| Example | Language | Run |
|---------|----------|-----|
| [curl](./curl/) | Shell | `bash run.sh` |
| [python-basic](./python-basic/) | Python | `python main.py` |
| [python-langchain](./python-langchain/) | Python | `python main.py` |
| [typescript-ai-sdk](./typescript-ai-sdk/) | TypeScript | `npx tsx index.ts` |
| [go-basic](./go-basic/) | Go | `go run main.go` |
| [ruby](./ruby/) | Ruby | `ruby main.rb` |
| [java](./java/) | Java | `javac Main.java && java Main` |
| [rust](./rust/) | Rust | `rustc main.rs && ./main` |
| [php](./php/) | PHP | `php main.php` |
| [dart](./dart/) | Dart | `dart run main.dart` |
| [kotlin](./kotlin/) | Kotlin | `kotlinc -script main.kts` |
| [csharp](./csharp/) | C# | `dotnet run` |
| [elixir](./elixir/) | Elixir | `elixir main.exs` |
| [perl](./perl/) | Perl | `perl main.pl` |
| [r](./r/) | R | `Rscript main.R` |
| [cpp](./cpp/) | C++ | `clang++ -std=c++17 main.cpp && ./a.out` |
| [scala](./scala/) | Scala | `scala-cli run Main.scala` |

## Configuration

Override the agent URL with `AGENT_URL`:

```bash
AGENT_URL=https://my-agent.railway.app/api/v1 python examples/python-basic/main.py
```

## Two integration paths

**HTTP** — POST to `/v1/run`, get JSON back. All examples except typescript-ai-sdk use this. Works with any [template](../templates/).

**Library** — import [agent-core](../agent-core/) directly as TypeScript. No server needed. See [typescript-ai-sdk](./typescript-ai-sdk/).
