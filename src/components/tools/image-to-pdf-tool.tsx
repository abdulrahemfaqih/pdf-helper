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
import { GripVertical, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
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
  revokeObjectUrls,
  triggerBlobDownload,
  validateSelectedFiles,
} from "@/lib/file-utils";
import {
  type ImagePageMargin,
  type ImagePageOrientation,
  type ImagePageSize,
  imagesToPdf,
} from "@/lib/pdf/image-to-pdf";
import { getToolBySlug } from "@/lib/tools-config";

interface ImageQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number;
}

function SortableImageCard({
  item,
  index,
  onRotate,
  onRemove,
}: {
  item: ImageQueueItem;
  index: number;
  onRotate: (id: string) => void;
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
      className={`flex flex-col rounded-lg border bg-background p-2.5 transition-shadow ${
        isDragging ? "z-20 border-primary shadow-md" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Geser gambar ${item.file.name}`}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
          <span className="font-mono tabular-nums">#{index + 1}</span>
        </button>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Putar 90 derajat"
            aria-label={`Putar ${item.file.name}`}
            onClick={() => onRotate(item.id)}
          >
            <RotateCw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Hapus gambar"
            aria-label={`Hapus ${item.file.name}`}
            onClick={() => onRemove(item.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewUrl}
          alt={item.file.name}
          style={{
            transform:
              item.rotation !== 0 ? `rotate(${item.rotation}deg)` : undefined,
          }}
          className="h-full w-full object-contain transition-transform duration-200"
        />
      </div>

      <div className="mt-2 min-w-0">
        <p className="truncate text-xs font-medium text-foreground">
          {item.file.name}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatBytes(item.file.size)}
        </p>
      </div>
    </div>
  );
}

const PAGE_SIZE_LABELS: Record<ImagePageSize, string> = {
  a4: "A4 (Standar)",
  letter: "Letter",
  fit: "Sesuaikan Ukuran Gambar",
};

const ORIENTATION_LABELS: Record<ImagePageOrientation, string> = {
  auto: "Otomatis",
  portrait: "Potret",
  landscape: "Lanskap",
};

const MARGIN_LABELS: Record<ImagePageMargin, string> = {
  none: "Tanpa Margin",
  small: "Margin Kecil",
  large: "Margin Besar",
};

export function ImageToPdfTool() {
  const tool = getToolBySlug("foto-ke-pdf");
  const addMoreInputRef = React.useRef<HTMLInputElement>(null);

  const [items, setItems] = React.useState<ImageQueueItem[]>([]);
  const [pageSize, setPageSize] = React.useState<ImagePageSize>("a4");
  const [orientation, setOrientation] =
    React.useState<ImagePageOrientation>("auto");
  const [margin, setMargin] = React.useState<ImagePageMargin>("small");

  const [stage, setStage] = React.useState<
    "upload" | "workspace" | "processing" | "result"
  >("upload");
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState("Memproses...");
  const [resultData, setResultData] = React.useState<{
    blob: Blob;
    filename: string;
  } | null>(null);

  const itemsRef = React.useRef<ImageQueueItem[]>([]);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    return () => {
      revokeObjectUrls(itemsRef.current.map((item) => item.previewUrl));
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const appendImages = (files: File[]) => {
    const newItems: ImageQueueItem[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
    }));

    setItems((prev) => {
      const next = [...prev, ...newItems];
      if (isTotalSizeOverWarningLimit(next.map((e) => e.file))) {
        toast.warning(
          `Total ukuran gambar (${formatBytes(getTotalBytes(next.map((e) => e.file)))}) melebihi 150 MB.`
        );
      }
      return next;
    });
    setStage("workspace");
  };

  const handleRotate = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, rotation: (item.rotation + 90) % 360 }
          : item
      )
    );
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        setStage("upload");
      }
      return next;
    });
  };

  const handleReset = () => {
    revokeObjectUrls(items.map((item) => item.previewUrl));
    setItems([]);
    setResultData(null);
    setProgress(0);
    setStage("upload");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleCreatePdf = async () => {
    if (items.length === 0) return;
    setStage("processing");
    setProgress(5);
    setStatusText("Menyiapkan gambar...");

    try {
      const result = await imagesToPdf(
        items.map((item) => ({ file: item.file, rotation: item.rotation })),
        { pageSize, orientation, margin },
        (pct, status) => {
          setProgress(pct);
          setStatusText(status);
        }
      );
      setResultData(result);
      setStage("result");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat PDF dari gambar."
      );
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
        onFilesSelected={appendImages}
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
        summaryText={`${items.length} gambar berhasil dikonversi menjadi PDF.`}
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
              <span>Tambah Gambar</span>
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
              accept=".jpg,.jpeg,.png,.webp"
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
                    appendImages(valid);
                  }
                  event.target.value = "";
                }
              }}
            />
          </div>

          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {items.length} Gambar
          </span>
        </>
      }
      sidebarTitle="Pengaturan Halaman"
      sidebarContent={
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Ukuran Halaman</Label>
            <Select
              value={pageSize}
              onValueChange={(val) => setPageSize(String(val) as ImagePageSize)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue>{PAGE_SIZE_LABELS[pageSize]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">{PAGE_SIZE_LABELS.a4}</SelectItem>
                <SelectItem value="letter">{PAGE_SIZE_LABELS.letter}</SelectItem>
                <SelectItem value="fit">{PAGE_SIZE_LABELS.fit}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pageSize !== "fit" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Orientasi</Label>
              <Select
                value={orientation}
                onValueChange={(val) =>
                  setOrientation(String(val) as ImagePageOrientation)
                }
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue>{ORIENTATION_LABELS[orientation]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {ORIENTATION_LABELS.auto}
                  </SelectItem>
                  <SelectItem value="portrait">
                    {ORIENTATION_LABELS.portrait}
                  </SelectItem>
                  <SelectItem value="landscape">
                    {ORIENTATION_LABELS.landscape}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">Margin</Label>
            <Select
              value={margin}
              onValueChange={(val) => setMargin(String(val) as ImagePageMargin)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue>{MARGIN_LABELS[margin]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{MARGIN_LABELS.none}</SelectItem>
                <SelectItem value="small">{MARGIN_LABELS.small}</SelectItem>
                <SelectItem value="large">{MARGIN_LABELS.large}</SelectItem>
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
          onClick={() => void handleCreatePdf()}
        >
          Buat PDF
        </Button>
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, idx) => (
              <SortableImageCard
                key={item.id}
                item={item}
                index={idx}
                onRotate={handleRotate}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </ToolWorkspace>
  );
}
