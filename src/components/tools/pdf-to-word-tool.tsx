"use client";

import * as React from "react";
import { AlertCircle, FolderInput, RotateCcw } from "lucide-react";
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
  MAX_PDF_TO_WORD_BYTES,
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
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Mengonversi dokumen...");
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
    setErrorMessage(null);

    if (selectedFile.size > MAX_PDF_TO_WORD_BYTES) {
      const msg = `Ukuran file (${formatBytes(selectedFile.size)}) melebihi batas maksimal 10 MB.`;
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    try {
      const nextDoc = await loadPdfJsDocument(selectedFile);
      void disposePdfDocument(pdfDocRef.current);
      setFile(selectedFile);
      setPdfDoc(nextDoc);
      setResultData(null);
      setStage("workspace");
    } catch (error) {
      const msg = getReadablePdfError(error);
      setErrorMessage(msg);
      toast.error(msg);
    }
  }, []);

  const handleReset = () => {
    abortControllerRef.current?.abort();
    void disposePdfDocument(pdfDoc);
    setFile(null);
    setPdfDoc(null);
    setErrorMessage(null);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleConvert = async () => {
    if (!file) return;
    if (file.size > MAX_PDF_TO_WORD_BYTES) {
      const msg = "Ukuran file melebihi batas maksimal 10 MB.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setErrorMessage(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStage("processing");
    setProgress(10);
    setStatusText("Mengonversi dokumen...");

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
        const msg = getReadablePdfError(error);
        setErrorMessage(msg);
        toast.error(msg);
      }
      setStage("workspace");
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (stage === "upload") {
    return (
      <div className="w-full">
        <FileDropzone
          title={tool.title}
          description={tool.description}
          acceptLabel={tool.acceptLabel}
          acceptExtensions={tool.acceptExtensions}
          helperNote="Maksimal 10 MB. File dikirim sementara ke server konversi untuk menjaga tata letak dan langsung dihapus setelah selesai."
          onFilesSelected={(files) => void loadFile(files[0])}
        />
        {errorMessage ? (
          <div
            role="alert"
            className="mx-auto mt-2 flex max-w-2xl items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <ProcessingState
        statusText={statusText}
        progress={progress}
        detailText="Mempertahankan gambar, kolom, tabel, font, dan hyperlink. Mohon tunggu hingga 60 detik bila server baru aktif."
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

          {errorMessage ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          ) : null}

          <p className="rounded-lg border border-border bg-background p-3 leading-relaxed text-muted-foreground">
            Maksimal ukuran file 10 MB. Dokumen dikirim sementara ke server
            konversi (`pdf2docx`) agar tata letak, gambar, garis pemisah, dan
            tautan tetap rapi, lalu langsung dihapus setelah selesai.
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
