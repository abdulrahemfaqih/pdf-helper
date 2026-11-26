"use client";

import * as React from "react";
import {
  FolderInput,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { PdfThumbnail } from "@/components/shared/pdf-thumbnail";
import { ProcessingState } from "@/components/shared/processing-state";
import { ResultState } from "@/components/shared/result-state";
import { ToolWorkspace } from "@/components/shared/tool-workspace";
import { Button } from "@/components/ui/button";
import {
  getReadablePdfError,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { rotatePdfPages } from "@/lib/pdf/rotate";
import { getToolBySlug } from "@/lib/tools-config";

export function RotatePdfTool() {
  const tool = getToolBySlug("putar-pdf");
  const replaceInputRef = React.useRef<HTMLInputElement>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [rotations, setRotations] = React.useState<number[]>([]);
  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<{
    blob: Blob;
    filename: string;
  } | null>(null);

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
      setRotations(Array.from({ length: nextDoc.numPages }, () => 0));
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
    setRotations([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const rotateAll = (delta: number) => {
    setRotations((prev) => prev.map((deg) => (((deg + delta) % 360) + 360) % 360));
  };

  const rotateSingle = (index: number, delta: number) => {
    setRotations((prev) =>
      prev.map((deg, idx) =>
        idx === index ? (((deg + delta) % 360) + 360) % 360 : deg
      )
    );
  };

  const handleSave = async () => {
    if (!file) return;
    setStage("processing");
    setProgress(5);
    setStatusText("Menyimpan rotasi halaman...");

    try {
      const result = await rotatePdfPages(file, rotations, (pct, status) => {
        setProgress(pct);
        setStatusText(status);
      });
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
        summaryText="Orientasi halaman PDF berhasil diperbarui."
        onDownload={() =>
          triggerBlobDownload(resultData.blob, resultData.filename)
        }
        onReset={handleReset}
      />
    );
  }

  const totalPages = pdfDoc?.numPages ?? 0;
  const changedCount = rotations.filter((deg) => deg !== 0).length;

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
            {totalPages} Halaman • {changedCount} Diputar
          </span>
        </>
      }
      sidebarTitle="Putar Semua Halaman"
      sidebarContent={
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Putar seluruh dokumen sekaligus atau arahkan kursor pada tiap
            halaman untuk rotasi individual.
          </p>

          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2"
              onClick={() => rotateAll(90)}
            >
              <RotateCw className="size-4" />
              <span>Putar 90° Searah Jarum Jam</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2"
              onClick={() => rotateAll(-90)}
            >
              <RotateCcw className="size-4" />
              <span>Putar 90° Berlawanan</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2"
              onClick={() => rotateAll(180)}
            >
              <RotateCw className="size-4" />
              <span>Putar 180°</span>
            </Button>
          </div>

          {changedCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setRotations(rotations.map(() => 0))}
            >
              Kembalikan Rotasi Awal
            </Button>
          ) : null}
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => void handleSave()}
        >
          Simpan Perubahan
        </Button>
      }
    >
      {pdfDoc ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: totalPages }, (_, idx) => {
            const pageNum = idx + 1;
            const deg = rotations[idx] ?? 0;

            return (
              <div
                key={pageNum}
                className="flex flex-col rounded-lg border border-border bg-background p-2.5"
              >
                <PdfThumbnail
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  rotation={deg}
                  targetWidth={180}
                />

                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    Hal. {pageNum}
                    {deg !== 0 ? ` (${deg}°)` : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Putar halaman ${pageNum} ke kiri`}
                      onClick={() => rotateSingle(idx, -90)}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Putar halaman ${pageNum} ke kanan`}
                      onClick={() => rotateSingle(idx, 90)}
                    >
                      <RotateCw className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </ToolWorkspace>
  );
}
