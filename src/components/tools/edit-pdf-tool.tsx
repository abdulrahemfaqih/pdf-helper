"use client";

import * as React from "react";
import {
  FolderInput,
  ImagePlus,
  Minus,
  MousePointer2,
  Pen,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/file-dropzone";
import { PdfThumbnail } from "@/components/shared/pdf-thumbnail";
import { ProcessingState } from "@/components/shared/processing-state";
import { ResultState } from "@/components/shared/result-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getReadablePdfError,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import {
  type AnnotationColor,
  type PdfAnnotation,
  flattenEditsToPdf,
  normalizeOverlayImageToDataUrl,
} from "@/lib/pdf/edit";
import { type EditorToolMode, useEditPdfStore } from "@/lib/pdf/edit-store";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { getToolBySlug } from "@/lib/tools-config";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS: Array<{ value: AnnotationColor; label: string }> = [
  { value: "#09090B", label: "Hitam" },
  { value: "#2563EB", label: "Biru" },
  { value: "#DC2626", label: "Merah" },
  { value: "#FFFFFF", label: "Putih" },
];

type DraftOverlay =
  | {
      type: "path";
      points: Array<{ xNorm: number; yNorm: number }>;
    }
  | {
      type: "rect";
      startX: number;
      startY: number;
      currX: number;
      currY: number;
    }
  | {
      type: "line";
      startX: number;
      startY: number;
      currX: number;
      currY: number;
    };

export function EditPdfTool() {
  const tool = getToolBySlug("edit-pdf");
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const insertImageInputRef = React.useRef<HTMLInputElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);
  const [baseSize, setBaseSize] = React.useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });

  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<{
    blob: Blob;
    filename: string;
  } | null>(null);

  const [draft, setDraft] = React.useState<DraftOverlay | null>(null);
  const dragStateRef = React.useRef<{
    id: string;
    startXNorm: number;
    startYNorm: number;
    snapshot: PdfAnnotation[];
    hasMoved: boolean;
  } | null>(null);

  const {
    annotations,
    past,
    future,
    selectedId,
    activeTool,
    activeColor,
    fontSize,
    strokeWidth,
    setActiveTool,
    setActiveColor,
    setFontSize,
    setStrokeWidth,
    setSelectedId,
    addAnnotation,
    updateAnnotation,
    commitSnapshot,
    deleteAnnotation,
    undo,
    redo,
    resetAll,
  } = useEditPdfStore();

  const pdfDocRef = React.useRef<PDFDocumentProxy | null>(null);
  React.useEffect(() => {
    pdfDocRef.current = pdfDoc;
  }, [pdfDoc]);

  React.useEffect(() => {
    return () => {
      void disposePdfDocument(pdfDocRef.current);
      resetAll();
    };
  }, [resetAll]);

  // Render active page onto main interactive canvas
  React.useEffect(() => {
    if (!pdfDoc || stage !== "workspace") return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const canvasEl = canvasRef.current;

    async function renderActivePage() {
      if (!pdfDoc || !canvasEl) return;
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const viewport1x = page.getViewport({ scale: 1 });
        setBaseSize({ width: viewport1x.width, height: viewport1x.height });

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: zoom * dpr });

        canvasEl.width = Math.max(1, Math.floor(viewport.width));
        canvasEl.height = Math.max(1, Math.floor(viewport.height));

        renderTask = page.render({
          canvas: canvasEl,
          viewport,
        });
        await renderTask.promise;
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === "RenderingCancelledException"
        ) {
          return;
        }
      }
    }

    void renderActivePage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [currentPage, pdfDoc, stage, zoom]);

  const loadFile = React.useCallback(
    async (selectedFile: File) => {
      try {
        const nextDoc = await loadPdfJsDocument(selectedFile);
        void disposePdfDocument(pdfDocRef.current);
        resetAll();
        setFile(selectedFile);
        setPdfDoc(nextDoc);
        setCurrentPage(1);
        setZoom(1);
        setResultData(null);
        setStage("workspace");
      } catch (error) {
        toast.error(getReadablePdfError(error));
      }
    },
    [resetAll]
  );

  const handleReset = () => {
    void disposePdfDocument(pdfDoc);
    resetAll();
    setFile(null);
    setPdfDoc(null);
    setCurrentPage(1);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const toNormalizedPoint = (
    clientX: number,
    clientY: number
  ): { xNorm: number; yNorm: number } => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { xNorm: 0.5, yNorm: 0.5 };
    }
    const xNorm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yNorm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { xNorm, yNorm };
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const { xNorm, yNorm } = toNormalizedPoint(event.clientX, event.clientY);

    if (activeTool === "select") {
      setSelectedId(null);
      return;
    }

    if (activeTool === "text") {
      const id = `txt-${crypto.randomUUID()}`;
      addAnnotation({
        id,
        type: "text",
        pageNumber: currentPage,
        xNorm: Math.min(0.85, xNorm),
        yNorm: Math.min(0.92, yNorm),
        text: "Teks Baru",
        fontSize,
        color: activeColor,
      });
      setActiveTool("select");
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (activeTool === "draw") {
      setDraft({ type: "path", points: [{ xNorm, yNorm }] });
    } else if (activeTool === "rect") {
      setDraft({
        type: "rect",
        startX: xNorm,
        startY: yNorm,
        currX: xNorm,
        currY: yNorm,
      });
    } else if (activeTool === "line") {
      setDraft({
        type: "line",
        startX: xNorm,
        startY: yNorm,
        currX: xNorm,
        currY: yNorm,
      });
    }
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const { xNorm, yNorm } = toNormalizedPoint(event.clientX, event.clientY);

    if (dragStateRef.current) {
      const drag = dragStateRef.current;
      const dx = xNorm - drag.startXNorm;
      const dy = yNorm - drag.startYNorm;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        drag.hasMoved = true;
      }
      drag.startXNorm = xNorm;
      drag.startYNorm = yNorm;

      updateAnnotation(drag.id, (prev) => {
        if (prev.type === "text" || prev.type === "rect" || prev.type === "image") {
          return {
            ...prev,
            xNorm: Math.max(0, Math.min(0.98, prev.xNorm + dx)),
            yNorm: Math.max(0, Math.min(0.98, prev.yNorm + dy)),
          };
        }
        if (prev.type === "line") {
          return {
            ...prev,
            x1Norm: prev.x1Norm + dx,
            y1Norm: prev.y1Norm + dy,
            x2Norm: prev.x2Norm + dx,
            y2Norm: prev.y2Norm + dy,
          };
        }
        return {
          ...prev,
          points: prev.points.map((pt) => ({
            xNorm: pt.xNorm + dx,
            yNorm: pt.yNorm + dy,
          })),
        };
      });
      return;
    }

    if (!draft) return;
    if (draft.type === "path") {
      setDraft({ ...draft, points: [...draft.points, { xNorm, yNorm }] });
    } else {
      setDraft({ ...draft, currX: xNorm, currY: yNorm });
    }
  };

  const handleCanvasPointerUp = () => {
    if (dragStateRef.current) {
      if (dragStateRef.current.hasMoved) {
        commitSnapshot(dragStateRef.current.snapshot);
      }
      dragStateRef.current = null;
      return;
    }

    if (!draft) return;

    if (draft.type === "path") {
      if (draft.points.length > 1) {
        addAnnotation({
          id: `path-${crypto.randomUUID()}`,
          type: "path",
          pageNumber: currentPage,
          points: draft.points,
          color: activeColor,
          strokeWidth,
        });
      }
    } else if (draft.type === "rect") {
      const xNorm = Math.min(draft.startX, draft.currX);
      const yNorm = Math.min(draft.startY, draft.currY);
      const widthNorm = Math.abs(draft.currX - draft.startX);
      const heightNorm = Math.abs(draft.currY - draft.startY);
      if (widthNorm > 0.01 && heightNorm > 0.01) {
        addAnnotation({
          id: `rect-${crypto.randomUUID()}`,
          type: "rect",
          pageNumber: currentPage,
          xNorm,
          yNorm,
          widthNorm,
          heightNorm,
          color: activeColor,
          strokeWidth,
        });
      }
    } else if (draft.type === "line") {
      const dist = Math.hypot(
        draft.currX - draft.startX,
        draft.currY - draft.startY
      );
      if (dist > 0.01) {
        addAnnotation({
          id: `line-${crypto.randomUUID()}`,
          type: "line",
          pageNumber: currentPage,
          x1Norm: draft.startX,
          y1Norm: draft.startY,
          x2Norm: draft.currX,
          y2Norm: draft.currY,
          color: activeColor,
          strokeWidth,
        });
      }
    }

    setDraft(null);
  };

  const startAnnotationDrag = (
    event: React.PointerEvent,
    id: string
  ) => {
    if (activeTool !== "select") return;
    event.stopPropagation();
    setSelectedId(id);
    const { xNorm, yNorm } = toNormalizedPoint(event.clientX, event.clientY);
    dragStateRef.current = {
      id,
      startXNorm: xNorm,
      startYNorm: yNorm,
      snapshot: annotations,
      hasMoved: false,
    };
  };

  const handleInsertImageFile = async (imgFile: File) => {
    try {
      const { dataUrl, aspectRatio } =
        await normalizeOverlayImageToDataUrl(imgFile);
      const widthNorm = 0.25;
      const pageAspect = baseSize.width / Math.max(1, baseSize.height);
      const heightNorm = Math.min(0.5, (widthNorm * pageAspect) / aspectRatio);
      addAnnotation({
        id: `img-${crypto.randomUUID()}`,
        type: "image",
        pageNumber: currentPage,
        xNorm: 0.35,
        yNorm: 0.35,
        widthNorm,
        heightNorm,
        dataUrl,
      });
      setActiveTool("select");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyisipkan gambar."
      );
    }
  };

  const handleSavePdf = async () => {
    if (!file) return;
    setStage("processing");
    setProgress(10);
    setStatusText("Menyematkan editan ke dokumen PDF...");

    try {
      const result = await flattenEditsToPdf(
        file,
        annotations,
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
        summaryText={`${annotations.length} elemen anotasi telah digabungkan permanen ke PDF.`}
        onDownload={() =>
          triggerBlobDownload(resultData.blob, resultData.filename)
        }
        onReset={handleReset}
      />
    );
  }

  const pageAnnotations = annotations.filter(
    (item) => item.pageNumber === currentPage
  );
  const selectedAnnotation = annotations.find((item) => item.id === selectedId);
  const displayWidth = Math.round(baseSize.width * zoom);
  const displayHeight = Math.round(baseSize.height * zoom);
  const totalPages = pdfDoc?.numPages ?? 0;

  const toolButtons: Array<{
    mode: EditorToolMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { mode: "select", label: "Pilih / Geser", icon: MousePointer2 },
    { mode: "text", label: "Tambah Teks", icon: Type },
    { mode: "draw", label: "Gambar Bebas / Tanda Tangan", icon: Pen },
    { mode: "rect", label: "Kotak", icon: Square },
    { mode: "line", label: "Garis", icon: Minus },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {toolButtons.map((btn) => {
            const Icon = btn.icon;
            const active = activeTool === btn.mode;
            return (
              <Tooltip key={btn.mode}>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "default" : "ghost"}
                      onClick={() => setActiveTool(btn.mode)}
                      aria-label={btn.label}
                      className="gap-1.5"
                    />
                  }
                >
                  <Icon className="size-4" />
                  <span className="hidden xl:inline">{btn.label}</span>
                </TooltipTrigger>
                <TooltipContent>{btn.label}</TooltipContent>
              </Tooltip>
            );
          })}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => insertImageInputRef.current?.click()}
                  aria-label="Sisipkan Gambar"
                  className="gap-1.5"
                />
              }
            >
              <ImagePlus className="size-4" />
              <span className="hidden xl:inline">Gambar</span>
            </TooltipTrigger>
            <TooltipContent>Sisipkan Gambar (PNG/JPG/WebP)</TooltipContent>
          </Tooltip>
          <input
            ref={insertImageInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) {
                const { valid, rejectedNames } = validateSelectedFiles(
                  [event.target.files[0]],
                  [".png", ".jpg", ".jpeg", ".webp"]
                );
                if (rejectedNames.length > 0) {
                  toast.error("Format gambar harus PNG, JPG, atau WebP.");
                } else if (valid[0]) {
                  void handleInsertImageFile(valid[0]);
                }
                event.target.value = "";
              }
            }}
          />

          <div className="mx-1 h-5 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={past.length === 0}
                  onClick={undo}
                  aria-label="Undo"
                />
              }
            >
              <Undo2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={future.length === 0}
                  onClick={redo}
                  aria-label="Redo"
                />
              }
            >
              <Redo2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Perkecil zoom"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center font-mono text-xs text-muted-foreground tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Perbesar zoom"
            onClick={() => setZoom((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => replaceInputRef.current?.click()}
          >
            <FolderInput className="size-3.5" />
            <span className="hidden sm:inline">Ganti File</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleSavePdf()}
          >
            <Save className="size-3.5" />
            <span>Simpan PDF</span>
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
      </div>

      {/* 3-Pane Editor Layout */}
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {/* Left Thumbnail Sidebar */}
        <aside className="flex max-h-40 gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2.5 lg:max-h-[70vh] lg:w-40 lg:shrink-0 lg:flex-col lg:overflow-y-auto">
          {pdfDoc
            ? Array.from({ length: totalPages }, (_, idx) => {
                const pageNum = idx + 1;
                const isCurrent = pageNum === currentPage;
                const count = annotations.filter(
                  (a) => a.pageNumber === pageNum
                ).length;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => {
                      setCurrentPage(pageNum);
                      setSelectedId(null);
                    }}
                    className={cn(
                      "flex w-24 shrink-0 flex-col rounded-lg border p-1.5 text-left transition-colors lg:w-full",
                      isCurrent
                        ? "border-primary bg-accent-blue"
                        : "border-border bg-background hover:border-border-strong/50"
                    )}
                  >
                    <PdfThumbnail
                      pdfDoc={pdfDoc}
                      pageNumber={pageNum}
                      targetWidth={120}
                    />
                    <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
                      <span>Hal. {pageNum}</span>
                      {count > 0 ? (
                        <span className="font-semibold text-primary">
                          +{count}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            : null}
        </aside>

        {/* Interactive Center Canvas */}
        <div className="flex min-h-[420px] flex-1 items-start justify-center overflow-auto rounded-xl border border-border bg-muted p-4 sm:p-6">
          <div
            ref={overlayRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
            }}
            className={cn(
              "relative shrink-0 select-none border border-border bg-background shadow-sm",
              activeTool === "select" ? "cursor-default" : "cursor-crosshair"
            )}
          >
            <canvas
              ref={canvasRef}
              className="pointer-events-none block h-full w-full"
            />

            {/* Vector Overlay for Paths, Lines, Rects */}
            <svg
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {pageAnnotations.map((ann) => {
                if (ann.type === "path") {
                  const pts = ann.points
                    .map((p) => `${p.xNorm * 1000},${p.yNorm * 1000}`)
                    .join(" ");
                  return (
                    <polyline
                      key={ann.id}
                      points={pts}
                      fill="none"
                      stroke={ann.color}
                      strokeWidth={ann.strokeWidth * 1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={
                        activeTool === "select"
                          ? "pointer-events-auto cursor-move"
                          : undefined
                      }
                      onPointerDown={(e) => startAnnotationDrag(e, ann.id)}
                    />
                  );
                }
                if (ann.type === "line") {
                  return (
                    <line
                      key={ann.id}
                      x1={ann.x1Norm * 1000}
                      y1={ann.y1Norm * 1000}
                      x2={ann.x2Norm * 1000}
                      y2={ann.y2Norm * 1000}
                      stroke={ann.color}
                      strokeWidth={ann.strokeWidth * 1.5}
                      strokeLinecap="round"
                      className={
                        activeTool === "select"
                          ? "pointer-events-auto cursor-move"
                          : undefined
                      }
                      onPointerDown={(e) => startAnnotationDrag(e, ann.id)}
                    />
                  );
                }
                if (ann.type === "rect") {
                  return (
                    <rect
                      key={ann.id}
                      x={ann.xNorm * 1000}
                      y={ann.yNorm * 1000}
                      width={ann.widthNorm * 1000}
                      height={ann.heightNorm * 1000}
                      fill="transparent"
                      stroke={ann.color}
                      strokeWidth={ann.strokeWidth * 1.5}
                      className={
                        activeTool === "select"
                          ? "pointer-events-auto cursor-move"
                          : undefined
                      }
                      onPointerDown={(e) => startAnnotationDrag(e, ann.id)}
                    />
                  );
                }
                return null;
              })}

              {draft?.type === "path" ? (
                <polyline
                  points={draft.points
                    .map((p) => `${p.xNorm * 1000},${p.yNorm * 1000}`)
                    .join(" ")}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={strokeWidth * 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {draft?.type === "rect" ? (
                <rect
                  x={Math.min(draft.startX, draft.currX) * 1000}
                  y={Math.min(draft.startY, draft.currY) * 1000}
                  width={Math.abs(draft.currX - draft.startX) * 1000}
                  height={Math.abs(draft.currY - draft.startY) * 1000}
                  fill="transparent"
                  stroke={activeColor}
                  strokeWidth={strokeWidth * 1.5}
                />
              ) : null}

              {draft?.type === "line" ? (
                <line
                  x1={draft.startX * 1000}
                  y1={draft.startY * 1000}
                  x2={draft.currX * 1000}
                  y2={draft.currY * 1000}
                  stroke={activeColor}
                  strokeWidth={strokeWidth * 1.5}
                  strokeLinecap="round"
                />
              ) : null}
            </svg>

            {/* HTML Overlay for Text & Images */}
            {pageAnnotations.map((ann) => {
              const isSelected = ann.id === selectedId;
              if (ann.type === "text") {
                return (
                  <div
                    key={ann.id}
                    onPointerDown={(e) => startAnnotationDrag(e, ann.id)}
                    style={{
                      left: `${ann.xNorm * 100}%`,
                      top: `${ann.yNorm * 100}%`,
                      color: ann.color,
                      fontSize: `${ann.fontSize * zoom}px`,
                      lineHeight: 1.25,
                    }}
                    className={cn(
                      "absolute whitespace-pre-wrap rounded px-1 py-0.5 font-sans",
                      activeTool === "select" && "cursor-move",
                      isSelected && "ring-1 ring-primary bg-accent-blue/30"
                    )}
                  >
                    {ann.text}
                  </div>
                );
              }
              if (ann.type === "image") {
                return (
                  <div
                    key={ann.id}
                    onPointerDown={(e) => startAnnotationDrag(e, ann.id)}
                    style={{
                      left: `${ann.xNorm * 100}%`,
                      top: `${ann.yNorm * 100}%`,
                      width: `${ann.widthNorm * 100}%`,
                      height: `${ann.heightNorm * 100}%`,
                    }}
                    className={cn(
                      "absolute",
                      activeTool === "select" && "cursor-move",
                      isSelected && "ring-2 ring-primary"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ann.dataUrl}
                      alt="Sisipan gambar"
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>

        {/* Right Contextual Properties Panel */}
        <aside className="w-full shrink-0 rounded-xl border border-border bg-card p-4 lg:w-72">
          <h2 className="border-b border-border pb-2.5 text-sm font-semibold text-foreground">
            Properti Elemen
          </h2>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Warna</Label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((opt) => {
                  const active =
                    (selectedAnnotation &&
                      "color" in selectedAnnotation &&
                      selectedAnnotation.color === opt.value) ||
                    (!selectedAnnotation && activeColor === opt.value);

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      aria-label={`Warna ${opt.label}`}
                      onClick={() => {
                        setActiveColor(opt.value);
                        if (selectedAnnotation && "color" in selectedAnnotation) {
                          updateAnnotation(
                            selectedAnnotation.id,
                            (prev) =>
                              "color" in prev
                                ? { ...prev, color: opt.value }
                                : prev,
                            true
                          );
                        }
                      }}
                      style={{ backgroundColor: opt.value }}
                      className={cn(
                        "size-7 rounded-full border border-border transition-transform",
                        active && "ring-2 ring-primary ring-offset-2"
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {selectedAnnotation?.type === "text" ? (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-text-content" className="text-xs">
                    Isi Teks
                  </Label>
                  <Input
                    id="edit-text-content"
                    value={selectedAnnotation.text}
                    onChange={(e) =>
                      updateAnnotation(selectedAnnotation.id, (prev) =>
                        prev.type === "text"
                          ? { ...prev, text: e.target.value }
                          : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label>Ukuran Font</Label>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {selectedAnnotation.fontSize} px
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={48}
                    step={1}
                    value={[selectedAnnotation.fontSize]}
                    onValueChange={(vals) => {
                      const next = Array.isArray(vals) ? vals[0] : Number(vals);
                      updateAnnotation(selectedAnnotation.id, (prev) =>
                        prev.type === "text" ? { ...prev, fontSize: next } : prev
                      );
                    }}
                  />
                </div>
              </div>
            ) : activeTool === "text" ? (
              <div className="space-y-1.5 border-t border-border pt-3">
                <div className="flex justify-between text-xs">
                  <Label>Ukuran Font Awal</Label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {fontSize} px
                  </span>
                </div>
                <Slider
                  min={10}
                  max={48}
                  step={1}
                  value={[fontSize]}
                  onValueChange={(vals) => {
                    const next = Array.isArray(vals) ? vals[0] : Number(vals);
                    setFontSize(next);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Klik di area halaman PDF untuk menempatkan teks baru.
                </p>
              </div>
            ) : null}

            {selectedAnnotation?.type === "image" ? (
              <div className="space-y-1.5 border-t border-border pt-3">
                <div className="flex justify-between text-xs">
                  <Label>Lebar Gambar</Label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {Math.round(selectedAnnotation.widthNorm * 100)}%
                  </span>
                </div>
                <Slider
                  min={8}
                  max={80}
                  step={1}
                  value={[Math.round(selectedAnnotation.widthNorm * 100)]}
                  onValueChange={(vals) => {
                    const pct = Array.isArray(vals) ? vals[0] : Number(vals);
                    const nextW = pct / 100;
                    updateAnnotation(selectedAnnotation.id, (prev) => {
                      if (prev.type !== "image") return prev;
                      const ratio = prev.heightNorm / Math.max(0.01, prev.widthNorm);
                      return {
                        ...prev,
                        widthNorm: nextW,
                        heightNorm: nextW * ratio,
                      };
                    });
                  }}
                />
              </div>
            ) : null}

            {(selectedAnnotation &&
              (selectedAnnotation.type === "path" ||
                selectedAnnotation.type === "rect" ||
                selectedAnnotation.type === "line")) ||
            activeTool === "draw" ||
            activeTool === "rect" ||
            activeTool === "line" ? (
              <div className="space-y-1.5 border-t border-border pt-3">
                <div className="flex justify-between text-xs">
                  <Label>Ketebalan Garis</Label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {selectedAnnotation && "strokeWidth" in selectedAnnotation
                      ? selectedAnnotation.strokeWidth
                      : strokeWidth}{" "}
                    px
                  </span>
                </div>
                <Slider
                  min={1}
                  max={8}
                  step={1}
                  value={[
                    selectedAnnotation && "strokeWidth" in selectedAnnotation
                      ? selectedAnnotation.strokeWidth
                      : strokeWidth,
                  ]}
                  onValueChange={(vals) => {
                    const next = Array.isArray(vals) ? vals[0] : Number(vals);
                    setStrokeWidth(next);
                    if (
                      selectedAnnotation &&
                      "strokeWidth" in selectedAnnotation
                    ) {
                      updateAnnotation(selectedAnnotation.id, (prev) =>
                        "strokeWidth" in prev
                          ? { ...prev, strokeWidth: next }
                          : prev
                      );
                    }
                  }}
                />
              </div>
            ) : null}

            {selectedAnnotation ? (
              <div className="border-t border-border pt-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => deleteAnnotation(selectedAnnotation.id)}
                >
                  <Trash2 className="size-3.5" />
                  <span>Hapus Elemen Terpilih</span>
                </Button>
              </div>
            ) : (
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                Pilih alat di toolbar atas, lalu klik atau seret pada kanvas
                halaman. Gunakan mode Pilih untuk menggeser atau menghapus
                elemen.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
