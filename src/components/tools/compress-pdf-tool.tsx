"use client";

import * as React from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { PdfThumbnail } from "@/components/shared/pdf-thumbnail";
import { ProcessingState } from "@/components/shared/processing-state";
import { ResultState } from "@/components/shared/result-state";
import { ToolWorkspace } from "@/components/shared/tool-workspace";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  formatBytes,
  getReadablePdfError,
  getTotalBytes,
  isTotalSizeOverWarningLimit,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import {
  type CompressPdfResult,
  type CompressionLevel,
  compressPdfFiles,
} from "@/lib/pdf/compress";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { getToolBySlug } from "@/lib/tools-config";

interface CompressQueueItem {
  id: string;
  file: File;
  pdfDoc: PDFDocumentProxy;
  pageCount: number;
}

export function CompressPdfTool() {
  const tool = getToolBySlug("kompres-pdf");
  const addMoreInputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const [items, setItems] = React.useState<CompressQueueItem[]>([]);
  const [level, setLevel] = React.useState<CompressionLevel>("recommended");
  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<CompressPdfResult | null>(
    null
  );

  const itemsRef = React.useRef<CompressQueueItem[]>([]);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      for (const item of itemsRef.current) {
        void disposePdfDocument(item.pdfDoc);
      }
    };
  }, []);

  const appendFiles = React.useCallback(async (files: File[]) => {
    const loaded: CompressQueueItem[] = [];
    for (const file of files) {
      try {
        const pdfDoc = await loadPdfJsDocument(file);
        loaded.push({
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          pdfDoc,
          pageCount: pdfDoc.numPages,
        });
      } catch (error) {
        toast.error(`${file.name}: ${getReadablePdfError(error)}`);
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
      const target = prev.find((item) => item.id === id);
      if (target) {
        void disposePdfDocument(target.pdfDoc);
      }
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        setStage("upload");
      }
      return next;
    });
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    for (const item of items) {
      void disposePdfDocument(item.pdfDoc);
    }
    setItems([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleCompress = async () => {
    if (items.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStage("processing");
    setProgress(5);
    setStatusText("Memulai kompresi PDF...");

    try {
      const result = await compressPdfFiles(
        items.map((item) => item.file),
        level,
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
        toast.error(getReadablePdfError(error));
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
    const savedTotal =
      resultData.totalBeforeBytes > 0
        ? Math.round(
            ((resultData.totalBeforeBytes - resultData.totalAfterBytes) /
              resultData.totalBeforeBytes) *
              100
          )
        : 0;

    return (
      <ResultState
        filename={resultData.filename}
        fileSizeBytes={resultData.blob.size}
        summaryText={`Total ukuran: ${formatBytes(resultData.totalBeforeBytes)} → ${formatBytes(resultData.totalAfterBytes)} (${savedTotal >= 0 ? `Hemat ${savedTotal}%` : `+${Math.abs(savedTotal)}%`})`}
        metrics={resultData.metrics}
        onDownload={() =>
          triggerBlobDownload(resultData.blob, resultData.filename)
        }
        onReset={handleReset}
      />
    );
  }

  const totalSize = getTotalBytes(items.map((item) => item.file));

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
              accept=".pdf"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) {
                  const { valid, rejectedNames } = validateSelectedFiles(
                    Array.from(event.target.files),
                    [".pdf"]
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
            {items.length} File • {formatBytes(totalSize)}
          </span>
        </>
      }
      sidebarTitle="Tingkat Kompresi"
      sidebarContent={
        <div className="space-y-4">
          <RadioGroup
            value={level}
            onValueChange={(val) => setLevel(String(val) as CompressionLevel)}
          >
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/50">
              <RadioGroupItem value="light" className="mt-0.5" />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Kompresi Ringan
                </span>
                <span className="block text-xs text-muted-foreground">
                  Optimasi struktur PDF, teks tetap vektor tajam.
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/50">
              <RadioGroupItem value="recommended" className="mt-0.5" />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Kompresi Rekomendasi
                </span>
                <span className="block text-xs text-muted-foreground">
                  Seimbang antara keterbacaan dan ukuran file.
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/50">
              <RadioGroupItem value="extreme" className="mt-0.5" />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Kompresi Ekstrem
                </span>
                <span className="block text-xs text-muted-foreground">
                  Ukuran sekecil mungkin untuk dokumen scan atau email.
                </span>
              </div>
            </label>
          </RadioGroup>

          {level !== "light" ? (
            <p className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
              Catatan: Mode Rekomendasi dan Ekstrem merasterisasi halaman
              menjadi gambar JPEG terkompresi agar ukuran file turun drastis.
            </p>
          ) : null}
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={items.length === 0}
          onClick={() => void handleCompress()}
        >
          Kompres PDF
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col rounded-lg border border-border bg-background p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {item.pageCount} hal.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Hapus ${item.file.name}`}
                onClick={() => handleRemove(item.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <PdfThumbnail
              pdfDoc={item.pdfDoc}
              pageNumber={1}
              targetWidth={180}
            />

            <div className="mt-2.5 min-w-0">
              <p
                className="truncate text-xs font-medium text-foreground"
                title={item.file.name}
              >
                {item.file.name}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatBytes(item.file.size)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ToolWorkspace>
  );
}
