"use client";

import { getReadablePdfError } from "@/lib/file-utils";
import { yieldToMainThread } from "@/lib/pdf/zip";

export async function mergePdfFiles(
  files: File[],
  onProgress?: (percent: number, status: string) => void
): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new Error("Tambahkan minimal 2 file PDF untuk digabungkan.");
  }

  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(
      Math.round((i / files.length) * 90),
      `Membaca file ${i + 1} dari ${files.length}: ${file.name}`
    );
    await yieldToMainThread();

    try {
      const bytes = await file.arrayBuffer();
      const sourceDoc = await PDFDocument.load(bytes);
      const indices = sourceDoc.getPageIndices();
      const copiedPages = await merged.copyPages(sourceDoc, indices);
      for (const page of copiedPages) {
        merged.addPage(page);
      }
    } catch (error) {
      throw new Error(`${file.name}: ${getReadablePdfError(error)}`);
    }
  }

  onProgress?.(95, "Menyusun dokumen akhir...");
  await yieldToMainThread();
  const output = await merged.save();
  onProgress?.(100, "Selesai");
  return output;
}
