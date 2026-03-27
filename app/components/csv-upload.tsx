"use client";

import { useRef, useState } from "react";
import { cn } from "@/utils/cn";

export default function CsvUpload({
  onUpload,
}: {
  onUpload: (filename: string, content: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setFilename(file.name);
      onUpload(file.name, text);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        className={cn(
          "flex items-center gap-6 px-10 py-6 rounded-8 text-label-small transition-all",
          filename
            ? "bg-accent-forest/10 text-accent-forest"
            : "text-black-alpha-48 hover:bg-black-alpha-4",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
          <path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <span>{filename ?? "CSV"}</span>
      </button>
    </div>
  );
}
