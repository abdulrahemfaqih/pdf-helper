export interface ZipEntryInput {
  filename: string;
  data: Uint8Array | Blob;
}

/** Bundles multiple files into a single compressed .zip Blob using dynamic import. */
export async function createZipBlob(
  entries: ZipEntryInput[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const entry of entries) {
    zip.file(entry.filename, entry.data);
  }

  return zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(metadata.percent);
    }
  );
}

export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
