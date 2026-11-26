"use client";

import type { ResultFileMetric } from "@/components/shared/result-state";
import { getReadablePdfError, stripFileExtension } from "@/lib/file-utils";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { createZipBlob, yieldToMainThread } from "@/lib/pdf/zip";

export type CompressionLevel = "light" | "recommended" | "extreme";

export interface CompressPdfResult {
  blob: Blob;
  filename: string;
  metrics: ResultFileMetric[];
  totalBeforeBytes: number;
  totalAfterBytes: number;
}

const RASTER_PRESETS: Record<
  Exclude<CompressionLevel, "light">,
  { dpi: number; jpegQuality: number }
> = {
  recommended: { dpi: 115, jpegQuality: 0.72 },
  extreme: { dpi: 80, jpegQuality: 0.44 },
};

async function compressSingleLight(file: File): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const pdfDoc = await PDFDocument.load(originalBytes);
  const saved = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
  // Keep original if structural rewrite did not shrink the file
  return saved.byteLength < originalBytes.byteLength ? saved : originalBytes;
}

async function compressSingleRaster(
  file: File,
  preset: { dpi: number; jpegQuality: number },
  onPageProgress: (pageIdx: number, pageCount: number) => void,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await loadPdfJsDocument(file);
  const outDoc = await PDFDocument.create();
  const scale = preset.dpi / 72;

  try {
    const totalPages = pdfDoc.numPages;
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (signal?.aborted) {
        throw new Error("Proses dibatalkan oleh pengguna.");
      }

      onPageProgress(pageNum, totalPages);
      await yieldToMainThread();

      const page = await pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const renderViewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Browser gagal membuat kanvas kompresi.");
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        viewport: renderViewport,
      }).promise;

      const jpegBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", preset.jpegQuality)
      );

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      if (!jpegBlob) {
        throw new Error(`Gagal mengompresi halaman ${pageNum}.`);
      }

      const jpgBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const embedded = await outDoc.embedJpg(jpgBytes);
      const outPage = outDoc.addPage([baseViewport.width, baseViewport.height]);
      outPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });
    }
  } finally {
    await disposePdfDocument(pdfDoc);
  }

  return outDoc.save({ useObjectStreams: true });
}

export async function compressPdfFiles(
  files: File[],
  level: CompressionLevel,
  onProgress?: (percent: number, status: string) => void,
  signal?: AbortSignal
): Promise<CompressPdfResult> {
  if (files.length === 0) {
    throw new Error("Tambahkan minimal 1 file PDF untuk dikompres.");
  }

  const outputs: Array<{ filename: string; bytes: Uint8Array }> = [];
  const metrics: ResultFileMetric[] = [];
  let totalBeforeBytes = 0;
  let totalAfterBytes = 0;

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      throw new Error("Proses dibatalkan oleh pengguna.");
    }

    const file = files[i];
    const baseSliceStart = (i / files.length) * 90;
    const baseSliceSpan = 90 / files.length;

    let compressedBytes: Uint8Array;
    try {
      if (level === "light") {
        onProgress?.(
          Math.round(baseSliceStart),
          `Mengoptimalkan ${file.name} (${i + 1}/${files.length})...`
        );
        await yieldToMainThread();
        compressedBytes = await compressSingleLight(file);
      } else {
        const preset = RASTER_PRESETS[level];
        compressedBytes = await compressSingleRaster(
          file,
          preset,
          (pageNum, totalPages) => {
            const pct =
              baseSliceStart + ((pageNum - 1) / totalPages) * baseSliceSpan;
            onProgress?.(
              Math.round(pct),
              `Mengompres ${file.name}: halaman ${pageNum} dari ${totalPages}...`
            );
          },
          signal
        );
      }
    } catch (error) {
      throw new Error(`${file.name}: ${getReadablePdfError(error)}`);
    }

    const outName = `${stripFileExtension(file.name)}-kompres.pdf`;
    outputs.push({ filename: outName, bytes: compressedBytes });
    metrics.push({
      name: file.name,
      beforeBytes: file.size,
      afterBytes: compressedBytes.byteLength,
    });
    totalBeforeBytes += file.size;
    totalAfterBytes += compressedBytes.byteLength;
  }

  if (outputs.length === 1) {
    onProgress?.(100, "Selesai");
    return {
      blob: new Blob([new Uint8Array(outputs[0].bytes)], {
        type: "application/pdf",
      }),
      filename: outputs[0].filename,
      metrics,
      totalBeforeBytes,
      totalAfterBytes,
    };
  }

  onProgress?.(92, "Mengemas file terkompresi ke ZIP...");
  const zipBlob = await createZipBlob(
    outputs.map((item) => ({ filename: item.filename, data: item.bytes })),
    (zipPct) => {
      onProgress?.(92 + Math.round(zipPct * 0.08), "Mengemas ke arsip ZIP...");
    }
  );
  onProgress?.(100, "Selesai");

  return {
    blob: zipBlob,
    filename: "pdf-terkompres.zip",
    metrics,
    totalBeforeBytes,
    totalAfterBytes,
  };
}
