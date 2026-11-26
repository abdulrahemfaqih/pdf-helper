"use client";

import { getReadablePdfError, stripFileExtension } from "@/lib/file-utils";
import { yieldToMainThread } from "@/lib/pdf/zip";

export type AnnotationColor = "#09090B" | "#2563EB" | "#DC2626" | "#FFFFFF";

export interface TextAnnotation {
  id: string;
  type: "text";
  pageNumber: number;
  xNorm: number; // Top-left X normalized [0..1] in visual viewport
  yNorm: number; // Top-left Y normalized [0..1] in visual viewport
  text: string;
  fontSize: number; // In CSS pixels at 1x PDF point scale (1pt = 1px at scale 1)
  color: AnnotationColor;
}

export interface FreehandAnnotation {
  id: string;
  type: "path";
  pageNumber: number;
  points: Array<{ xNorm: number; yNorm: number }>;
  color: AnnotationColor;
  strokeWidth: number;
}

export interface RectAnnotation {
  id: string;
  type: "rect";
  pageNumber: number;
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
  color: AnnotationColor;
  strokeWidth: number;
}

export interface LineAnnotation {
  id: string;
  type: "line";
  pageNumber: number;
  x1Norm: number;
  y1Norm: number;
  x2Norm: number;
  y2Norm: number;
  color: AnnotationColor;
  strokeWidth: number;
}

export interface ImageAnnotation {
  id: string;
  type: "image";
  pageNumber: number;
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
  dataUrl: string; // PNG or JPEG data URL
}

export type PdfAnnotation =
  | TextAnnotation
  | FreehandAnnotation
  | RectAnnotation
  | LineAnnotation
  | ImageAnnotation;

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Projects a normalized visual viewport point (origin top-left, 0..1)
 * onto unrotated PDF user space accounting for CropBox and /Rotate (0/90/180/270).
 */
function projectPointToPdf(
  nx: number,
  ny: number,
  cropBox: CropBox,
  rotationDeg: number
): { x: number; y: number } {
  const rot = ((rotationDeg % 360) + 360) % 360;
  if (rot === 90) {
    return {
      x: cropBox.x + ny * cropBox.width,
      y: cropBox.y + nx * cropBox.height,
    };
  }
  if (rot === 180) {
    return {
      x: cropBox.x + (1 - nx) * cropBox.width,
      y: cropBox.y + ny * cropBox.height,
    };
  }
  if (rot === 270) {
    return {
      x: cropBox.x + (1 - ny) * cropBox.width,
      y: cropBox.y + (1 - nx) * cropBox.height,
    };
  }
  return {
    x: cropBox.x + nx * cropBox.width,
    y: cropBox.y + (1 - ny) * cropBox.height,
  };
}

/** Normalizes any uploaded image (including .webp) into PNG bytes for pdf-lib embedding. */
export async function normalizeOverlayImageToDataUrl(
  file: File
): Promise<{ dataUrl: string; aspectRatio: number }> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Browser gagal memproses gambar.");
    }
    ctx.drawImage(bitmap, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const aspectRatio = bitmap.width / Math.max(1, bitmap.height);
    canvas.width = 0;
    canvas.height = 0;
    return { dataUrl, aspectRatio };
  } finally {
    bitmap.close();
  }
}

async function dataUrlToBytes(
  dataUrl: string
): Promise<{ bytes: Uint8Array; isJpg: boolean }> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const isJpg = blob.type === "image/jpeg";
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    isJpg,
  };
}

export async function flattenEditsToPdf(
  file: File,
  annotations: PdfAnnotation[],
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; filename: string }> {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import("pdf-lib");

  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    const bytes = await file.arrayBuffer();
    pdfDoc = await PDFDocument.load(bytes);
  } catch (error) {
    throw new Error(getReadablePdfError(error));
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    const page = pages[ann.pageNumber - 1];
    if (!page) continue;

    if (i % 5 === 0) {
      onProgress?.(
        Math.round((i / Math.max(1, annotations.length)) * 85),
        `Menyematkan anotasi ${i + 1} dari ${annotations.length}...`
      );
      await yieldToMainThread();
    }

    const cropBox = page.getCropBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const visualWidthPt =
      rot === 90 || rot === 270 ? cropBox.height : cropBox.width;
    const visualHeightPt =
      rot === 90 || rot === 270 ? cropBox.width : cropBox.height;

    if (ann.type === "text") {
      const [r, g, b] = hexToRgbTuple(ann.color);
      const lines = ann.text.split("\n");
      const lineHeightPt = ann.fontSize * 1.25;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx];
        if (!lineText) continue;
        // Shift from visual top-left down to baseline of each line
        const nyBaseline =
          ann.yNorm +
          (ann.fontSize * 0.85 + lineIdx * lineHeightPt) / visualHeightPt;
        const pos = projectPointToPdf(ann.xNorm, nyBaseline, cropBox, rot);
        page.drawText(lineText, {
          x: pos.x,
          y: pos.y,
          size: ann.fontSize,
          font,
          color: rgb(r, g, b),
          rotate: degrees(rot),
        });
      }
      continue;
    }

    if (ann.type === "line") {
      const [r, g, b] = hexToRgbTuple(ann.color);
      const start = projectPointToPdf(ann.x1Norm, ann.y1Norm, cropBox, rot);
      const end = projectPointToPdf(ann.x2Norm, ann.y2Norm, cropBox, rot);
      page.drawLine({
        start,
        end,
        thickness: ann.strokeWidth,
        color: rgb(r, g, b),
      });
      continue;
    }

    if (ann.type === "path") {
      const [r, g, b] = hexToRgbTuple(ann.color);
      for (let p = 1; p < ann.points.length; p++) {
        const prevPt = projectPointToPdf(
          ann.points[p - 1].xNorm,
          ann.points[p - 1].yNorm,
          cropBox,
          rot
        );
        const currPt = projectPointToPdf(
          ann.points[p].xNorm,
          ann.points[p].yNorm,
          cropBox,
          rot
        );
        page.drawLine({
          start: prevPt,
          end: currPt,
          thickness: ann.strokeWidth,
          color: rgb(r, g, b),
        });
      }
      continue;
    }

    if (ann.type === "rect") {
      const [r, g, b] = hexToRgbTuple(ann.color);
      const bottomLeft = projectPointToPdf(
        ann.xNorm,
        ann.yNorm + ann.heightNorm,
        cropBox,
        rot
      );
      page.drawRectangle({
        x: bottomLeft.x,
        y: bottomLeft.y,
        width: ann.widthNorm * visualWidthPt,
        height: ann.heightNorm * visualHeightPt,
        borderColor: rgb(r, g, b),
        borderWidth: ann.strokeWidth,
        rotate: degrees(rot),
      });
      continue;
    }

    if (ann.type === "image") {
      const { bytes, isJpg } = await dataUrlToBytes(ann.dataUrl);
      const embedded = isJpg
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes);
      const bottomLeft = projectPointToPdf(
        ann.xNorm,
        ann.yNorm + ann.heightNorm,
        cropBox,
        rot
      );
      page.drawImage(embedded, {
        x: bottomLeft.x,
        y: bottomLeft.y,
        width: ann.widthNorm * visualWidthPt,
        height: ann.heightNorm * visualHeightPt,
        rotate: degrees(rot),
      });
    }
  }

  onProgress?.(94, "Menyimpan PDF final...");
  const saved = await pdfDoc.save();
  onProgress?.(100, "Selesai");

  return {
    blob: new Blob([new Uint8Array(saved)], { type: "application/pdf" }),
    filename: `${stripFileExtension(file.name)}-diedit.pdf`,
  };
}
