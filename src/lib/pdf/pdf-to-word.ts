"use client";

import type { PDFPageProxy } from "pdfjs-dist";
import type { FileChild } from "docx";
import { stripFileExtension } from "@/lib/file-utils";
import { disposePdfDocument, loadPdfJsDocument } from "@/lib/pdf/pdfjs-worker";
import { yieldToMainThread } from "@/lib/pdf/zip";

interface ExtractedTextToken {
  str: string;
  x: number; // Left X in viewport points
  yTop: number; // Top Y in viewport points
  yBottom: number; // Bottom Y in viewport points
  width: number;
  height: number;
  fontSize: number;
  fontFamily: "Calibri" | "Times New Roman" | "Consolas";
  isBold: boolean;
  isItalic: boolean;
  colorHex: string;
  linkUrl?: string;
}

interface ExtractedImage {
  id: string;
  x: number;
  yTop: number;
  widthPt: number;
  heightPt: number;
  pngBytes: Uint8Array;
}

interface ExtractedHorizontalRule {
  yTop: number;
  xStart: number;
  xEnd: number;
  thicknessPt: number;
  colorHex: string;
}

interface LinkAnnotationBox {
  url: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ColorOpAnchor {
  x: number;
  yTop: number;
  colorHex: string;
}

interface VisualLineSegment {
  tokens: ExtractedTextToken[];
  xStart: number;
  xEnd: number;
}

interface VisualLine {
  yTop: number;
  yBottom: number;
  height: number;
  xStart: number;
  xEnd: number;
  segments: VisualLineSegment[];
  plainText: string;
  isBoldDominant: boolean;
  dominantFontSize: number;
}

const BULLET_PREFIX_RE = /^([\u2022\u25CF\u25CB\u25E6\u25AA\u25AB\u25A0\u25A1\u25C6\u25C7\u2023\u2043•●○▪▫■□◆◇‣⁃*\-–])\s+(.*)$/;
const STANDALONE_BULLET_RE = /^[\u2022\u25CF\u25CB\u25E6\u25AA\u25AB\u25A0\u25A1\u25C6\u25C7\u2023\u2043•●○▪▫■□◆◇‣⁃*\-–]$/;

const DRAW_OPS = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4,
} as const;

function multiplyMatrices(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrixToPoint(
  x: number,
  y: number,
  m: number[]
): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseColorArgToHex(arg: unknown, opType: "rgb" | "gray" | "cmyk"): string | null {
  if (typeof arg === "string") {
    const clean = arg.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      return clean.slice(1).toUpperCase();
    }
    if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
      const r = clean[1];
      const g = clean[2];
      const b = clean[3];
      return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(clean);
    if (rgbMatch) {
      return [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
        .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    }
  }

  if (Array.isArray(arg) || arg instanceof Uint8ClampedArray || arg instanceof Uint8Array) {
    const arr = Array.from(arg as ArrayLike<number>);
    if (opType === "gray" && arr.length >= 1) {
      const g = arr[0] <= 1 ? Math.round(arr[0] * 255) : Math.round(arr[0]);
      const hex = Math.max(0, Math.min(255, g)).toString(16).padStart(2, "0").toUpperCase();
      return `${hex}${hex}${hex}`;
    }
    if (opType === "rgb" && arr.length >= 3) {
      const scale = arr[0] <= 1 && arr[1] <= 1 && arr[2] <= 1 ? 255 : 1;
      return [arr[0], arr[1], arr[2]]
        .map((v) =>
          Math.max(0, Math.min(255, Math.round(v * scale)))
            .toString(16)
            .padStart(2, "0")
        )
        .join("")
        .toUpperCase();
    }
    if (opType === "cmyk" && arr.length >= 4) {
      const [c, m, y, k] = arr.map((v) => (v > 1 ? v / 100 : v));
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      return [r, g, b]
        .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    }
  }

  if (typeof arg === "number" && opType === "gray") {
    const g = arg <= 1 ? Math.round(arg * 255) : Math.round(arg);
    const hex = Math.max(0, Math.min(255, g)).toString(16).padStart(2, "0").toUpperCase();
    return `${hex}${hex}${hex}`;
  }

  return null;
}

interface PdfFontDescriptor {
  name?: string;
  bold?: boolean;
  italic?: boolean;
}

function classifyFont(
  fontObj: PdfFontDescriptor | null | undefined,
  styleFamily: string | undefined
): {
  fontFamily: "Calibri" | "Times New Roman" | "Consolas";
  isBold: boolean;
  isItalic: boolean;
} {
  const combined = `${fontObj?.name ?? ""} ${styleFamily ?? ""}`.toLowerCase();

  const isBold =
    Boolean(fontObj?.bold) ||
    /(bold|black|heavy|semibold|demi|extrabold|medi|\b[bd]x\d|[-_,]b\b)/i.test(
      combined
    );
  const isItalic =
    Boolean(fontObj?.italic) ||
    /(italic|oblique|slant|[-_,]bi\b|[-_,]it\b)/i.test(combined);

  let fontFamily: "Calibri" | "Times New Roman" | "Consolas" = "Calibri";
  if (/mono|courier|consolas|menlo|fira.?code|jetbrains/i.test(combined)) {
    fontFamily = "Consolas";
  } else if (
    /times|georgia|garamond|palatino|cambria|\bserif\b/i.test(combined) &&
    !/sans/i.test(combined)
  ) {
    fontFamily = "Times New Roman";
  }

  return { fontFamily, isBold, isItalic };
}

interface PdfImageObjectData {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8ClampedArray | Uint8Array;
  bitmap?: ImageBitmap;
}

async function resolvePageObject<T>(
  store: { has: (id: string) => boolean; get: (id: string, cb?: (val: T) => void) => T },
  objId: string
): Promise<T | null> {
  try {
    if (store.has(objId)) {
      return store.get(objId);
    }
    return await new Promise<T | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), 400);
      try {
        store.get(objId, (data: T) => {
          window.clearTimeout(timer);
          resolve(data);
        });
      } catch {
        window.clearTimeout(timer);
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function pdfImageDataToPngBytes(
  imgData: PdfImageObjectData,
  imageKinds: { GRAYSCALE_1BPP: number; RGB_24BPP: number; RGBA_32BPP: number }
): Promise<Uint8Array | null> {
  const { width, height } = imgData;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    if (imgData.bitmap) {
      ctx.drawImage(imgData.bitmap, 0, 0, width, height);
    } else if (imgData.data) {
      const rgba = new Uint8ClampedArray(width * height * 4);
      const src = imgData.data;

      if (imgData.kind === imageKinds.RGBA_32BPP || src.length === width * height * 4) {
        rgba.set(src.subarray(0, rgba.length));
      } else if (imgData.kind === imageKinds.RGB_24BPP || src.length === width * height * 3) {
        for (let s = 0, d = 0; s < width * height * 3; s += 3, d += 4) {
          rgba[d] = src[s];
          rgba[d + 1] = src[s + 1];
          rgba[d + 2] = src[s + 2];
          rgba[d + 3] = 255;
        }
      } else if (imgData.kind === imageKinds.GRAYSCALE_1BPP) {
        const bytesPerRow = Math.ceil(width / 8);
        for (let row = 0; row < height; row++) {
          for (let col = 0; col < width; col++) {
            const byteVal = src[row * bytesPerRow + (col >> 3)] ?? 0;
            const bit = (byteVal >> (7 - (col & 7))) & 1;
            const c = bit ? 255 : 0;
            const idx = (row * width + col) * 4;
            rgba[idx] = c;
            rgba[idx + 1] = c;
            rgba[idx + 2] = c;
            rgba[idx + 3] = 255;
          }
        }
      } else {
        // Fallback grayscale 8bpp
        for (let i = 0; i < width * height; i++) {
          const g = src[i] ?? 255;
          const idx = i * 4;
          rgba[idx] = g;
          rgba[idx + 1] = g;
          rgba[idx + 2] = g;
          rgba[idx + 3] = 255;
        }
      }

      const imageData = new ImageData(rgba, width, height);
      ctx.putImageData(imageData, 0, 0);
    } else {
      return null;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function pumpPageObjectsIfNeeded(page: PDFPageProxy): Promise<void> {
  const viewport = page.getViewport({ scale: 0.2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  try {
    await page.render({ canvas, viewport }).promise;
  } catch {
    // Ignore render issues during object pumping
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function normalizeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return undefined;
}

async function extractPageScene(page: PDFPageProxy): Promise<{
  pageWidthPt: number;
  pageHeightPt: number;
  tokens: ExtractedTextToken[];
  images: ExtractedImage[];
  rules: ExtractedHorizontalRule[];
}> {
  const pdfjs = await import("pdfjs-dist");
  const { OPS, ImageKind } = pdfjs;
  const viewport = page.getViewport({ scale: 1 });
  const vpMatrix = viewport.transform;

  const opList = await page.getOperatorList();

  // Pump lightweight offscreen render so both page.objs (images) and page.commonObjs (fonts) resolve
  await pumpPageObjectsIfNeeded(page);

  const [textContent, annotations] = await Promise.all([
    page.getTextContent(),
    page.getAnnotations().catch(() => [] as Array<Record<string, unknown>>),
  ]);

  // Extract link annotation bounding boxes in viewport coordinates
  const linkBoxes: LinkAnnotationBox[] = [];
  for (const annot of annotations) {
    if (annot?.subtype !== "Link") continue;
    const url = normalizeUrl(annot.url ?? annot.unsafeUrl);
    const rect = annot.rect;
    if (!url || !Array.isArray(rect) || rect.length < 4) continue;
    const p1 = applyMatrixToPoint(Number(rect[0]), Number(rect[1]), vpMatrix);
    const p2 = applyMatrixToPoint(Number(rect[2]), Number(rect[3]), vpMatrix);
    linkBoxes.push({
      url,
      x1: Math.min(p1[0], p2[0]) - 2,
      y1: Math.min(p1[1], p2[1]) - 2,
      x2: Math.max(p1[0], p2[0]) + 2,
      y2: Math.max(p1[1], p2[1]) + 2,
    });
  }

  // Walk graphics operators for images, horizontal rules, and text fill color anchors
  const images: ExtractedImage[] = [];
  const rules: ExtractedHorizontalRule[] = [];
  const colorAnchors: ColorOpAnchor[] = [];

  interface GraphicsState {
    ctm: number[];
    fillHex: string;
    strokeHex: string;
    lineWidth: number;
  }

  const stateStack: GraphicsState[] = [];
  let state: GraphicsState = {
    ctm: [1, 0, 0, 1, 0, 0],
    fillHex: "111827",
    strokeHex: "111827",
    lineWidth: 1,
  };
  let textMatrix = [1, 0, 0, 1, 0, 0];
  let textLineMatrix = [1, 0, 0, 1, 0, 0];
  let textLeading = 0;

  const seenImageKeys = new Set<string>();

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] ?? [];

    if (fn === OPS.save) {
      stateStack.push({ ...state, ctm: [...state.ctm] });
      continue;
    }
    if (fn === OPS.restore) {
      const prev = stateStack.pop();
      if (prev) state = prev;
      continue;
    }
    if (fn === OPS.paintFormXObjectBegin) {
      stateStack.push({ ...state, ctm: [...state.ctm] });
      const mat = args[0];
      if (Array.isArray(mat) && mat.length >= 6) {
        state.ctm = multiplyMatrices(state.ctm, mat.slice(0, 6).map(Number));
      }
      continue;
    }
    if (fn === OPS.paintFormXObjectEnd) {
      const prev = stateStack.pop();
      if (prev) state = prev;
      continue;
    }
    if (fn === OPS.transform && args.length >= 6) {
      state.ctm = multiplyMatrices(state.ctm, [
        Number(args[0]),
        Number(args[1]),
        Number(args[2]),
        Number(args[3]),
        Number(args[4]),
        Number(args[5]),
      ]);
      continue;
    }
    if (fn === OPS.setLineWidth && typeof args[0] === "number") {
      state.lineWidth = args[0];
      continue;
    }

    if (fn === OPS.setFillRGBColor) {
      state.fillHex = parseColorArgToHex(args[0] ?? args, "rgb") ?? state.fillHex;
      continue;
    }
    if (fn === OPS.setFillGray) {
      state.fillHex = parseColorArgToHex(args[0], "gray") ?? state.fillHex;
      continue;
    }
    if (fn === OPS.setFillCMYKColor) {
      state.fillHex = parseColorArgToHex(args, "cmyk") ?? state.fillHex;
      continue;
    }
    if (fn === OPS.setStrokeRGBColor) {
      state.strokeHex = parseColorArgToHex(args[0] ?? args, "rgb") ?? state.strokeHex;
      continue;
    }
    if (fn === OPS.setStrokeGray) {
      state.strokeHex = parseColorArgToHex(args[0], "gray") ?? state.strokeHex;
      continue;
    }
    if (fn === OPS.setStrokeCMYKColor) {
      state.strokeHex = parseColorArgToHex(args, "cmyk") ?? state.strokeHex;
      continue;
    }

    // Track text positions for fill color attribution
    if (fn === OPS.beginText) {
      textMatrix = [1, 0, 0, 1, 0, 0];
      textLineMatrix = [1, 0, 0, 1, 0, 0];
      continue;
    }
    if (fn === OPS.setTextMatrix && args.length >= 6) {
      textMatrix = args.slice(0, 6).map(Number);
      textLineMatrix = [...textMatrix];
      continue;
    }
    if (fn === OPS.setLeading && typeof args[0] === "number") {
      textLeading = args[0];
      continue;
    }
    if (fn === OPS.moveText && args.length >= 2) {
      textLineMatrix = multiplyMatrices(textLineMatrix, [
        1,
        0,
        0,
        1,
        Number(args[0]),
        Number(args[1]),
      ]);
      textMatrix = [...textLineMatrix];
      continue;
    }
    if (fn === OPS.setLeadingMoveText && args.length >= 2) {
      textLeading = -Number(args[1]);
      textLineMatrix = multiplyMatrices(textLineMatrix, [
        1,
        0,
        0,
        1,
        Number(args[0]),
        Number(args[1]),
      ]);
      textMatrix = [...textLineMatrix];
      continue;
    }
    if (fn === OPS.nextLine) {
      textLineMatrix = multiplyMatrices(textLineMatrix, [1, 0, 0, 1, 0, -textLeading]);
      textMatrix = [...textLineMatrix];
      continue;
    }
    if (
      fn === OPS.nextLineShowText ||
      fn === OPS.nextLineSetSpacingShowText
    ) {
      textLineMatrix = multiplyMatrices(textLineMatrix, [1, 0, 0, 1, 0, -textLeading]);
      textMatrix = [...textLineMatrix];
      const combined = multiplyMatrices(vpMatrix, multiplyMatrices(state.ctm, textMatrix));
      colorAnchors.push({
        x: combined[4],
        yTop: combined[5],
        colorHex: state.fillHex,
      });
      continue;
    }
    if (fn === OPS.showText || fn === OPS.showSpacedText) {
      const combined = multiplyMatrices(vpMatrix, multiplyMatrices(state.ctm, textMatrix));
      colorAnchors.push({
        x: combined[4],
        yTop: combined[5],
        colorHex: state.fillHex,
      });
      continue;
    }

    // Detect horizontal rules from constructPath
    if (fn === OPS.constructPath) {
      const paintOp = args[0] as number;
      const pathData = (args[1] as number[] | undefined)?.[0] ?? args[1];
      const minMax = args[2] as number[] | undefined;

      const isStroke =
        paintOp === OPS.stroke ||
        paintOp === OPS.closeStroke ||
        paintOp === OPS.fillStroke ||
        paintOp === OPS.eoFillStroke ||
        paintOp === OPS.closeFillStroke ||
        paintOp === OPS.closeEOFillStroke;
      const isFill =
        paintOp === OPS.fill ||
        paintOp === OPS.eoFill ||
        paintOp === OPS.fillStroke ||
        paintOp === OPS.eoFillStroke ||
        paintOp === OPS.closeFillStroke ||
        paintOp === OPS.closeEOFillStroke;

      if (minMax && minMax.length >= 4 && (isStroke || isFill)) {
        const fullMatrix = multiplyMatrices(vpMatrix, state.ctm);
        const corners = [
          applyMatrixToPoint(minMax[0], minMax[1], fullMatrix),
          applyMatrixToPoint(minMax[2], minMax[1], fullMatrix),
          applyMatrixToPoint(minMax[0], minMax[3], fullMatrix),
          applyMatrixToPoint(minMax[2], minMax[3], fullMatrix),
        ];
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const boxW = maxX - minX;
        const boxH = maxY - minY;

        // Horizontal stroke line or thin horizontal filled rectangle
        if (boxW >= 40 && boxH <= 4.5 && minY >= 0 && maxY <= viewport.height) {
          const ruleColor = isFill ? state.fillHex : state.strokeHex;
          // Skip invisible white rules
          if (ruleColor !== "FFFFFF") {
            rules.push({
              yTop: (minY + maxY) / 2,
              xStart: minX,
              xEnd: maxX,
              thicknessPt: Math.max(0.75, isFill ? boxH : state.lineWidth),
              colorHex: ruleColor,
            });
          }
        }
      } else if (
        pathData &&
        typeof (pathData as ArrayLike<number>).length === "number" &&
        isStroke
      ) {
        const coords = pathData as ArrayLike<number>;
        // Fallback: inspect explicit moveTo + lineTo
        const fullMatrix = multiplyMatrices(vpMatrix, state.ctm);
        let curX = 0;
        let curY = 0;
        for (let k = 0; k < coords.length; ) {
          const drawOp = coords[k++];
          if (drawOp === DRAW_OPS.moveTo) {
            curX = coords[k++];
            curY = coords[k++];
          } else if (drawOp === DRAW_OPS.lineTo) {
            const nx = coords[k++];
            const ny = coords[k++];
            const [vx1, vy1] = applyMatrixToPoint(curX, curY, fullMatrix);
            const [vx2, vy2] = applyMatrixToPoint(nx, ny, fullMatrix);
            if (Math.abs(vy2 - vy1) <= 2 && Math.abs(vx2 - vx1) >= 40) {
              if (state.strokeHex !== "FFFFFF") {
                rules.push({
                  yTop: (vy1 + vy2) / 2,
                  xStart: Math.min(vx1, vx2),
                  xEnd: Math.max(vx1, vx2),
                  thicknessPt: Math.max(0.75, state.lineWidth),
                  colorHex: state.strokeHex,
                });
              }
            }
            curX = nx;
            curY = ny;
          } else if (drawOp === DRAW_OPS.curveTo) {
            k += 6;
          } else if (drawOp === DRAW_OPS.quadraticCurveTo) {
            k += 4;
          }
        }
      }
      continue;
    }

    // Extract images from paintImageXObject / paintInlineImageXObject
    if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject
    ) {
      let imgData: PdfImageObjectData | null = null;
      if (fn === OPS.paintImageXObject && typeof args[0] === "string") {
        imgData = await resolvePageObject<PdfImageObjectData>(page.objs, args[0]);
      } else if (args[0] && typeof args[0] === "object") {
        imgData = args[0] as PdfImageObjectData;
      }

      if (!imgData) continue;

      const fullMatrix = multiplyMatrices(vpMatrix, state.ctm);
      const corners = [
        applyMatrixToPoint(0, 0, fullMatrix),
        applyMatrixToPoint(1, 0, fullMatrix),
        applyMatrixToPoint(0, 1, fullMatrix),
        applyMatrixToPoint(1, 1, fullMatrix),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.min(...xs);
      const yTop = Math.min(...ys);
      const widthPt = Math.max(...xs) - x;
      const heightPt = Math.max(...ys) - yTop;

      // Filter out spacer pixels and full-page background sheets
      if (
        widthPt < 14 ||
        heightPt < 14 ||
        (widthPt > viewport.width * 0.92 && heightPt > viewport.height * 0.92)
      ) {
        continue;
      }

      const dedupeKey = `${Math.round(x)}_${Math.round(yTop)}_${Math.round(widthPt)}_${Math.round(heightPt)}`;
      if (seenImageKeys.has(dedupeKey)) continue;
      seenImageKeys.add(dedupeKey);

      const pngBytes = await pdfImageDataToPngBytes(imgData, ImageKind);
      if (pngBytes) {
        images.push({
          id: `img-${i}`,
          x,
          yTop,
          widthPt,
          heightPt,
          pngBytes,
        });
      }
    }
  }

  // Extract text tokens in viewport coordinates with font metadata, color, and hyperlinks
  const fontCache = new Map<
    string,
    { fontFamily: "Calibri" | "Times New Roman" | "Consolas"; isBold: boolean; isItalic: boolean }
  >();

  const tokens: ExtractedTextToken[] = [];
  for (const item of textContent.items) {
    if (!("str" in item) || typeof item.str !== "string") continue;
    if (item.str.length === 0) continue;

    const tx = item.transform as number[];
    const combined = multiplyMatrices(vpMatrix, tx);
    const fontSize = Math.hypot(tx[0], tx[1]) || Math.hypot(tx[2], tx[3]) || item.height || 11;
    const height = Math.max(fontSize, item.height || fontSize);
    const x = combined[4];
    const baselineY = combined[5];
    const yTop = baselineY - height * 0.85;
    const yBottom = baselineY + height * 0.15;

    const fontRef = item.fontName;
    let fontMeta = fontCache.get(fontRef);
    if (!fontMeta) {
      let fontObj: PdfFontDescriptor | null = null;
      try {
        if (page.commonObjs.has(fontRef)) {
          fontObj = page.commonObjs.get(fontRef) as PdfFontDescriptor;
        }
      } catch {
        fontObj = null;
      }
      fontMeta = classifyFont(fontObj, textContent.styles[fontRef]?.fontFamily);
      fontCache.set(fontRef, fontMeta);
    }

    // Match nearest color anchor around baselineY & x
    let colorHex = "111827";
    let bestDist = 18;
    for (const anchor of colorAnchors) {
      const dist = Math.abs(anchor.yTop - baselineY) + Math.abs(anchor.x - x) * 0.08;
      if (dist < bestDist) {
        bestDist = dist;
        colorHex = anchor.colorHex;
      }
    }
    // Avoid invisible white text on white Word canvas
    if (colorHex === "FFFFFF") {
      colorHex = "111827";
    }

    // Match hyperlink annotation containing token midpoint
    const midX = x + Math.max(1, item.width) / 2;
    const midY = (yTop + yBottom) / 2;
    const matchedLink = linkBoxes.find(
      (box) =>
        midX >= box.x1 &&
        midX <= box.x2 &&
        midY >= box.y1 &&
        midY <= box.y2
    );

    tokens.push({
      str: item.str,
      x,
      yTop,
      yBottom,
      width: Math.max(0, item.width),
      height,
      fontSize,
      fontFamily: fontMeta.fontFamily,
      isBold: fontMeta.isBold,
      isItalic: fontMeta.isItalic,
      colorHex,
      linkUrl: matchedLink?.url,
    });
  }

  return {
    pageWidthPt: viewport.width,
    pageHeightPt: viewport.height,
    tokens,
    images,
    rules,
  };
}

function buildVisualLines(tokens: ExtractedTextToken[]): VisualLine[] {
  const nonEmpty = tokens.filter((t) => t.str.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  // Sort top-to-bottom (smaller yTop first in viewport coords), then left-to-right
  const sorted = [...nonEmpty].sort((a, b) => {
    const tol = Math.max(3, Math.min(a.height, b.height) * 0.45);
    if (Math.abs(a.yTop - b.yTop) <= tol) {
      return a.x - b.x;
    }
    return a.yTop - b.yTop;
  });

  const rows: ExtractedTextToken[][] = [];
  for (const token of sorted) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      rows.push([token]);
      continue;
    }
    const avgY = lastRow.reduce((s, t) => s + t.yTop, 0) / lastRow.length;
    const avgH = lastRow.reduce((s, t) => s + t.height, 0) / lastRow.length;
    const tolerance = Math.max(3, avgH * 0.45);
    if (Math.abs(token.yTop - avgY) <= tolerance) {
      lastRow.push(token);
    } else {
      rows.push([token]);
    }
  }

  return rows.map((row) => {
    const ordered = [...row].sort((a, b) => a.x - b.x);
    const segments: VisualLineSegment[] = [];
    let currentTokens: ExtractedTextToken[] = [ordered[0]];

    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      const gap = curr.x - (prev.x + prev.width);
      const columnGapThreshold = Math.max(26, curr.fontSize * 2.3);

      // Keep bullet symbol attached to its item text if separated by normal bullet indent
      const prevIsStandaloneBullet =
        currentTokens.length === 1 &&
        STANDALONE_BULLET_RE.test(currentTokens[0].str.trim());

      if (gap > columnGapThreshold && !prevIsStandaloneBullet) {
        segments.push({
          tokens: currentTokens,
          xStart: currentTokens[0].x,
          xEnd:
            currentTokens[currentTokens.length - 1].x +
            currentTokens[currentTokens.length - 1].width,
        });
        currentTokens = [curr];
      } else {
        currentTokens.push(curr);
      }
    }

    segments.push({
      tokens: currentTokens,
      xStart: currentTokens[0].x,
      xEnd:
        currentTokens[currentTokens.length - 1].x +
        currentTokens[currentTokens.length - 1].width,
    });

    const plainText = segments
      .map((seg) => joinTokensText(seg.tokens))
      .join("   ")
      .trim();

    let boldWeight = 0;
    let totalWeight = 0;
    const sizeCounts = new Map<number, number>();
    for (const t of ordered) {
      const len = t.str.trim().length;
      totalWeight += len;
      if (t.isBold) boldWeight += len;
      const roundedSize = Math.round(t.fontSize * 2) / 2;
      sizeCounts.set(roundedSize, (sizeCounts.get(roundedSize) ?? 0) + len);
    }

    let dominantFontSize = ordered[0].fontSize;
    let bestCount = -1;
    for (const [sz, cnt] of sizeCounts.entries()) {
      if (cnt > bestCount) {
        bestCount = cnt;
        dominantFontSize = sz;
      }
    }

    return {
      yTop: Math.min(...ordered.map((t) => t.yTop)),
      yBottom: Math.max(...ordered.map((t) => t.yBottom)),
      height: Math.max(...ordered.map((t) => t.height)),
      xStart: ordered[0].x,
      xEnd: ordered[ordered.length - 1].x + ordered[ordered.length - 1].width,
      segments,
      plainText,
      isBoldDominant: totalWeight > 0 && boldWeight / totalWeight >= 0.7,
      dominantFontSize,
    };
  });
}

function joinTokensText(tokens: ExtractedTextToken[]): string {
  let out = "";
  let prevEnd = tokens[0]?.x ?? 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i > 0) {
      const gap = t.x - prevEnd;
      const spaceThreshold = Math.max(1.4, t.fontSize * 0.16);
      if (gap > spaceThreshold && !out.endsWith(" ") && !t.str.startsWith(" ")) {
        out += " ";
      }
    }
    out += t.str;
    prevEnd = t.x + t.width;
  }
  return out.replace(/\s+/g, " ").trim();
}

export async function convertPdfToWordDocx(
  file: File,
  onProgress?: (percent: number, status: string) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string; fileCount: number }> {
  const {
    BorderStyle,
    Document,
    ExternalHyperlink,
    ImageRun,
    Packer,
    PageBreak,
    Paragraph,
    Tab,
    TabStopType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    UnderlineType,
    WidthType,
  } = await import("docx");

  type ParagraphChildType =
    | InstanceType<typeof TextRun>
    | InstanceType<typeof ExternalHyperlink>
    | InstanceType<typeof ImageRun>;

  const pdfDoc = await loadPdfJsDocument(file);

  try {
    const totalPages = pdfDoc.numPages;
    const docChildren: FileChild[] = [];
    let totalExtractedChars = 0;
    let totalExtractedImages = 0;

    let firstPageWidthPt = 595.28;
    let firstPageHeightPt = 841.89;
    let detectedMarginPt = 48;

    const buildSegmentRuns = (
      tokens: ExtractedTextToken[],
      stripBulletPrefix: boolean
    ): ParagraphChildType[] => {
      const runs: ParagraphChildType[] = [];
      let remainingStrip = stripBulletPrefix;
      let prevEnd = tokens[0]?.x ?? 0;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        let text = token.str;

        if (remainingStrip) {
          const trimmed = text.trim();
          if (STANDALONE_BULLET_RE.test(trimmed)) {
            remainingStrip = false;
            prevEnd = token.x + token.width;
            continue;
          }
          const match = BULLET_PREFIX_RE.exec(text.trimStart());
          if (match) {
            text = match[2];
            remainingStrip = false;
          } else {
            remainingStrip = false;
          }
        }

        if (!text) {
          prevEnd = token.x + token.width;
          continue;
        }

        const needsSpace =
          runs.length > 0 &&
          token.x - prevEnd > Math.max(1.4, token.fontSize * 0.16) &&
          !text.startsWith(" ");

        const runText = `${needsSpace ? " " : ""}${text}`;
        const halfPts = Math.max(14, Math.min(72, Math.round(token.fontSize * 2)));

        if (token.linkUrl) {
          runs.push(
            new ExternalHyperlink({
              link: token.linkUrl,
              children: [
                new TextRun({
                  text: runText,
                  font: token.fontFamily,
                  size: halfPts,
                  bold: token.isBold,
                  italics: token.isItalic,
                  color: "0563C1",
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
            })
          );
        } else {
          runs.push(
            new TextRun({
              text: runText,
              font: token.fontFamily,
              size: halfPts,
              bold: token.isBold,
              italics: token.isItalic,
              color: token.colorHex,
            })
          );
        }

        prevEnd = token.x + token.width;
      }

      return runs;
    };

    const renderLinesToParagraphs = (
      lines: VisualLine[],
      rules: ExtractedHorizontalRule[],
      areaLeftPt: number,
      areaWidthPt: number,
      bodySizePt: number
    ): InstanceType<typeof Paragraph>[] => {
      const paragraphs: InstanceType<typeof Paragraph>[] = [];
      const areaWidthTwips = Math.max(1800, Math.round(areaWidthPt * 20));
      const usedRuleIndices = new Set<number>();

      const findRuleBelowLine = (line: VisualLine): ExtractedHorizontalRule | undefined => {
        let bestIdx = -1;
        let bestDist = 16;
        for (let rIdx = 0; rIdx < rules.length; rIdx++) {
          if (usedRuleIndices.has(rIdx)) continue;
          const rule = rules[rIdx];
          const dy = rule.yTop - line.yBottom;
          const overlapsX =
            rule.xEnd >= areaLeftPt + 10 && rule.xStart <= areaLeftPt + areaWidthPt - 10;
          if (overlapsX && dy >= -4 && dy <= bestDist) {
            bestDist = dy;
            bestIdx = rIdx;
          }
        }
        if (bestIdx >= 0) {
          usedRuleIndices.add(bestIdx);
          return rules[bestIdx];
        }
        return undefined;
      };

      const isBulletLine = (line: VisualLine): boolean => {
        if (line.segments.length === 0) return false;
        const firstSegText = joinTokensText(line.segments[0].tokens);
        return (
          BULLET_PREFIX_RE.test(firstSegText) ||
          STANDALONE_BULLET_RE.test(firstSegText)
        );
      };

      // Group lines into logical paragraphs
      interface PendingPara {
        lines: VisualLine[];
        isHeading: boolean;
        isBullet: boolean;
        bulletLevel: number;
        ruleBelow?: ExtractedHorizontalRule;
        hasMultiSegments: boolean;
      }

      const pending: PendingPara[] = [];

      for (const line of lines) {
        const hasMultiSegments = line.segments.length > 1;
        const bullet = isBulletLine(line);
        const isHeading =
          !bullet &&
          !hasMultiSegments &&
          ((line.dominantFontSize > bodySizePt * 1.24 && line.plainText.length <= 120) ||
            (line.isBoldDominant &&
              line.plainText.length <= 70 &&
              line.plainText === line.plainText.toUpperCase() &&
              /[A-Z]/.test(line.plainText)));
        const ruleBelow = findRuleBelowLine(line);

        const prev = pending[pending.length - 1];
        const prevLine = prev?.lines[prev.lines.length - 1];
        const verticalGap = prevLine ? line.yTop - prevLine.yBottom : 999;

        const canMergeProse =
          prev &&
          prevLine &&
          !prev.isHeading &&
          !prev.ruleBelow &&
          !prev.hasMultiSegments &&
          !isHeading &&
          !bullet &&
          !hasMultiSegments &&
          verticalGap >= -2 &&
          verticalGap <= prevLine.height * 0.72 &&
          Math.abs(line.xStart - prevLine.xStart) <= (prev.isBullet ? 28 : 12) &&
          // Only wrap lines if the previous line extended reasonably toward the right edge
          prevLine.xEnd - areaLeftPt >= areaWidthPt * 0.62;

        if (canMergeProse) {
          prev.lines.push(line);
          if (ruleBelow) prev.ruleBelow = ruleBelow;
        } else {
          const indentOffset = Math.max(0, line.xStart - areaLeftPt);
          const bulletLevel = bullet && indentOffset > 28 ? 1 : 0;
          pending.push({
            lines: [line],
            isHeading,
            isBullet: bullet,
            bulletLevel,
            ruleBelow,
            hasMultiSegments,
          });
        }
      }

      for (let pIdx = 0; pIdx < pending.length; pIdx++) {
        const block = pending[pIdx];
        const firstLine = block.lines[0];

        // Compute paragraph top spacing from vertical distance to previous block
        const prevBlock = pIdx > 0 ? pending[pIdx - 1] : null;
        const prevBottom = prevBlock
          ? prevBlock.lines[prevBlock.lines.length - 1].yBottom
          : firstLine.yTop;
        const gapPt = Math.max(0, firstLine.yTop - prevBottom);
        const spaceBefore =
          pIdx === 0 ? 0 : Math.min(360, Math.round(gapPt * 14));
        const spaceAfter = block.ruleBelow ? 100 : block.isBullet ? 60 : 80;

        if (block.hasMultiSegments) {
          const segs = firstLine.segments;
          const children: ParagraphChildType[] = [];
          const tabStops: Array<{
            type: (typeof TabStopType)[keyof typeof TabStopType];
            position: number;
          }> = [];

          for (let s = 0; s < segs.length; s++) {
            const seg = segs[s];
            if (s > 0) {
              children.push(new TextRun({ children: [new Tab()] }));
              const isLast = s === segs.length - 1;
              const isRightAligned =
                isLast && seg.xEnd - areaLeftPt >= areaWidthPt * 0.78;
              const tabPosTwips = isRightAligned
                ? areaWidthTwips
                : Math.max(
                    600,
                    Math.min(
                      areaWidthTwips - 400,
                      Math.round((seg.xStart - areaLeftPt) * 20)
                    )
                  );
              tabStops.push({
                type: isRightAligned ? TabStopType.RIGHT : TabStopType.LEFT,
                position: tabPosTwips,
              });
            }
            children.push(...buildSegmentRuns(seg.tokens, s === 0 && block.isBullet));
          }

          paragraphs.push(
            new Paragraph({
              keepNext: block.isHeading,
              spacing: { before: spaceBefore, after: spaceAfter },
              tabStops,
              border: block.ruleBelow
                ? {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: Math.max(
                        4,
                        Math.min(24, Math.round(block.ruleBelow.thicknessPt * 8))
                      ),
                      color: block.ruleBelow.colorHex,
                      space: 4,
                    },
                  }
                : undefined,
              children,
            })
          );
          continue;
        }

        const allChildren: ParagraphChildType[] = [];
        for (let l = 0; l < block.lines.length; l++) {
          const line = block.lines[l];
          const segRuns = buildSegmentRuns(
            line.segments[0]?.tokens ?? [],
            l === 0 && block.isBullet
          );
          if (l > 0 && segRuns.length > 0) {
            allChildren.push(new TextRun({ text: " ", font: "Calibri" }));
          }
          allChildren.push(...segRuns);
        }

        if (allChildren.length === 0) continue;

        paragraphs.push(
          new Paragraph({
            keepNext: block.isHeading,
            bullet: block.isBullet ? { level: block.bulletLevel } : undefined,
            spacing: { before: spaceBefore, after: spaceAfter },
            border: block.ruleBelow
              ? {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: Math.max(
                      4,
                      Math.min(24, Math.round(block.ruleBelow.thicknessPt * 8))
                    ),
                    color: block.ruleBelow.colorHex,
                    space: 4,
                  },
                }
              : undefined,
            children: allChildren,
          })
        );
      }

      return paragraphs;
    };

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (signal?.aborted) {
        throw new Error("Proses dibatalkan oleh pengguna.");
      }

      onProgress?.(
        Math.round(((pageNum - 1) / totalPages) * 85),
        `Menganalisis tata letak halaman ${pageNum} dari ${totalPages}...`
      );
      await yieldToMainThread();

      const page = await pdfDoc.getPage(pageNum);
      const scene = await extractPageScene(page);
      page.cleanup();

      if (pageNum === 1) {
        firstPageWidthPt = scene.pageWidthPt;
        firstPageHeightPt = scene.pageHeightPt;
      }

      const lines = buildVisualLines(scene.tokens);
      const pageChars = lines.reduce((sum, l) => sum + l.plainText.length, 0);
      totalExtractedChars += pageChars;
      totalExtractedImages += scene.images.length;

      if (pageNum > 1 && docChildren.length > 0) {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }

      if (lines.length === 0 && scene.images.length === 0) {
        continue;
      }

      const contentLeftPt =
        lines.length > 0
          ? Math.max(
              24,
              Math.min(
                72,
                Math.min(
                  ...lines.map((l) => l.xStart),
                  ...(scene.images.length > 0
                    ? scene.images.map((im) => im.x)
                    : [72])
                )
              )
            )
          : 48;
      const contentRightPt =
        lines.length > 0
          ? Math.min(
              scene.pageWidthPt - 24,
              Math.max(
                scene.pageWidthPt - 72,
                Math.max(
                  ...lines.map((l) => l.xEnd),
                  ...(scene.images.length > 0
                    ? scene.images.map((im) => im.x + im.widthPt)
                    : [0])
                )
              )
            )
          : scene.pageWidthPt - 48;

      if (pageNum === 1) {
        detectedMarginPt = Math.max(
          28,
          Math.min(
            68,
            Math.round(
              Math.min(contentLeftPt, scene.pageWidthPt - contentRightPt)
            )
          )
        );
      }

      const printableWidthPt = Math.max(
        260,
        scene.pageWidthPt - detectedMarginPt * 2
      );

      // Compute median body font size
      const bodySizePt =
        lines.length > 0
          ? [...lines.map((l) => l.dominantFontSize)].sort((a, b) => a - b)[
              Math.floor(lines.length / 2)
            ]
          : 11;

      // Pair side-by-side images (e.g., CV passport photo) with overlapping horizontal text lines
      const handledLineSet = new Set<VisualLine>();
      const handledRuleSet = new Set<ExtractedHorizontalRule>();
      const emittedItems: Array<{ yTop: number; node: FileChild }> = [];

      const noneBorder = {
        style: BorderStyle.NONE,
        size: 0,
        color: "FFFFFF",
      };
      const noBorders = {
        top: noneBorder,
        bottom: noneBorder,
        left: noneBorder,
        right: noneBorder,
        insideHorizontal: noneBorder,
        insideVertical: noneBorder,
      };

      for (const img of scene.images) {
        const imgBottom = img.yTop + img.heightPt;
        const imgRight = img.x + img.widthPt;

        const besideLines = lines.filter((line) => {
          if (handledLineSet.has(line)) return false;
          const overlapY =
            Math.min(imgBottom + 2, line.yBottom) -
            Math.max(img.yTop - 4, line.yTop);
          if (overlapY <= 3) return false;
          const isToRight = line.xStart >= imgRight - 8;
          const isToLeft = line.xEnd <= img.x + 8;
          return isToRight || isToLeft;
        });

        const pxPerPt = 96 / 72;
        const maxImgW = printableWidthPt * 0.92;
        const scaleDown = img.widthPt > maxImgW ? maxImgW / img.widthPt : 1;
        const imgRun = new ImageRun({
          type: "png",
          data: img.pngBytes,
          transformation: {
            width: Math.max(16, Math.round(img.widthPt * scaleDown * pxPerPt)),
            height: Math.max(16, Math.round(img.heightPt * scaleDown * pxPerPt)),
          },
        });

        if (besideLines.length > 0 && img.widthPt < printableWidthPt * 0.55) {
          for (const line of besideLines) {
            handledLineSet.add(line);
          }

          const imageIsOnLeft =
            besideLines.reduce((s, l) => s + l.xStart, 0) / besideLines.length >
            img.x;

          const besideRules = scene.rules.filter((rule) => {
            if (handledRuleSet.has(rule)) return false;
            const inBand =
              rule.yTop >= img.yTop - 6 && rule.yTop <= imgBottom + 14;
            if (!inBand) return false;
            const inTextCol = imageIsOnLeft
              ? rule.xStart >= imgRight - 14
              : rule.xEnd <= img.x + 14;
            if (inTextCol) handledRuleSet.add(rule);
            return inTextCol;
          });

          const textColLeft = Math.min(...besideLines.map((l) => l.xStart));
          const textColWidth = Math.max(
            180,
            printableWidthPt - img.widthPt - 18
          );
          const textParagraphs = renderLinesToParagraphs(
            besideLines,
            besideRules,
            textColLeft,
            textColWidth,
            bodySizePt
          );

          const totalTwips = Math.round(printableWidthPt * 20);
          const imgColTwips = Math.round((img.widthPt + 16) * 20);
          const textColTwips = Math.max(1800, totalTwips - imgColTwips);

          const imgCell = new TableCell({
            width: { size: imgColTwips, type: WidthType.DXA },
            borders: noBorders,
            margins: {
              top: 0,
              bottom: 0,
              left: imageIsOnLeft ? 0 : 120,
              right: imageIsOnLeft ? 120 : 0,
            },
            children: [new Paragraph({ children: [imgRun] })],
          });

          const textCell = new TableCell({
            width: { size: textColTwips, type: WidthType.DXA },
            borders: noBorders,
            margins: {
              top: 0,
              bottom: 0,
              left: imageIsOnLeft ? 120 : 0,
              right: imageIsOnLeft ? 0 : 120,
            },
            children:
              textParagraphs.length > 0
                ? textParagraphs
                : [new Paragraph({ children: [] })],
          });

          const colWidths = imageIsOnLeft
            ? [imgColTwips, textColTwips]
            : [textColTwips, imgColTwips];

          const table = new Table({
            width: { size: totalTwips, type: WidthType.DXA },
            columnWidths: colWidths,
            borders: noBorders,
            rows: [
              new TableRow({
                children: imageIsOnLeft
                  ? [imgCell, textCell]
                  : [textCell, imgCell],
              }),
            ],
          });

          emittedItems.push({ yTop: img.yTop, node: table });
        } else {
          emittedItems.push({
            yTop: img.yTop,
            node: new Paragraph({
              spacing: { before: 80, after: 120 },
              children: [imgRun],
            }),
          });
        }
      }

      const remainingLines = lines.filter((l) => !handledLineSet.has(l));
      const remainingRules = scene.rules.filter((r) => !handledRuleSet.has(r));

      // Split remaining lines into contiguous blocks around standalone images so reading order stays accurate
      const sortedEmittedYs = emittedItems
        .map((item) => item.yTop)
        .sort((a, b) => a - b);

      if (sortedEmittedYs.length === 0) {
        const paras = renderLinesToParagraphs(
          remainingLines,
          remainingRules,
          detectedMarginPt,
          printableWidthPt,
          bodySizePt
        );
        docChildren.push(...paras);
      } else {
        const buckets: VisualLine[][] = Array.from(
          { length: sortedEmittedYs.length + 1 },
          () => []
        );
        for (const line of remainingLines) {
          let bIdx = 0;
          while (
            bIdx < sortedEmittedYs.length &&
            line.yTop > sortedEmittedYs[bIdx]
          ) {
            bIdx++;
          }
          buckets[bIdx].push(line);
        }

        const sortedItems = [...emittedItems].sort((a, b) => a.yTop - b.yTop);
        for (let b = 0; b < buckets.length; b++) {
          if (buckets[b].length > 0) {
            const minY = buckets[b][0].yTop - 4;
            const maxY = buckets[b][buckets[b].length - 1].yBottom + 16;
            const bucketRules = remainingRules.filter(
              (r) => r.yTop >= minY && r.yTop <= maxY
            );
            const paras = renderLinesToParagraphs(
              buckets[b],
              bucketRules,
              detectedMarginPt,
              printableWidthPt,
              bodySizePt
            );
            docChildren.push(...paras);
          }
          if (b < sortedItems.length) {
            docChildren.push(sortedItems[b].node);
          }
        }
      }
    }

    if (totalExtractedChars === 0 && totalExtractedImages === 0) {
      throw new Error(
        "Tidak ditemukan teks yang dapat diekstrak pada PDF ini. Dokumen hasil scan atau gambar tidak didukung tanpa OCR."
      );
    }

    onProgress?.(92, "Menyusun file Microsoft Word (.docx)...");
    const marginTwips = Math.round(detectedMarginPt * 20);
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Calibri",
              size: 22,
              color: "111827",
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: Math.round(firstPageWidthPt * 20),
                height: Math.round(firstPageHeightPt * 20),
              },
              margin: {
                top: marginTwips,
                bottom: marginTwips,
                left: marginTwips,
                right: marginTwips,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    onProgress?.(100, "Selesai");

    return {
      blob,
      filename: `${stripFileExtension(file.name)}.docx`,
      fileCount: 1,
    };
  } finally {
    await disposePdfDocument(pdfDoc);
  }
}
