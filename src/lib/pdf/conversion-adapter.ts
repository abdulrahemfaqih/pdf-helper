"use client";

import { stripFileExtension } from "@/lib/file-utils";
import { createZipBlob, yieldToMainThread } from "@/lib/pdf/zip";

export const MAX_PDF_TO_WORD_BYTES = 10 * 1024 * 1024; // 10 MB
export const PDF_TO_WORD_TIMEOUT_MS = 90_000; // 90 seconds (handles Koyeb cold start)

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

function extractFilenameFromDisposition(
  headerValue: string | null,
  fallback: string
): string {
  if (!headerValue) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;\n]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return fallback;
    }
  }
  const plainMatch = /filename="?([^";\n]+)"?/i.exec(headerValue);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }
  return fallback;
}

async function convertPdfViaMicroservice(
  file: File,
  onProgress?: (percent: number, status: string) => void,
  externalSignal?: AbortSignal
): Promise<ConversionResult> {
  if (file.size > MAX_PDF_TO_WORD_BYTES) {
    throw new Error("Ukuran file melebihi batas maksimal 10 MB.");
  }

  const baseUrl = process.env.NEXT_PUBLIC_PDF_TO_WORD_API_URL?.trim().replace(
    /\/+$/,
    ""
  );
  if (!baseUrl) {
    throw new Error(
      "Layanan konversi PDF ke Word belum dikonfigurasi (NEXT_PUBLIC_PDF_TO_WORD_API_URL)."
    );
  }

  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PDF_TO_WORD_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId);
      throw new Error("Proses dibatalkan oleh pengguna.");
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  onProgress?.(20, "Mengunggah dokumen ke server konversi...");

  // Advance progress gently while waiting for Koyeb cold start / pdf2docx processing
  let simulatedPct = 28;
  const progressTimer = window.setInterval(() => {
    simulatedPct = Math.min(88, simulatedPct + 4);
    onProgress?.(simulatedPct, "Mengonversi dokumen...");
  }, 1500);

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(`${baseUrl}/convert`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errJson = (await response.json()) as { detail?: string };
        if (typeof errJson.detail === "string") {
          detail = errJson.detail;
        }
      } catch {
        // Ignore non-JSON error body
      }

      if (response.status === 413) {
        throw new Error(detail || "Ukuran file melebihi batas maksimal 10 MB.");
      }
      if (response.status === 400 || response.status === 422) {
        throw new Error(
          detail || "File PDF tidak valid atau dilindungi kata sandi."
        );
      }
      if (
        response.status === 429 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504
      ) {
        throw new Error(
          "Server konversi sedang sibuk atau memulai ulang (cold start). Silakan coba lagi sebentar."
        );
      }
      throw new Error(
        detail || `Gagal mengonversi dokumen (kode ${response.status}).`
      );
    }

    onProgress?.(94, "Menyiapkan file Word (.docx)...");
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("Hasil konversi kosong.");
    }

    const fallbackName = `${stripFileExtension(file.name)}.docx`;
    const filename = extractFilenameFromDisposition(
      response.headers.get("Content-Disposition"),
      fallbackName
    );

    onProgress?.(100, "Selesai");
    return {
      blob,
      filename,
      fileCount: 1,
    };
  } catch (error) {
    if (externalSignal?.aborted) {
      throw new Error("Proses dibatalkan oleh pengguna.");
    }
    if (timedOut) {
      throw new Error(
        "Waktu koneksi habis (timeout 90 detik). Server mungkin sedang cold start atau sibuk, silakan coba lagi."
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Tidak dapat terhubung ke server konversi. Periksa koneksi internet atau coba lagi saat server siap."
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    window.clearInterval(progressTimer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export class ClientConversionAdapter implements ConversionAdapter {
  async pdfToWord(
    file: File,
    onProgress?: (percent: number, status: string) => void,
    signal?: AbortSignal
  ): Promise<ConversionResult> {
    return convertPdfViaMicroservice(file, onProgress, signal);
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
