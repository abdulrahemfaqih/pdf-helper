"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { getReadablePdfError } from "@/lib/file-utils";

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsInstancePromise: Promise<PdfJsModule> | null = null;
const loadingTaskByDoc = new WeakMap<PDFDocumentProxy, PDFDocumentLoadingTask>();

/** Dynamically loads pdfjs-dist on the client and configures the local Web Worker. */
export async function getPdfJs(): Promise<PdfJsModule> {
  if (typeof window === "undefined") {
    throw new Error("pdfjs-dist hanya dapat dijalankan di browser.");
  }

  if (!pdfjsInstancePromise) {
    pdfjsInstancePromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }

  return pdfjsInstancePromise;
}

/** Loads a PDF document from a File or buffer with readable password/corruption errors. */
export async function loadPdfJsDocument(
  source: File | ArrayBuffer | Uint8Array
): Promise<PDFDocumentProxy> {
  try {
    const pdfjs = await getPdfJs();
    let data: Uint8Array;
    if (source instanceof File) {
      data = new Uint8Array(await source.arrayBuffer());
    } else if (source instanceof Uint8Array) {
      data = new Uint8Array(source);
    } else {
      data = new Uint8Array(source);
    }

    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    loadingTaskByDoc.set(doc, loadingTask);
    return doc;
  } catch (error) {
    throw new Error(getReadablePdfError(error));
  }
}

/** Frees pdfjs-dist resources and terminates the associated worker task. */
export async function disposePdfDocument(
  doc: PDFDocumentProxy | null | undefined
): Promise<void> {
  if (!doc) return;
  try {
    await doc.cleanup(false);
  } catch {
    // Ignore cleanup errors if already disposed
  }
  const task = loadingTaskByDoc.get(doc);
  if (task) {
    loadingTaskByDoc.delete(doc);
    try {
      await task.destroy();
    } catch {
      // Ignore destroy errors
    }
  }
}
