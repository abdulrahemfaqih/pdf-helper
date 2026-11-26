"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  formatBytes,
  getTotalBytes,
  isTotalSizeOverWarningLimit,
  validateSelectedFiles,
} from "@/lib/file-utils";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  title: string;
  description: string;
  acceptLabel: string;
  acceptExtensions: string[];
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  helperNote?: string;
}

export function FileDropzone({
  title,
  description,
  acceptLabel,
  acceptExtensions,
  multiple = false,
  onFilesSelected,
  helperNote,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const acceptAttr = acceptExtensions.join(",");

  const handleIncomingFiles = React.useCallback(
    (rawList: FileList | File[]) => {
      const incoming = Array.from(rawList);
      if (incoming.length === 0) return;

      const selected = multiple ? incoming : [incoming[0]];
      const { valid, rejectedNames } = validateSelectedFiles(
        selected,
        acceptExtensions
      );

      if (rejectedNames.length > 0) {
        toast.error(
          `Format file tidak didukung (${rejectedNames.join(", ")}). Gunakan format ${acceptLabel}.`
        );
      }

      if (valid.length === 0) return;

      if (isTotalSizeOverWarningLimit(valid)) {
        toast.warning(
          `Total ukuran file (${formatBytes(getTotalBytes(valid))}) melebihi 150 MB. Pemrosesan di browser mungkin memerlukan waktu lebih lama.`
        );
      }

      onFilesSelected(valid);
    },
    [acceptExtensions, acceptLabel, multiple, onFilesSelected]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      handleIncomingFiles(event.dataTransfer.files);
    }
  };

  const openPicker = () => {
    inputRef.current?.click();
  };

  return (
    <div className="mx-auto w-full max-w-2xl py-4 sm:py-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Unggah file ${acceptLabel}`}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          isDragging
            ? "border-primary bg-accent-blue"
            : "border-border bg-muted hover:border-border-strong/50"
        )}
      >
        <div
          className={cn(
            "mb-4 flex size-11 items-center justify-center rounded-lg border border-border bg-background transition-colors",
            isDragging ? "border-primary/40 text-primary" : "text-foreground"
          )}
        >
          <Upload className="size-5" strokeWidth={1.75} />
        </div>

        <p className="text-sm font-medium text-foreground">
          Tarik dan jatuhkan file di sini
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          atau pilih langsung dari perangkat Anda
        </p>

        <Button
          type="button"
          className="mt-5 px-5"
          onClick={(event) => {
            event.stopPropagation();
            openPicker();
          }}
        >
          Pilih File
        </Button>

        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Format diterima: {acceptLabel}
          {multiple ? " (bisa banyak file)" : ""}
        </p>

        {helperNote ? (
          <p className="mt-2 max-w-md text-xs text-muted-foreground">
            {helperNote}
          </p>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) {
              handleIncomingFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}
