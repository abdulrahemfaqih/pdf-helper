"use client";

import { Check, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/file-utils";

export interface ResultFileMetric {
  name: string;
  beforeBytes?: number;
  afterBytes: number;
}

interface ResultStateProps {
  filename: string;
  fileSizeBytes: number;
  downloadLabel?: string;
  summaryText?: string;
  metrics?: ResultFileMetric[];
  onDownload: () => void;
  onReset: () => void;
}

function getSavingsPercent(beforeBytes: number, afterBytes: number): number {
  if (beforeBytes <= 0) return 0;
  return Math.round(((beforeBytes - afterBytes) / beforeBytes) * 100);
}

export function ResultState({
  filename,
  fileSizeBytes,
  downloadLabel,
  summaryText,
  metrics,
  onDownload,
  onReset,
}: ResultStateProps) {
  const isZip = filename.toLowerCase().endsWith(".zip");
  const primaryLabel =
    downloadLabel ?? (isZip ? "Unduh ZIP" : "Unduh File");

  return (
    <div className="mx-auto my-8 w-full max-w-lg rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-primary/30 bg-accent-blue text-primary">
        <Check className="size-5" strokeWidth={2} />
      </div>

      <h2 className="text-lg font-semibold text-foreground">
        File siap diunduh
      </h2>

      <p className="mt-1.5 break-all font-mono text-xs text-muted-foreground tabular-nums">
        {filename} ({formatBytes(fileSizeBytes)})
      </p>

      {summaryText ? (
        <p className="mt-2 text-sm text-muted-foreground">{summaryText}</p>
      ) : null}

      {metrics && metrics.length > 0 ? (
        <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background text-left">
          {metrics.map((item, idx) => {
            const hasBefore = typeof item.beforeBytes === "number";
            const saved = hasBefore
              ? getSavingsPercent(item.beforeBytes!, item.afterBytes)
              : null;

            return (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              >
                <span className="truncate font-medium text-foreground">
                  {item.name}
                </span>
                <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                  {hasBefore
                    ? `${formatBytes(item.beforeBytes!)} → ${formatBytes(item.afterBytes)}`
                    : formatBytes(item.afterBytes)}
                  {saved !== null ? (
                    <span
                      className={
                        saved > 0
                          ? "ml-1.5 font-medium text-primary"
                          : "ml-1.5 text-muted-foreground"
                      }
                    >
                      ({saved >= 0 ? `Hemat ${saved}%` : `+${Math.abs(saved)}%`})
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Button type="button" size="lg" onClick={onDownload} className="gap-2">
          <Download className="size-4" />
          <span>{primaryLabel}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onReset}
          className="gap-2"
        >
          <RotateCcw className="size-4" />
          <span>Proses File Lain</span>
        </Button>
      </div>
    </div>
  );
}
