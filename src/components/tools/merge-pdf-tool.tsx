"use client";

import * as React from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
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
  getTotalBytes,
  isTotalSizeOverWarningLimit,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import { mergePdfFiles } from "@/lib/pdf/merge";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { getToolBySlug } from "@/lib/tools-config";

interface PdfQueueItem {
  id: string;
  file: File;
  pdfDoc: PDFDocumentProxy;
  pageCount: number;
}

function SortablePdfCard({
  item,
  index,
  onRemove,
}: {
  item: PdfQueueItem;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col rounded-lg border bg-background p-3 transition-shadow ${
        isDragging ? "z-20 border-primary shadow-md" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Geser urutan ${item.file.name}`}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
          <span className="font-mono tabular-nums">#{index + 1}</span>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Hapus ${item.file.name}`}
          onClick={() => onRemove(item.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <PdfThumbnail pdfDoc={item.pdfDoc} pageNumber={1} targetWidth={200} />

      <div className="mt-2.5 min-w-0">
        <p
          className="truncate text-xs font-medium text-foreground"
          title={item.file.name}
        >
          {item.file.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
          {item.pageCount} hal. • {formatBytes(item.file.size)}
        </p>
      </div>
    </div>
  );
}

export function MergePdfTool() {
  const tool = getToolBySlug("gabungkan-pdf");
  const addMoreInputRef = React.useRef<HTMLInputElement>(null);

  const [items, setItems] = React.useState<PdfQueueItem[]>([]);
  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<{
    blob: Blob;
    filename: string;
  } | null>(null);

  const itemsRef = React.useRef<PdfQueueItem[]>([]);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        void disposePdfDocument(item.pdfDoc);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const appendFiles = React.useCallback(async (files: File[]) => {
    const loaded: PdfQueueItem[] = [];
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
        if (isTotalSizeOverWarningLimit(next.map((entry) => entry.file))) {
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
    for (const item of items) {
      void disposePdfDocument(item.pdfDoc);
    }
    setItems([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      toast.error("Tambahkan minimal 2 file PDF untuk digabungkan.");
      return;
    }

    setStage("processing");
    setProgress(5);
    setStatusText("Memulai penggabungan PDF...");

    try {
      const bytes = await mergePdfFiles(
        items.map((item) => item.file),
        (pct, status) => {
          setProgress(pct);
          setStatusText(status);
        }
      );
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      setResultData({ blob, filename: "gabungan.pdf" });
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
        multiple
        onFilesSelected={(files) => void appendFiles(files)}
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
        summaryText={`${items.length} file PDF berhasil digabungkan.`}
        onDownload={() =>
          triggerBlobDownload(resultData.blob, resultData.filename)
        }
        onReset={handleReset}
      />
    );
  }

  const totalPages = items.reduce((sum, item) => sum + item.pageCount, 0);
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
            {items.length} File • {totalPages} Halaman
          </span>
        </>
      }
      sidebarContent={
        <div className="space-y-3 text-sm">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Seret kartu dokumen untuk mengatur urutan penggabungan dari kiri ke
            kanan.
          </p>
          <div className="space-y-1.5 rounded-lg border border-border bg-background p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jumlah file</span>
              <span className="font-mono font-medium tabular-nums">
                {items.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total halaman</span>
              <span className="font-mono font-medium tabular-nums">
                {totalPages}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total ukuran</span>
              <span className="font-mono font-medium tabular-nums">
                {formatBytes(totalSize)}
              </span>
            </div>
          </div>
          {items.length < 2 ? (
            <p className="text-xs text-destructive">
              Tambahkan minimal 1 file PDF lagi untuk mulai menggabungkan.
            </p>
          ) : null}
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={items.length < 2}
          onClick={() => void handleMerge()}
        >
          Gabungkan PDF
        </Button>
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, idx) => (
              <SortablePdfCard
                key={item.id}
                item={item}
                index={idx}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </ToolWorkspace>
  );
}
