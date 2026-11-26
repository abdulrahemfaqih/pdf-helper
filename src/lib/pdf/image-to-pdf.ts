"use client";

import { yieldToMainThread } from "@/lib/pdf/zip";

export type ImagePageSize = "a4" | "letter" | "fit";
export type ImagePageOrientation = "auto" | "portrait" | "landscape";
export type ImagePageMargin = "none" | "small" | "large";

export interface ImageInputItem {
  file: File;
  rotation: number; // 0, 90, 180, 270
}

export interface ImagesToPdfOptions {
  pageSize: ImagePageSize;
  orientation: ImagePageOrientation;
  margin: ImagePageMargin;
}

const MARGIN_PT: Record<ImagePageMargin, number> = {
  none: 0,
  small: 24,
  large: 48,
};

/**
 * Decodes JPG/PNG/WebP using createImageBitmap (respecting EXIF orientation),
 * applies user rotation, and encodes into PNG or JPEG bytes compatible with pdf-lib.
 */
async function normalizeImageForPdf(
  file: File,
  rotation: number
): Promise<{ bytes: Uint8Array; format: "png" | "jpg" }> {
  const normalizedRot = ((rotation % 360) + 360) % 360;
  const lowerName = file.name.toLowerCase();
  const isJpeg =
    file.type === "image/jpeg" ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg");
  const isPng = file.type === "image/png" || lowerName.endsWith(".png");

  // Always normalize WebP, rotated images, or JPEGs (for EXIF orientation safety) via canvas
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  try {
    const swapDims = normalizedRot === 90 || normalizedRot === 270;
    const width = swapDims ? bitmap.height : bitmap.width;
    const height = swapDims ? bitmap.width : bitmap.height;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Browser gagal membuat kanvas gambar.");
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);
    if (normalizedRot !== 0) {
      ctx.rotate((normalizedRot * Math.PI) / 180);
    }
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();

    // Preserve alpha as PNG for PNG/WebP; use JPEG for JPEG inputs
    const targetMime = isJpeg && !isPng ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetMime, 0.92)
    );
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) {
      throw new Error(`Gagal memproses gambar ${file.name}.`);
    }

    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      format: targetMime === "image/jpeg" ? "jpg" : "png",
    };
  } finally {
    bitmap.close();
  }
}

export async function imagesToPdf(
  items: ImageInputItem[],
  options: ImagesToPdfOptions,
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; filename: string }> {
  if (items.length === 0) {
    throw new Error("Tambahkan minimal 1 gambar terlebih dahulu.");
  }

  const { PDFDocument, PageSizes } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const margin = MARGIN_PT[options.margin];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(
      Math.round((i / items.length) * 90),
      `Memproses gambar ${i + 1} dari ${items.length}: ${item.file.name}`
    );
    await yieldToMainThread();

    const { bytes, format } = await normalizeImageForPdf(
      item.file,
      item.rotation
    );
    const embedded =
      format === "jpg"
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes);

    const imgW = embedded.width;
    const imgH = embedded.height;

    let pageW: number;
    let pageH: number;

    if (options.pageSize === "fit") {
      pageW = imgW + margin * 2;
      pageH = imgH + margin * 2;
    } else {
      const [baseShort, baseLong] =
        options.pageSize === "letter" ? PageSizes.Letter : PageSizes.A4;
      const useLandscape =
        options.orientation === "landscape" ||
        (options.orientation === "auto" && imgW > imgH);
      pageW = useLandscape ? baseLong : baseShort;
      pageH = useLandscape ? baseShort : baseLong;
    }

    const page = pdfDoc.addPage([pageW, pageH]);
    const availW = Math.max(10, pageW - margin * 2);
    const availH = Math.max(10, pageH - margin * 2);
    const scale = Math.min(availW / imgW, availH / imgH);

    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    page.drawImage(embedded, {
      x,
      y,
      width: drawW,
      height: drawH,
    });
  }

  onProgress?.(95, "Menyusun file PDF...");
  const saved = await pdfDoc.save();
  onProgress?.(100, "Selesai");

  return {
    blob: new Blob([new Uint8Array(saved)], { type: "application/pdf" }),
    filename: "gambar-ke-pdf.pdf",
  };
}
