"use client";

import * as React from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { cn } from "@/lib/utils";

interface PdfThumbnailProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  rotation?: number;
  targetWidth?: number;
  className?: string;
}

/**
 * Lazily renders a PDF page thumbnail onto a canvas when scrolled near the viewport.
 */
export function PdfThumbnail({
  pdfDoc,
  pageNumber,
  rotation = 0,
  targetWidth = 220,
  className,
}: PdfThumbnailProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [isRendered, setIsRendered] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState<number>(1 / 1.414);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    let activeTask: RenderTask | null = null;
    const canvasEl = canvasRef.current;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (targetWidth * dpr) / baseViewport.width;
        const viewport = page.getViewport({ scale });

        setAspectRatio(baseViewport.width / baseViewport.height);

        if (!canvasEl) return;

        canvasEl.width = Math.floor(viewport.width);
        canvasEl.height = Math.floor(viewport.height);

        activeTask = page.render({
          canvas: canvasEl,
          viewport,
        });

        await activeTask.promise;
        if (!cancelled) {
          setIsRendered(true);
        }
      } catch (err) {
        // Ignore cancelled render tasks on unmount/re-render
        if (
          err instanceof Error &&
          err.name === "RenderingCancelledException"
        ) {
          return;
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (activeTask) {
        activeTask.cancel();
      }
      if (canvasEl) {
        canvasEl.width = 0;
        canvasEl.height = 0;
      }
    };
  }, [isVisible, pageNumber, pdfDoc, targetWidth]);

  const normalizedRotation = ((rotation % 360) + 360) % 360;

  return (
    <div
      ref={containerRef}
      style={{ aspectRatio: String(aspectRatio) }}
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-md border border-border bg-background",
        className
      )}
    >
      {!isRendered ? (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      ) : null}

      <canvas
        ref={canvasRef}
        style={{
          transform:
            normalizedRotation !== 0
              ? `rotate(${normalizedRotation}deg)`
              : undefined,
        }}
        className={cn(
          "h-full w-full object-contain transition-transform duration-200 ease-out",
          isRendered ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
