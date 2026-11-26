"use client";

import * as React from "react";
import { FileText, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { ProcessingState } from "@/components/shared/processing-state";
import { ResultState } from "@/components/shared/result-state";
import { ToolWorkspace } from "@/components/shared/tool-workspace";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBytes,
  getTotalBytes,
  isTotalSizeOverWarningLimit,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import {
  type ConversionResult,
  type WordToPdfMargin,
  type WordToPdfPageSize,
  defaultConversionAdapter,
} from "@/lib/pdf/conversion-adapter";
import { getToolBySlug } from "@/lib/tools-config";

interface DocxQueueItem {
  id: string;
  file: File;
  previewSnippet: string;
}

const PAGE_SIZE_LABELS: Record<WordToPdfPageSize, string> = {
  a4: "A4 (210 × 297 mm)",
  letter: "Letter (8.5 × 11 in)",
};

const MARGIN_LABELS: Record<WordToPdfMargin, string> = {
  normal: "Normal",
  narrow: "Sempit",
  wide: "Lebar",
};

export function WordToPdfTool() {
  const tool = getToolBySlug("word-ke-pdf");
  const addMoreInputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const [items, setItems] = React.useState<DocxQueueItem[]>([]);
  const [pageSize, setPageSize] = React.useState<WordToPdfPageSize>("a4");
  const [margin, setMargin] = React.useState<WordToPdfMargin>("normal");

  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<ConversionResult | null>(
    null
  );

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const appendFiles = React.useCallback(async (files: File[]) => {
    const mammoth = await import("mammoth");
    const loaded: DocxQueueItem[] = [];

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
        const cleaned = value.replace(/\s+/g, " ").trim();
        loaded.push({
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          previewSnippet: cleaned
            ? cleaned.slice(0, 260) + (cleaned.length > 260 ? "..." : "")
            : "Dokumen siap dikonversi.",
        });
      } catch {
        toast.error(`Gagal membaca ${file.name}. Pastikan format DOCX valid.`);
      }
    }

    if (loaded.length > 0) {
      setItems((prev) => {
        const next = [...prev, ...loaded];
        if (isTotalSizeOverWarningLimit(next.map((e) => e.file))) {
          toast.warning(
            `Total ukuran file (${formatBytes(getTotalBytes(next.map((e) => e.file)))}) melebihi 150 MB.`
          );
        }
        return next;
      });
      setStage("workspace");
    }
  }, []);

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        setStage("upload");
      }
      return next;
    });
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    setItems([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleConvert = async () => {
    if (items.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStage("processing");
    setProgress(5);
    setStatusText("Memulai konversi DOCX ke PDF...");

    try {
      const result = await defaultConversionAdapter.wordToPdf(
        items.map((item) => item.file),
        { pageSize, margin },
        (pct, status) => {
          setProgress(pct);
          setStatusText(status);
        },
        controller.signal
      );
      setResultData(result);
      setStage("result");
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(
          error instanceof Error ? error.message : "Gagal mengonversi DOCX."
        );
      }
      setStage("workspace");
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (stage === "upload") {
    return (
      <FileDropzone
        title={tool.title}
        description={tool.description}
        acceptLabel={tool.acceptLabel}
        acceptExtensions={tool.acceptExtensions}
        multiple
        onFilesSelected={(files) => void appendFiles(files)}
      />
    );
  }

  if (stage === "processing") {
    return (
      <ProcessingState
        statusText={statusText}
        progress={progress}
        onCancel={() => {
          abortControllerRef.current?.abort();
          setStage("workspace");
        }}
      />
    );
  }

  if (stage === "result" && resultData) {
    return (
      <ResultState
        filename={resultData.filename}
        fileSizeBytes={resultData.blob.size}
        summaryText={
          resultData.fileCount > 1
            ? `${resultData.fileCount} dokumen Word berhasil dikonversi menjadi PDF dalam arsip ZIP.`
            : "Dokumen Word berhasil dikonversi menjadi PDF."
        }
        onDownload={() =>
          triggerBlobDownload(resultData.blob, resultData.filename)
        }
        onReset={handleReset}
      />
    );
  }

  return (
    <ToolWorkspace
      toolbar={
        <>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => addMoreInputRef.current?.click()}
            >
              <Plus className="size-3.5" />
              <span>Tambah File</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </Button>
            <input
              ref={addMoreInputRef}
              type="file"
              accept=".docx"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) {
                  const { valid, rejectedNames } = validateSelectedFiles(
                    Array.from(event.target.files),
                    tool.acceptExtensions
                  );
                  if (rejectedNames.length > 0) {
                    toast.error(
                      `Format tidak didukung: ${rejectedNames.join(", ")}`
                    );
                  }
                  if (valid.length > 0) {
                    void appendFiles(valid);
                  }
                  event.target.value = "";
                }
              }}
            />
          </div>

          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {items.length} File DOCX
          </span>
        </>
      }
      sidebarTitle="Pengaturan Cetak"
      sidebarContent={
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Ukuran Halaman</Label>
            <Select
              value={pageSize}
              onValueChange={(val) =>
                setPageSize(String(val) as WordToPdfPageSize)
              }
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue>{PAGE_SIZE_LABELS[pageSize]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">{PAGE_SIZE_LABELS.a4}</SelectItem>
                <SelectItem value="letter">{PAGE_SIZE_LABELS.letter}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Margin Halaman</Label>
            <Select
              value={margin}
              onValueChange={(val) =>
                setMargin(String(val) as WordToPdfMargin)
              }
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue>{MARGIN_LABELS[margin]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{MARGIN_LABELS.normal}</SelectItem>
                <SelectItem value="narrow">{MARGIN_LABELS.narrow}</SelectItem>
                <SelectItem value="wide">{MARGIN_LABELS.wide}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={items.length === 0}
          onClick={() => void handleConvert()}
        >
          Konversi ke PDF
        </Button>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <FileText className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.file.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Hapus ${item.file.name}`}
                onClick={() => handleRemove(item.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {item.previewSnippet}
            </p>
          </div>
        ))}
      </div>
    </ToolWorkspace>
  );
}
