"use client";

import * as React from "react";
import { Check, FolderInput, RotateCcw } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { PdfThumbnail } from "@/components/shared/pdf-thumbnail";
import { ProcessingState } from "@/components/shared/processing-state";
import { ResultState } from "@/components/shared/result-state";
import { ToolWorkspace } from "@/components/shared/tool-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  getReadablePdfError,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import {
  type SplitMode,
  type SplitPdfResult,
  splitPdfFile,
} from "@/lib/pdf/split";
import { getToolBySlug } from "@/lib/tools-config";
import { cn } from "@/lib/utils";

export function SplitPdfTool() {
  const tool = getToolBySlug("pisahkan-pdf");
  const replaceInputRef = React.useRef<HTMLInputElement>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");

  const [mode, setMode] = React.useState<SplitMode>("select");
  const [selectedPages, setSelectedPages] = React.useState<number[]>([]);
  const [rangeInput, setRangeInput] = React.useState("1-2");
  const [mergeRanges, setMergeRanges] = React.useState(false);

  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<SplitPdfResult | null>(
    null
  );

  const pdfDocRef = React.useRef<PDFDocumentProxy | null>(null);
  React.useEffect(() => {
    pdfDocRef.current = pdfDoc;
  }, [pdfDoc]);

  React.useEffect(() => {
    return () => {
      void disposePdfDocument(pdfDocRef.current);
    };
  }, []);

  const loadFile = React.useCallback(async (selectedFile: File) => {
    try {
      const nextDoc = await loadPdfJsDocument(selectedFile);
      void disposePdfDocument(pdfDocRef.current);
      setFile(selectedFile);
      setPdfDoc(nextDoc);
      setSelectedPages([]);
      setRangeInput(nextDoc.numPages > 1 ? `1-${Math.min(2, nextDoc.numPages)}` : "1");
      setResultData(null);
      setStage("workspace");
    } catch (error) {
      toast.error(getReadablePdfError(error));
    }
  }, []);

  const handleReset = () => {
    void disposePdfDocument(pdfDoc);
    setFile(null);
    setPdfDoc(null);
    setSelectedPages([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const handleSplit = async () => {
    if (!file || !pdfDoc) return;

    setStage("processing");
    setProgress(5);
    setStatusText("Menyiapkan pemisahan halaman...");

    try {
      const result = await splitPdfFile(
        file,
        {
          mode,
          selectedPages,
          rangeInput,
          mergeRanges,
        },
        (pct, status) => {
          setProgress(pct);
          setStatusText(status);
        }
      );
      setResultData(result);
      setStage("result");
    } catch (error) {
      toast.error(getReadablePdfError(error));
      setStage("workspace");
    }
  };

  if (stage === "upload") {
    return (
      <FileDropzone
        title={tool.title}
        description={tool.description}
        acceptLabel={tool.acceptLabel}
        acceptExtensions={tool.acceptExtensions}
        onFilesSelected={(files) => void loadFile(files[0])}
      />
    );
  }

  if (stage === "processing") {
    return <ProcessingState statusText={statusText} progress={progress} />;
  }

  if (stage === "result" && resultData) {
    return (
      <ResultState
        filename={resultData.filename}
        fileSizeBytes={resultData.blob.size}
        summaryText={
          resultData.fileCount > 1
            ? `${resultData.fileCount} file PDF dikemas ke dalam arsip ZIP.`
            : "Halaman berhasil diekstrak menjadi 1 file PDF."
        }
        onDownload={() =>
          triggerBlobDownload(resultData.blob, resultData.filename)
        }
        onReset={handleReset}
      />
    );
  }

  const totalPages = pdfDoc?.numPages ?? 0;

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
              onClick={() => replaceInputRef.current?.click()}
            >
              <FolderInput className="size-3.5" />
              <span>Ganti File</span>
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
              ref={replaceInputRef}
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) {
                  const { valid, rejectedNames } = validateSelectedFiles(
                    [event.target.files[0]],
                    [".pdf"]
                  );
                  if (rejectedNames.length > 0) {
                    toast.error("Format file harus PDF.");
                  } else if (valid[0]) {
                    void loadFile(valid[0]);
                  }
                  event.target.value = "";
                }
              }}
            />
          </div>

          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {totalPages} Halaman
          </span>
        </>
      }
      sidebarTitle="Mode Pemisahan"
      sidebarContent={
        <div className="space-y-4">
          <RadioGroup
            value={mode}
            onValueChange={(val) => setMode(String(val) as SplitMode)}
          >
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/50">
              <RadioGroupItem value="select" className="mt-0.5" />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Pilih Halaman
                </span>
                <span className="block text-xs text-muted-foreground">
                  Klik thumbnail halaman yang ingin diekstrak.
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/50">
              <RadioGroupItem value="range" className="mt-0.5" />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Rentang Kustom
                </span>
                <span className="block text-xs text-muted-foreground">
                  Tentukan halaman dengan format seperti 1-3, 5.
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/50">
              <RadioGroupItem value="all" className="mt-0.5" />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  Pisahkan Semua
                </span>
                <span className="block text-xs text-muted-foreground">
                  Setiap halaman menjadi file PDF terpisah (.zip).
                </span>
              </div>
            </label>
          </RadioGroup>

          {mode === "select" ? (
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Terpilih:</span>
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {selectedPages.length} hal.
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="flex-1"
                  onClick={() =>
                    setSelectedPages(
                      Array.from({ length: totalPages }, (_, i) => i + 1)
                    )
                  }
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="flex-1"
                  onClick={() => setSelectedPages([])}
                >
                  Batal Pilih
                </Button>
              </div>
            </div>
          ) : null}

          {mode === "range" ? (
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="space-y-1.5">
                <Label htmlFor="split-range-input" className="text-xs">
                  Rentang Halaman
                </Label>
                <Input
                  id="split-range-input"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="Contoh: 1-3, 5, 8-10"
                  className="font-mono text-xs"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={mergeRanges}
                  onChange={(e) => setMergeRanges(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                <span>Gabungkan semua rentang jadi 1 PDF</span>
              </label>
            </div>
          ) : null}
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={mode === "select" && selectedPages.length === 0}
          onClick={() => void handleSplit()}
        >
          Pisahkan PDF
        </Button>
      }
    >
      {pdfDoc ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: totalPages }, (_, idx) => {
            const pageNum = idx + 1;
            const isSelected =
              mode === "select" && selectedPages.includes(pageNum);

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => {
                  if (mode !== "select") {
                    setMode("select");
                  }
                  togglePage(pageNum);
                }}
                className={cn(
                  "group relative flex flex-col rounded-lg border p-2.5 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-accent-blue"
                    : "border-border bg-background hover:border-border-strong/50"
                )}
              >
                <div className="relative w-full">
                  <PdfThumbnail
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    targetWidth={180}
                  />
                  {isSelected ? (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </div>
                <span className="mt-2 font-mono text-xs text-muted-foreground tabular-nums">
                  Halaman {pageNum}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </ToolWorkspace>
  );
}
