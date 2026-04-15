"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import LoadingDots from "@/components/ui/LoadingDots/LoadingDots";

const plugins = { code, mermaid };
const controls = {
  table: false,
  code: false,
  mermaid: false,
};

// Silent error component — hides rendering errors while mermaid is streaming
function MermaidLoading() {
  return (
    <div className="flex items-center gap-8 px-16 py-12 text-body-small text-black-alpha-32">
      <LoadingDots />
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
    <div className="max-w-none [&_pre]:!rounded-0 [&_code]:!rounded-0 [&_div[class*='rounded']]:!rounded-0 [&_div[class*='border']]:!rounded-0 [&_figure]:!rounded-0 [&_.streamdown-code]:!rounded-0">
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
