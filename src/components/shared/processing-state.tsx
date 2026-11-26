"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ProcessingStateProps {
  statusText: string;
  progress: number;
  detailText?: string;
  onCancel?: () => void;
}

export function ProcessingState({
  statusText,
  progress,
  detailText,
  onCancel,
}: ProcessingStateProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="mx-auto my-8 w-full max-w-md rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{statusText}</p>
        <span className="font-mono text-xs font-medium text-primary tabular-nums">
          {clamped}%
        </span>
      </div>

      <div className="mt-3">
        <Progress value={clamped} />
      </div>

      {detailText ? (
        <p className="mt-2.5 text-xs text-muted-foreground">{detailText}</p>
      ) : null}

      {onCancel ? (
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Batalkan
          </Button>
        </div>
      ) : null}
    </div>
  );
}
