"use client";

import * as React from "react";
import { FolderInput, RotateCcw } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { PdfThumbnail } from "@/components/shared/pdf-thumbnail";
import { ProcessingState } from "@/components/shared/processing-state";
import { ResultState } from "@/components/shared/result-state";
import { ToolWorkspace } from "@/components/shared/tool-workspace";
import { Button } from "@/components/ui/button";
import {
  formatBytes,
  getReadablePdfError,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import {
  type ConversionResult,
  defaultConversionAdapter,
} from "@/lib/pdf/conversion-adapter";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { getToolBySlug } from "@/lib/tools-config";

export function PdfToWordTool() {
  const tool = getToolBySlug("pdf-ke-word");
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<ConversionResult | null>(
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
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleConvert = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStage("processing");
    setProgress(5);
    setStatusText("Menyiapkan ekstraksi teks PDF...");

    try {
      const result = await defaultConversionAdapter.pdfToWord(
        file,
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
        helperNote="Mendukung PDF berbasis teks yang dapat diseleksi. Dokumen hasil scan gambar tidak didukung tanpa OCR."
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
        summaryText="Dokumen PDF berhasil dikonversi menjadi file Word (.docx)."
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
            {pdfDoc?.numPages ?? 0} Halaman
          </span>
        </>
      }
      sidebarTitle="Informasi Konversi"
      sidebarContent={
        <div className="space-y-3 text-xs">
          {file ? (
            <div className="space-y-1.5 rounded-lg border border-border bg-background p-3">
              <p className="truncate font-medium text-foreground">
                {file.name}
              </p>
              <p className="font-mono text-muted-foreground tabular-nums">
                {pdfDoc?.numPages ?? 0} hal. • {formatBytes(file.size)}
              </p>
            </div>
          ) : null}

          <p className="rounded-lg border border-border bg-background p-3 leading-relaxed text-muted-foreground">
            PDF berbasis teks (teks dapat diseleksi) akan mempertahankan urutan
            paragraf dan judul dengan baik. PDF hasil scan tanpa teks tidak
            dapat diekstrak secara lokal tanpa OCR.
          </p>
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => void handleConvert()}
        >
          Konversi ke Word
        </Button>
      }
    >
      {pdfDoc ? (
        <div className="mx-auto max-w-xs rounded-lg border border-border bg-background p-3">
          <PdfThumbnail pdfDoc={pdfDoc} pageNumber={1} targetWidth={280} />
          <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
            Pratinjau Halaman 1
          </p>
        </div>
      ) : null}
    </ToolWorkspace>
  );
}
