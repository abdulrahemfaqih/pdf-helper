"use client";

import { stripFileExtension } from "@/lib/file-utils";
import { convertPdfToWordDocx } from "@/lib/pdf/pdf-to-word";
import { createZipBlob, yieldToMainThread } from "@/lib/pdf/zip";

export type WordToPdfPageSize = "a4" | "letter";
export type WordToPdfMargin = "normal" | "narrow" | "wide";

export interface WordToPdfOptions {
  pageSize: WordToPdfPageSize;
  margin: WordToPdfMargin;
}

export interface ConversionResult {
  blob: Blob;
  filename: string;
  fileCount: number;
}

/**
 * Tier 1/Tier 2 extensible adapter interface for Word <-> PDF conversions.
 * Future server/LibreOffice implementations can implement this contract without UI changes.
 */
export interface ConversionAdapter {
  pdfToWord(
    file: File,
    onProgress?: (percent: number, status: string) => void,
    signal?: AbortSignal
  ): Promise<ConversionResult>;

  wordToPdf(
    files: File[],
    options: WordToPdfOptions,
    onProgress?: (percent: number, status: string) => void,
    signal?: AbortSignal
  ): Promise<ConversionResult>;
}

const PAGE_DIMENSIONS_PT: Record<
  WordToPdfPageSize,
  { width: number; height: number }
> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

const MARGIN_PT: Record<WordToPdfMargin, number> = {
  narrow: 36,
  normal: 54,
  wide: 72,
};

function buildIsolatedHtmlDocument(bodyHtml: string, contentWidthPx: number): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    background: #ffffff;
    color: #09090b;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.55;
    width: ${contentWidthPx}px;
  }
  #doc-root {
    width: ${contentWidthPx}px;
    background: #ffffff;
    color: #09090b;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #09090b;
    font-weight: 600;
    line-height: 1.3;
    margin-top: 14px;
    margin-bottom: 6px;
  }
  h1 { font-size: 20px; }
  h2 { font-size: 17px; }
  h3 { font-size: 15px; }
  h4, h5, h6 { font-size: 13.5px; }
  p {
    margin-bottom: 8px;
    word-wrap: break-word;
  }
  ul, ol {
    margin-left: 20px;
    margin-bottom: 8px;
  }
  li {
    margin-bottom: 3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    margin-bottom: 10px;
    font-size: 12px;
  }
  th, td {
    border: 1px solid #d4d4d8;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
    color: #09090b;
  }
  th {
    background-color: #f4f4f5;
    font-weight: 600;
  }
  blockquote {
    border-left: 3px solid #2563eb;
    padding-left: 10px;
    color: #3f3f46;
    margin: 8px 0;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 8px 0;
  }
  pre, code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background-color: #f4f4f5;
    color: #09090b;
    font-size: 12px;
  }
  pre {
    padding: 8px;
    border-radius: 4px;
    white-space: pre-wrap;
    margin-bottom: 8px;
  }
</style>
</head>
<body>
  <div id="doc-root">${bodyHtml}</div>
</body>
</html>`;
}

async function renderHtmlToPaginatedPdfBlob(
  htmlContent: string,
  options: WordToPdfOptions,
  onSliceProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const pageDims = PAGE_DIMENSIONS_PT[options.pageSize];
  const marginPt = MARGIN_PT[options.margin];
  const printableWidthPt = pageDims.width - marginPt * 2;
  const printableHeightPt = pageDims.height - marginPt * 2;

  // Render at 96 DPI CSS pixels (~1.333px per pt) so fonts match normal print sizing
  const ptToPx = 96 / 72;
  const contentWidthPx = Math.round(printableWidthPt * ptToPx);
  const maxPageHeightPx = Math.round(printableHeightPt * ptToPx);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-99999px";
  iframe.style.top = "0";
  iframe.style.width = `${contentWidthPx + 40}px`;
  iframe.style.height = "1200px";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      throw new Error("Gagal menginisialisasi frame preview dokumen.");
    }

    iframeDoc.open();
    iframeDoc.write(buildIsolatedHtmlDocument(htmlContent, contentWidthPx));
    iframeDoc.close();

    // Wait for fonts & embedded images inside iframe to settle
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const root = iframeDoc.getElementById("doc-root");
    if (!root) {
      throw new Error("Konten dokumen kosong.");
    }

    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );

    // Group top-level blocks into non-splitting pages
    const rawBlocks = Array.from(root.children) as HTMLElement[];
    const pagesHtml: string[] = [];
    let currentBucket: HTMLElement[] = [];
    let currentHeight = 0;

    const flushBucket = () => {
      if (currentBucket.length === 0) return;
      pagesHtml.push(currentBucket.map((el) => el.outerHTML).join(""));
      currentBucket = [];
      currentHeight = 0;
    };

    for (const block of rawBlocks) {
      const style = iframe.contentWindow?.getComputedStyle(block);
      const marginTop = parseFloat(style?.marginTop ?? "0") || 0;
      const marginBottom = parseFloat(style?.marginBottom ?? "0") || 0;
      const blockHeight = block.offsetHeight + marginTop + marginBottom;

      if (block.tagName === "TABLE" && blockHeight > maxPageHeightPx) {
        flushBucket();
        const rows = Array.from(block.querySelectorAll("tr"));
        let tableChunk: string[] = [];
        let tableHeight = 0;

        for (const row of rows) {
          const rowH = Math.max(24, row.offsetHeight);
          if (tableHeight + rowH > maxPageHeightPx && tableChunk.length > 0) {
            pagesHtml.push(`<table><tbody>${tableChunk.join("")}</tbody></table>`);
            tableChunk = [];
            tableHeight = 0;
          }
          tableChunk.push(row.outerHTML);
          tableHeight += rowH;
        }
        if (tableChunk.length > 0) {
          pagesHtml.push(`<table><tbody>${tableChunk.join("")}</tbody></table>`);
        }
        continue;
      }

      if (currentHeight + blockHeight > maxPageHeightPx && currentBucket.length > 0) {
        flushBucket();
      }
      currentBucket.push(block);
      currentHeight += blockHeight;
    }
    flushBucket();

    if (pagesHtml.length === 0) {
      pagesHtml.push("<p>&nbsp;</p>");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: options.pageSize,
    });

    for (let i = 0; i < pagesHtml.length; i++) {
      if (signal?.aborted) {
        throw new Error("Proses dibatalkan oleh pengguna.");
      }

      onSliceProgress?.(i + 1, pagesHtml.length);
      await yieldToMainThread();

      root.innerHTML = pagesHtml[i];
      root.style.minHeight = "1px";

      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: contentWidthPx,
      });

      const renderedHeightPt = (canvas.height / canvas.width) * printableWidthPt;
      const cappedHeightPt = Math.min(renderedHeightPt, printableHeightPt);
      const imgData = canvas.toDataURL("image/png");
      canvas.width = 0;
      canvas.height = 0;

      if (i > 0) {
        pdf.addPage(options.pageSize, "portrait");
      }

      pdf.addImage(
        imgData,
        "PNG",
        marginPt,
        marginPt,
        printableWidthPt,
        cappedHeightPt
      );
    }

    return pdf.output("blob");
  } finally {
    iframe.remove();
  }
}

export class ClientConversionAdapter implements ConversionAdapter {
  async pdfToWord(
    file: File,
    onProgress?: (percent: number, status: string) => void,
    signal?: AbortSignal
  ): Promise<ConversionResult> {
    return convertPdfToWordDocx(file, onProgress, signal);
  }

  async wordToPdf(
    files: File[],
    options: WordToPdfOptions,
    onProgress?: (percent: number, status: string) => void,
    signal?: AbortSignal
  ): Promise<ConversionResult> {
    if (files.length === 0) {
      throw new Error("Pilih minimal 1 file DOCX terlebih dahulu.");
    }

    const mammoth = await import("mammoth");
    const outputs: Array<{ filename: string; blob: Blob }> = [];

    for (let i = 0; i < files.length; i++) {
      if (signal?.aborted) {
        throw new Error("Proses dibatalkan oleh pengguna.");
      }

      const file = files[i];
      const baseStart = (i / files.length) * 90;
      const sliceSpan = 90 / files.length;

      onProgress?.(
        Math.round(baseStart),
        `Membaca dokumen ${file.name} (${i + 1}/${files.length})...`
      );
      await yieldToMainThread();

      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

      if (!html.trim()) {
        throw new Error(`Dokumen ${file.name} kosong atau tidak dapat dibaca.`);
      }

      const pdfBlob = await renderHtmlToPaginatedPdfBlob(
        html,
        options,
        (currentPage, totalPages) => {
          const pct = baseStart + (currentPage / totalPages) * sliceSpan;
          onProgress?.(
            Math.round(pct),
            `Merender ${file.name}: halaman ${currentPage} dari ${totalPages}...`
          );
        },
        signal
      );

      outputs.push({
        filename: `${stripFileExtension(file.name)}.pdf`,
        blob: pdfBlob,
      });
    }

    if (outputs.length === 1) {
      onProgress?.(100, "Selesai");
      return {
        blob: outputs[0].blob,
        filename: outputs[0].filename,
        fileCount: 1,
      };
    }

    onProgress?.(92, "Mengemas hasil PDF ke arsip ZIP...");
    const zipBlob = await createZipBlob(
      outputs.map((item) => ({ filename: item.filename, data: item.blob })),
      (zipPct) => {
        onProgress?.(92 + Math.round(zipPct * 0.08), "Mengemas ke arsip ZIP...");
      }
    );
    onProgress?.(100, "Selesai");

    return {
      blob: zipBlob,
      filename: "word-ke-pdf.zip",
      fileCount: outputs.length,
    };
  }
}

export const defaultConversionAdapter: ConversionAdapter =
  new ClientConversionAdapter();
