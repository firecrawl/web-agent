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
cd agent-examples/curl && bash run.sh
cd agent-examples/python-basic && python main.py
cd agent-examples/go-basic && go run main.go
```

All examples hit `POST /v1/run` on `http://localhost:3000/api/v1` by default.

## All examples

| Example | Run |
|---------|-----|
| [curl](./curl/) | `bash run.sh` |
| [python-basic](./python-basic/) | `python main.py` |
| [python-langchain](./python-langchain/) | `python main.py` |
| [typescript-ai-sdk](./typescript-ai-sdk/) | `npx tsx index.ts` |
| [go-basic](./go-basic/) | `go run main.go` |
| [ruby](./ruby/) | `ruby main.rb` |
| [java](./java/) | `javac Main.java && java Main` |
| [rust](./rust/) | `rustc main.rs && ./main` |
| [php](./php/) | `php main.php` |
| [dart](./dart/) | `dart run main.dart` |
| [kotlin](./kotlin/) | `kotlinc -script main.kts` |
| [csharp](./csharp/) | `dotnet run` |
| [elixir](./elixir/) | `elixir main.exs` |
| [perl](./perl/) | `perl main.pl` |
| [r](./r/) | `Rscript main.R` |
| [cpp](./cpp/) | `clang++ -std=c++17 main.cpp && ./a.out` |
| [scala](./scala/) | `scala-cli run Main.scala` |

## Configuration

Override the agent URL with `AGENT_URL`:

```bash
AGENT_URL=https://my-agent.railway.app/api/v1 python agent-examples/python-basic/main.py
```

## Two integration paths

**HTTP** - POST to `/v1/run`, get JSON back. Works with any [template](../agent-templates/).

**Library** - import [agent-core](../agent-core/) directly as TypeScript. No server needed. See [typescript-ai-sdk](./typescript-ai-sdk/).
