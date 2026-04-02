"use client";

import { useEffect, useRef } from "react";

export default function VegaChart({ spec }: { spec: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    (async () => {
      try {
        const parsed = JSON.parse(spec);
        const vegaEmbed = (await import("vega-embed")).default;
        if (!mounted || !containerRef.current) return;
        await vegaEmbed(containerRef.current, parsed, {
          actions: false,
          renderer: "svg",
          theme: "latimes",
        });
      } catch {
        if (containerRef.current) {
          containerRef.current.textContent = "Failed to render chart";
        }
      }
    })();

    return () => { mounted = false; };
  }, [spec]);

  return <div ref={containerRef} className="w-full min-h-[200px]" />;
}
