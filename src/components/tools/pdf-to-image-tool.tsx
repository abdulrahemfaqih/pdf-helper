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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getReadablePdfError,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import {
  convertPdfToImages,
  type ImageExportDpi,
  type ImageExportFormat,
  type PdfToImageResult,
} from "@/lib/pdf/pdf-to-image";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { getToolBySlug } from "@/lib/tools-config";
import { cn } from "@/lib/utils";

type PageSelectionMode = "all" | "custom";

export function PdfToImageTool() {
  const tool = getToolBySlug("pdf-ke-foto");
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [selectionMode, setSelectionMode] =
    React.useState<PageSelectionMode>("all");
  const [selectedPages, setSelectedPages] = React.useState<number[]>([]);
  const [format, setFormat] = React.useState<ImageExportFormat>("jpg");
  const [dpi, setDpi] = React.useState<ImageExportDpi>(150);

  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<PdfToImageResult | null>(
    null
  );

  const pdfDocRef = React.useRef<PDFDocumentProxy | null>(null);
  React.useEffect(() => {
    pdfDocRef.current = pdfDoc;
  }, [pdfDoc]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      void disposePdfDocument(pdfDocRef.current);
    };
  }, []);

  const loadFile = React.useCallback(async (selectedFile: File) => {
    try {
      const nextDoc = await loadPdfJsDocument(selectedFile);
      void disposePdfDocument(pdfDocRef.current);
      setFile(selectedFile);
      setPdfDoc(nextDoc);
      setSelectionMode("all");
      setSelectedPages(
        Array.from({ length: nextDoc.numPages }, (_, idx) => idx + 1)
      );
      setResultData(null);
      setStage("workspace");
    } catch (error) {
      toast.error(getReadablePdfError(error));
    }
  }, []);

  const handleReset = () => {
    abortControllerRef.current?.abort();
    void disposePdfDocument(pdfDoc);
    setFile(null);
    setPdfDoc(null);
    setSelectedPages([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const togglePage = (pageNum: number) => {
    setSelectionMode("custom");
    setSelectedPages((prev) =>
      prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const handleConvert = async () => {
    if (!file || !pdfDoc) return;
    const pagesToExport =
      selectionMode === "all"
        ? Array.from({ length: pdfDoc.numPages }, (_, idx) => idx + 1)
        : selectedPages;

    if (pagesToExport.length === 0) {
      toast.error("Pilih minimal 1 halaman untuk diubah menjadi gambar.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStage("processing");
    setProgress(5);
    setStatusText("Menyiapkan rendering gambar...");

    try {
      const result = await convertPdfToImages(
        file,
        { format, dpi, pageNumbers: pagesToExport },
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
        onFilesSelected={(files) => void loadFile(files[0])}
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
          resultData.imageCount > 1
            ? `${resultData.imageCount} gambar (${format.toUpperCase()}, ${dpi} DPI) dikemas dalam ZIP.`
            : `1 halaman berhasil dikonversi ke ${format.toUpperCase()} (${dpi} DPI).`
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
      sidebarTitle="Opsi Ekspor Gambar"
      sidebarContent={
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Cakupan Halaman</Label>
            <RadioGroup
              value={selectionMode}
              onValueChange={(val) => {
                const mode = String(val) as PageSelectionMode;
                setSelectionMode(mode);
                if (mode === "all") {
                  setSelectedPages(
                    Array.from({ length: totalPages }, (_, i) => i + 1)
                  );
                }
              }}
            >
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <RadioGroupItem value="all" />
                <span>Semua Halaman ({totalPages})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <RadioGroupItem value="custom" />
                <span>Pilih Halaman ({selectedPages.length} terpilih)</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Format Gambar</Label>
            <Select
              value={format}
              onValueChange={(val) => setFormat(String(val) as ImageExportFormat)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {format === "jpg"
                    ? "JPG (Ukuran Lebih Kecil)"
                    : "PNG (Tanpa Kompresi Lossy)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpg">JPG (Ukuran Lebih Kecil)</SelectItem>
                <SelectItem value="png">PNG (Tanpa Kompresi Lossy)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Resolusi / Kualitas</Label>
            <Select
              value={String(dpi)}
              onValueChange={(val) =>
                setDpi(Number(val) === 300 ? 300 : 150)
              }
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {dpi === 300 ? "Tinggi (300 DPI)" : "Standar (150 DPI)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="150">Standar (150 DPI)</SelectItem>
                <SelectItem value="300">Tinggi (300 DPI)</SelectItem>
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
          disabled={selectionMode === "custom" && selectedPages.length === 0}
          onClick={() => void handleConvert()}
        >
          Konversi ke {format.toUpperCase()}
        </Button>
      }
    >
      {pdfDoc ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: totalPages }, (_, idx) => {
            const pageNum = idx + 1;
            const isSelected =
              selectionMode === "all" || selectedPages.includes(pageNum);

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => togglePage(pageNum)}
                className={cn(
                  "flex flex-col rounded-lg border p-2.5 text-left transition-colors",
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
