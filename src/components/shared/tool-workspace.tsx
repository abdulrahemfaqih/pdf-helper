"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToolWorkspaceProps {
  toolbar?: React.ReactNode;
  sidebarTitle?: string;
  sidebarContent: React.ReactNode;
  sidebarAction: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** 2-column workspace (flexible preview/canvas on the left, 320px sidebar on desktop). */
export function ToolWorkspace({
  toolbar,
  sidebarTitle = "Pengaturan",
  sidebarContent,
  sidebarAction,
  children,
  className,
}: ToolWorkspaceProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-6 lg:flex-row lg:items-start",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {toolbar ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            {toolbar}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-80">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="border-b border-border pb-3 text-sm font-semibold text-foreground">
            {sidebarTitle}
          </h2>
          <div className="mt-4 space-y-4">{sidebarContent}</div>
          <div className="sticky bottom-0 z-20 -mx-5 mt-5 border-t border-border bg-card px-5 pt-4 pb-1 lg:static lg:mx-0 lg:px-0 lg:pb-0">
            {sidebarAction}
          </div>
        </div>
      </aside>
    </div>
  );
}
