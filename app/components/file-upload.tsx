"use client";

import { useRef } from "react";
import { cn } from "@/utils/cn";
import type { UploadedFile } from "@agent-core";

export default function FileUpload({
  uploads,
  onUpload,
  onRemove,
}: {
  uploads: UploadedFile[];
  onUpload: (file: UploadedFile) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    const isText = file.type.startsWith("text/") ||
      /\.(csv|tsv|json|md|txt|xml|yaml|yml|toml|ini|log|sql|html|css|js|ts|py|rb|sh)$/i.test(file.name);

    if (isText) {
      reader.onload = () => {
        onUpload({
          name: file.name,
          type: file.type || "text/plain",
          content: reader.result as string,
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        onUpload({
          name: file.name,
          type: file.type,
          content: base64,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.json,.md,.xml,.yaml,.yml,.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.pptx,.html"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = e.target.files;
          if (files) {
            for (let i = 0; i < files.length; i++) {
              handleFile(files[i]);
            }
          }
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(
          "flex items-center gap-6 px-10 py-6 rounded-8 text-label-small transition-all",
          uploads.length > 0
            ? "bg-heat-8 text-heat-100"
            : "text-black-alpha-48 hover:bg-black-alpha-4",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
        <span>{uploads.length > 0 ? `${uploads.length} file${uploads.length > 1 ? "s" : ""}` : "Upload"}</span>
      </button>
      {uploads.map((f, i) => (
        <span key={i} className="flex items-center gap-2 px-6 py-3 rounded-6 bg-black-alpha-4 text-mono-x-small text-black-alpha-48 max-w-[120px]">
          <span className="truncate">{f.name}</span>
          <button
            type="button"
            className="flex-shrink-0 text-black-alpha-24 hover:text-accent-crimson transition-colors"
            onClick={() => onRemove(i)}
          >
            <svg fill="none" height="10" viewBox="0 0 24 24" width="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </span>
      ))}
    </div>
  );
}
