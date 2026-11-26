export const LARGE_FILE_WARNING_BYTES = 150 * 1024 * 1024; // 150 MB

const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};

/** Formats byte counts into readable SI/binary-friendly strings. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, index);
  const decimals = index === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

export function getTotalBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

export function isTotalSizeOverWarningLimit(files: File[]): boolean {
  return getTotalBytes(files) > LARGE_FILE_WARNING_BYTES;
}

/** Validates file extensions and MIME types before processing. */
export function validateSelectedFiles(
  files: File[],
  acceptedExtensions: string[]
): { valid: File[]; rejectedNames: string[] } {
  const normalizedExts = acceptedExtensions.map((ext) => ext.toLowerCase());
  const allowedMimes = new Set(
    normalizedExts.flatMap((ext) => EXTENSION_MIME_MAP[ext] ?? [])
  );

  const valid: File[] = [];
  const rejectedNames: string[] = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    const hasValidExt = normalizedExts.some((ext) => lowerName.endsWith(ext));
    // Some browsers leave file.type empty for certain extensions; verify when present.
    const hasValidMime =
      !file.type ||
      allowedMimes.size === 0 ||
      allowedMimes.has(file.type.toLowerCase());

    if (hasValidExt && hasValidMime && file.size > 0) {
      valid.push(file);
    } else {
      rejectedNames.push(file.name);
    }
  }

  return { valid, rejectedNames };
}

export function isPasswordProtectedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = `${error.name} ${error.message}`.toLowerCase();
  return (
    msg.includes("password") ||
    msg.includes("encrypted") ||
    msg.includes("need a password")
  );
}

export function getReadablePdfError(error: unknown): string {
  if (isPasswordProtectedError(error)) {
    return "File PDF ini dilindungi kata sandi dan tidak dapat diproses.";
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid pdf") || msg.includes("no pdf header")) {
      return "File tidak valid atau rusak. Pastikan dokumen adalah PDF yang utuh.";
    }
    return error.message;
  }
  return "Terjadi kesalahan saat memproses file.";
}

/** Triggers a browser download from a Blob and cleans up the Object URL. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export function revokeObjectUrls(urls: Array<string | null | undefined>): void {
  for (const url of urls) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

export function stripFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}
