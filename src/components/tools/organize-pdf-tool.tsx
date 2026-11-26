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
import {
  ArrowLeftRight,
  Copy,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
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
import { buildOrganizedPdf } from "@/lib/pdf/organize";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { getToolBySlug } from "@/lib/tools-config";

interface OrganizedPageItem {
  id: string;
  sourceIndex: number;
  pageNumber: number;
  rotation: number;
}

function SortablePageCard({
  item,
  displayNumber,
  pdfDoc,
  onDuplicate,
  onDelete,
}: {
  item: OrganizedPageItem;
  displayNumber: number;
  pdfDoc: PDFDocumentProxy;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
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
      className={`flex flex-col rounded-lg border bg-background p-2.5 transition-shadow ${
        isDragging ? "z-20 border-primary shadow-md" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Geser halaman ${displayNumber}`}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
          <span className="font-mono tabular-nums">#{displayNumber}</span>
        </button>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Duplikat halaman"
            aria-label={`Duplikat halaman ${displayNumber}`}
            onClick={() => onDuplicate(item.id)}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Hapus halaman"
            aria-label={`Hapus halaman ${displayNumber}`}
            onClick={() => onDelete(item.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <PdfThumbnail
        pdfDoc={pdfDoc}
        pageNumber={item.pageNumber}
        rotation={item.rotation}
        targetWidth={180}
      />

      <span className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
        Asal hal. {item.pageNumber}
      </span>
    </div>
  );
}

export function OrganizePdfTool() {
  const tool = getToolBySlug("atur-pdf");
  const insertPdfInputRef = React.useRef<HTMLInputElement>(null);

  const [sourceFiles, setSourceFiles] = React.useState<File[]>([]);
  const [sourceDocs, setSourceDocs] = React.useState<PDFDocumentProxy[]>([]);
  const [pages, setPages] = React.useState<OrganizedPageItem[]>([]);
  const [history, setHistory] = React.useState<OrganizedPageItem[][]>([]);

  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<{
    blob: Blob;
    filename: string;
  } | null>(null);

  const sourceDocsRef = React.useRef<PDFDocumentProxy[]>([]);
  React.useEffect(() => {
    sourceDocsRef.current = sourceDocs;
  }, [sourceDocs]);

  React.useEffect(() => {
    return () => {
      for (const doc of sourceDocsRef.current) {
        void disposePdfDocument(doc);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const commitPages = React.useCallback(
    (updater: (prev: OrganizedPageItem[]) => OrganizedPageItem[]) => {
      setPages((prev) => {
        const next = updater(prev);
        setHistory((h) => [...h.slice(-29), prev]);
        return next;
      });
    },
    []
  );

  const loadInitialFile = React.useCallback(async (file: File) => {
    try {
      const doc = await loadPdfJsDocument(file);
      for (const prevDoc of sourceDocsRef.current) {
        void disposePdfDocument(prevDoc);
      }
      const initialPages: OrganizedPageItem[] = Array.from(
        { length: doc.numPages },
        (_, idx) => ({
          id: `0-${idx + 1}-${crypto.randomUUID()}`,
          sourceIndex: 0,
          pageNumber: idx + 1,
          rotation: 0,
        })
      );
      setSourceFiles([file]);
      setSourceDocs([doc]);
      setPages(initialPages);
      setHistory([]);
      setResultData(null);
      setStage("workspace");
    } catch (error) {
      toast.error(getReadablePdfError(error));
    }
  }, []);

  const insertAnotherPdf = React.useCallback(
    async (file: File) => {
      try {
        const doc = await loadPdfJsDocument(file);
        const nextSourceIndex = sourceFiles.length;
        const addedPages: OrganizedPageItem[] = Array.from(
          { length: doc.numPages },
          (_, idx) => ({
            id: `${nextSourceIndex}-${idx + 1}-${crypto.randomUUID()}`,
            sourceIndex: nextSourceIndex,
            pageNumber: idx + 1,
            rotation: 0,
          })
        );
        setSourceFiles((prev) => [...prev, file]);
        setSourceDocs((prev) => [...prev, doc]);
        commitPages((prev) => [...prev, ...addedPages]);
        toast.success(`${doc.numPages} halaman dari ${file.name} ditambahkan.`);
      } catch (error) {
        toast.error(getReadablePdfError(error));
      }
    },
    [commitPages, sourceFiles.length]
  );

  const handleReset = () => {
    for (const doc of sourceDocs) {
      void disposePdfDocument(doc);
    }
    setSourceFiles([]);
    setSourceDocs([]);
    setPages([]);
    setHistory([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setPages(previous);
      return prev.slice(0, -1);
    });
  };

  const handleDuplicate = (id: string) => {
    commitPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const clone: OrganizedPageItem = {
        ...prev[idx],
        id: `${prev[idx].sourceIndex}-${prev[idx].pageNumber}-${crypto.randomUUID()}`,
      };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
  };

  const handleDelete = (id: string) => {
    if (pages.length <= 1) {
      toast.error("Dokumen harus memiliki minimal 1 halaman.");
      return;
    }
    commitPages((prev) => prev.filter((p) => p.id !== id));
  };

  const handleReverse = () => {
    commitPages((prev) => [...prev].reverse());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    commitPages((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleSave = async () => {
    if (sourceFiles.length === 0 || pages.length === 0) return;
    setStage("processing");
    setProgress(5);
    setStatusText("Menyusun ulang halaman PDF...");

    try {
      const result = await buildOrganizedPdf(
        sourceFiles,
        pages,
        sourceFiles[0].name,
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
        onFilesSelected={(files) => void loadInitialFile(files[0])}
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
        summaryText={`Dokumen baru berisi ${pages.length} halaman siap diunduh.`}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => insertPdfInputRef.current?.click()}
            >
              <Plus className="size-3.5" />
              <span>Tambah PDF</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={history.length === 0}
              onClick={handleUndo}
            >
              <Undo2 className="size-3.5" />
              <span>Undo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleReverse}
            >
              <ArrowLeftRight className="size-3.5" />
              <span>Urutkan Terbalik</span>
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
              ref={insertPdfInputRef}
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
                    void insertAnotherPdf(valid[0]);
                  }
                  event.target.value = "";
                }
              }}
            />
          </div>

          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {pages.length} Halaman
          </span>
        </>
      }
      sidebarTitle="Ringkasan Halaman"
      sidebarContent={
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Seret halaman untuk mengubah urutan. Anda juga dapat menduplikat,
            menghapus, atau menyisipkan halaman dari PDF lain.
          </p>
          <div className="space-y-1.5 rounded-lg border border-border bg-background p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total halaman aktif</span>
              <span className="font-mono font-medium tabular-nums">
                {pages.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sumber dokumen</span>
              <span className="font-mono font-medium tabular-nums">
                {sourceFiles.length}
              </span>
            </div>
          </div>
        </div>
      }
      sidebarAction={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={pages.length === 0}
          onClick={() => void handleSave()}
        >
          Simpan Perubahan
        </Button>
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pages.map((item, idx) => {
              const doc = sourceDocs[item.sourceIndex];
              if (!doc) return null;
              return (
                <SortablePageCard
                  key={item.id}
                  item={item}
                  displayNumber={idx + 1}
                  pdfDoc={doc}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </ToolWorkspace>
  );
}
