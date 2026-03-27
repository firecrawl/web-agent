import SymbolColored from "@/components/shared/icons/symbol-colored";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16">
      <SymbolColored width={50} height={72} />
      <h1 className="text-title-h3 text-accent-black">Firecrawl Agent</h1>
      <p className="text-body-large text-black-alpha-56">
        Open-source AI agent for autonomous web research.
      </p>
    </div>
  );
}
