"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";

const plugins = { code, mermaid };
const controls = {
  table: true as const,
  code: true as const,
  mermaid: { download: true, copy: true, fullscreen: true, panZoom: false },
};

// Silent error component — hides rendering errors while mermaid is streaming
function MermaidLoading() {
  return (
    <div className="flex items-center gap-8 px-16 py-12 text-body-small text-black-alpha-32">
      <div className="w-10 h-10 rounded-full border-2 border-black-alpha-16 border-t-transparent animate-spin" />
      Rendering diagram...
    </div>
  );
}

const mermaidConfig = {
  errorComponent: MermaidLoading,
};

export default function StreamdownBlock({
  children,
  isStreaming,
}: {
  children: string;
  isStreaming?: boolean;
}) {
  return (
    <div className="max-w-none">
      <Streamdown
        plugins={plugins}
        controls={controls}
        mermaid={mermaidConfig}
        animated
        caret="block"
        isAnimating={isStreaming}
      >
        {children}
      </Streamdown>
    </div>
  );
}
