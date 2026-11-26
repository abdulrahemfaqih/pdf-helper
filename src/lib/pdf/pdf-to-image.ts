"use client";

import { stripFileExtension } from "@/lib/file-utils";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { createZipBlob, yieldToMainThread } from "@/lib/pdf/zip";

export type ImageExportFormat = "jpg" | "png";
export type ImageExportDpi = 150 | 300;

export interface PdfToImageOptions {
  format: ImageExportFormat;
  dpi: ImageExportDpi;
  pageNumbers: number[]; // 1-based
}

export interface PdfToImageResult {
  blob: Blob;
  filename: string;
  imageCount: number;
}

export async function convertPdfToImages(
  file: File,
  options: PdfToImageOptions,
  onProgress?: (percent: number, status: string) => void,
  signal?: AbortSignal
): Promise<PdfToImageResult> {
  if (options.pageNumbers.length === 0) {
    throw new Error("Pilih minimal 1 halaman untuk dikonversi.");
  }

  const baseName = stripFileExtension(file.name);
  const pdfDoc = await loadPdfJsDocument(file);
  const sortedPages = Array.from(new Set(options.pageNumbers)).sort(
    (a, b) => a - b
  );
  const scale = options.dpi / 72;
  const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
  const quality = options.format === "jpg" ? 0.92 : undefined;
  const ext = options.format;

  const outputs: Array<{ filename: string; blob: Blob }> = [];

  try {
    for (let i = 0; i < sortedPages.length; i++) {
      if (signal?.aborted) {
        throw new Error("Proses dibatalkan oleh pengguna.");
      }

      const pageNum = sortedPages[i];
      onProgress?.(
        Math.round((i / sortedPages.length) * 88),
        `Merender halaman ${pageNum} (${i + 1} dari ${sortedPages.length})...`
      );
      await yieldToMainThread();

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Browser gagal membuat kanvas rendering.");
      }

      if (options.format === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({
        canvas,
        viewport,
      }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, quality)
      );

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      if (!blob) {
        throw new Error(`Gagal mengekspor halaman ${pageNum}.`);
      }

      const padded = String(pageNum).padStart(
        String(pdfDoc.numPages).length,
        "0"
      );
      outputs.push({
        filename: `${baseName}-hal-${padded}.${ext}`,
        blob,
      });
    }
  } finally {
    await disposePdfDocument(pdfDoc);
  }

  if (outputs.length === 1) {
    onProgress?.(100, "Selesai");
    return {
      blob: outputs[0].blob,
      filename: outputs[0].filename,
      imageCount: 1,
    };
  }

  onProgress?.(90, "Mengemas gambar ke arsip ZIP...");
  const zipBlob = await createZipBlob(
    outputs.map((item) => ({ filename: item.filename, data: item.blob })),
    (zipPct) => {
      onProgress?.(90 + Math.round(zipPct * 0.1), "Mengemas gambar ke arsip ZIP...");
    }
  );
  onProgress?.(100, "Selesai");

  return {
    blob: zipBlob,
    filename: `${baseName}-gambar.zip`,
    imageCount: outputs.length,
  };
}
