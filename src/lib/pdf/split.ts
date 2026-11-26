"use client";

import { getReadablePdfError, stripFileExtension } from "@/lib/file-utils";
import { createZipBlob, yieldToMainThread } from "@/lib/pdf/zip";

export type SplitMode = "select" | "range" | "all";

export interface SplitPdfOptions {
  mode: SplitMode;
  selectedPages?: number[]; // 1-based page numbers
  rangeInput?: string;
  mergeRanges?: boolean;
}

export interface SplitPdfResult {
  blob: Blob;
  filename: string;
  fileCount: number;
}

/** Parses expressions like "1-3, 5, 8-10" into validated 1-based page groups. */
export function parsePageRangeGroups(
  input: string,
  totalPages: number
): number[][] {
  const cleaned = input.trim();
  if (!cleaned) {
    throw new Error("Masukkan rentang halaman, contoh: 1-3, 5.");
  }

  const tokens = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error("Format rentang halaman tidak valid.");
  }

  const groups: number[][] = [];

  for (const token of tokens) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
        throw new Error(
          `Rentang "${token}" di luar batas jumlah halaman (1-${totalPages}).`
        );
      }
      if (start > end) {
        throw new Error(
          `Rentang "${token}" tidak valid (halaman awal lebih besar dari akhir).`
        );
      }
      const group: number[] = [];
      for (let p = start; p <= end; p++) {
        group.push(p);
      }
      groups.push(group);
      continue;
    }

    const singleMatch = /^(\d+)$/.exec(token);
    if (singleMatch) {
      const pageNum = Number(singleMatch[1]);
      if (pageNum < 1 || pageNum > totalPages) {
        throw new Error(
          `Halaman ${pageNum} di luar batas jumlah halaman (1-${totalPages}).`
        );
      }
      groups.push([pageNum]);
      continue;
    }

    throw new Error(
      `Format "${token}" tidak dikenali. Gunakan angka atau rentang seperti 1-3, 5.`
    );
  }

  return groups;
}

export async function splitPdfFile(
  file: File,
  options: SplitPdfOptions,
  onProgress?: (percent: number, status: string) => void
): Promise<SplitPdfResult> {
  const { PDFDocument } = await import("pdf-lib");
  const baseName = stripFileExtension(file.name);

  let sourceDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    const bytes = await file.arrayBuffer();
    sourceDoc = await PDFDocument.load(bytes);
  } catch (error) {
    throw new Error(getReadablePdfError(error));
  }

  const totalPages = sourceDoc.getPageCount();
  let pageGroups: number[][] = [];

  if (options.mode === "select") {
    const uniqueSorted = Array.from(new Set(options.selectedPages ?? [])).sort(
      (a, b) => a - b
    );
    if (uniqueSorted.length === 0) {
      throw new Error("Pilih minimal 1 halaman untuk diekstrak.");
    }
    pageGroups = [uniqueSorted];
  } else if (options.mode === "range") {
    const parsed = parsePageRangeGroups(options.rangeInput ?? "", totalPages);
    pageGroups = options.mergeRanges ? [parsed.flat()] : parsed;
  } else {
    pageGroups = Array.from({ length: totalPages }, (_, idx) => [idx + 1]);
  }

  const outputs: Array<{ filename: string; bytes: Uint8Array }> = [];

  for (let i = 0; i < pageGroups.length; i++) {
    const group = pageGroups[i];
    onProgress?.(
      Math.round((i / pageGroups.length) * 85),
      `Membuat file ${i + 1} dari ${pageGroups.length}...`
    );
    await yieldToMainThread();

    const outDoc = await PDFDocument.create();
    const zeroBased = group.map((pageNum) => pageNum - 1);
    const copied = await outDoc.copyPages(sourceDoc, zeroBased);
    for (const page of copied) {
      outDoc.addPage(page);
    }

    const bytes = await outDoc.save();
    const suffix =
      pageGroups.length === 1
        ? "ekstrak"
        : options.mode === "all"
          ? `halaman-${group[0]}`
          : `bagian-${i + 1}`;
    outputs.push({
      filename: `${baseName}-${suffix}.pdf`,
      bytes,
    });
  }

  if (outputs.length === 1) {
    onProgress?.(100, "Selesai");
    const copyBytes = new Uint8Array(outputs[0].bytes);
    return {
      blob: new Blob([copyBytes], { type: "application/pdf" }),
      filename: outputs[0].filename,
      fileCount: 1,
    };
  }

  onProgress?.(90, "Mengemas ke arsip ZIP...");
  const zipBlob = await createZipBlob(
    outputs.map((item) => ({ filename: item.filename, data: item.bytes })),
    (zipPct) => {
      onProgress?.(90 + Math.round(zipPct * 0.1), "Mengemas ke arsip ZIP...");
    }
  );
  onProgress?.(100, "Selesai");

  return {
    blob: zipBlob,
    filename: `${baseName}-terpisah.zip`,
    fileCount: outputs.length,
  };
}
