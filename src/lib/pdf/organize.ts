"use client";

import { getReadablePdfError, stripFileExtension } from "@/lib/file-utils";
import { yieldToMainThread } from "@/lib/pdf/zip";

export interface OrganizedPageRef {
  sourceIndex: number; // Index into sourceFiles[]
  pageNumber: number; // 1-based page number inside that source file
  rotation?: number; // Extra rotation in degrees
}

/** Rebuilds a PDF from an ordered list of page references across one or more source files. */
export async function buildOrganizedPdf(
  sourceFiles: File[],
  pageOrder: OrganizedPageRef[],
  primaryFileName: string,
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; filename: string }> {
  if (pageOrder.length === 0) {
    throw new Error("Minimal harus ada 1 halaman tersisa sebelum menyimpan.");
  }

  const { PDFDocument, degrees } = await import("pdf-lib");
  const loadedDocs = new Map<
    number,
    Awaited<ReturnType<typeof PDFDocument.load>>
  >();

  const uniqueSources = Array.from(
    new Set(pageOrder.map((ref) => ref.sourceIndex))
  );

  for (let i = 0; i < uniqueSources.length; i++) {
    const srcIdx = uniqueSources[i];
    const file = sourceFiles[srcIdx];
    onProgress?.(
      Math.round((i / uniqueSources.length) * 35),
      `Memuat sumber ${file.name}...`
    );
    await yieldToMainThread();

    try {
      const bytes = await file.arrayBuffer();
      loadedDocs.set(srcIdx, await PDFDocument.load(bytes));
    } catch (error) {
      throw new Error(`${file.name}: ${getReadablePdfError(error)}`);
    }
  }

  const outDoc = await PDFDocument.create();

  for (let i = 0; i < pageOrder.length; i++) {
    const ref = pageOrder[i];
    const srcDoc = loadedDocs.get(ref.sourceIndex);
    if (!srcDoc) continue;

    const [copiedPage] = await outDoc.copyPages(srcDoc, [ref.pageNumber - 1]);
    if (ref.rotation && ref.rotation % 360 !== 0) {
      const current = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((((current + ref.rotation) % 360) + 360) % 360));
    }
    outDoc.addPage(copiedPage);

    if (i % 4 === 0) {
      onProgress?.(
        35 + Math.round(((i + 1) / pageOrder.length) * 55),
        `Menyusun halaman ${i + 1} dari ${pageOrder.length}...`
      );
      await yieldToMainThread();
    }
  }

  onProgress?.(95, "Menyimpan PDF baru...");
  const saved = await outDoc.save();
  onProgress?.(100, "Selesai");

  return {
    blob: new Blob([new Uint8Array(saved)], { type: "application/pdf" }),
    filename: `${stripFileExtension(primaryFileName)}-diatur.pdf`,
  };
}
