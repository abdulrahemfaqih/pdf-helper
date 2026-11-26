"use client";

import { getReadablePdfError, stripFileExtension } from "@/lib/file-utils";
import { yieldToMainThread } from "@/lib/pdf/zip";

/** Rotates each page by the provided delta degrees (0, 90, 180, 270). */
export async function rotatePdfPages(
  file: File,
  rotationsByPageIndex: number[],
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; filename: string }> {
  const { PDFDocument, degrees } = await import("pdf-lib");

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    const bytes = await file.arrayBuffer();
    pdfDoc = await PDFDocument.load(bytes);
  } catch (error) {
    throw new Error(getReadablePdfError(error));
  }

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const delta = rotationsByPageIndex[i] ?? 0;
    if (delta !== 0) {
      const currentAngle = pages[i].getRotation().angle;
      const nextAngle = (((currentAngle + delta) % 360) + 360) % 360;
      pages[i].setRotation(degrees(nextAngle));
    }
    if (i % 5 === 0) {
      onProgress?.(
        Math.round(((i + 1) / pages.length) * 85),
        `Memutar halaman ${i + 1} dari ${pages.length}...`
      );
      await yieldToMainThread();
    }
  }

  onProgress?.(95, "Menyimpan perubahan...");
  const saved = await pdfDoc.save();
  onProgress?.(100, "Selesai");

  return {
    blob: new Blob([new Uint8Array(saved)], { type: "application/pdf" }),
    filename: `${stripFileExtension(file.name)}-diputar.pdf`,
  };
}
