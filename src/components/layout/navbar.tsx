"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOOLS_CONFIG } from "@/lib/tools-config";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const activeTool = TOOLS_CONFIG.find((tool) => tool.href === pathname);

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-border bg-background">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-foreground">
              <FileStack className="size-4" strokeWidth={1.75} />
            </span>
            <span className="text-base font-semibold tracking-tight">
              PDFAlat
            </span>
          </Link>

          {activeTool ? (
            <div className="flex min-w-0 items-center gap-2.5 text-sm">
              <span className="text-border select-none">/</span>
              <span className="truncate font-medium text-foreground">
                {activeTool.title}
              </span>
            </div>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5" />
            }
          >
            <span>Semua Alat</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-1.5">
            {TOOLS_CONFIG.map((tool) => {
              const Icon = tool.icon;
              const isActive = pathname === tool.href;
              return (
                <DropdownMenuItem
                  key={tool.slug}
                  render={
                    <Link
                      href={tool.href}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                        isActive && "bg-accent-blue font-medium text-primary"
                      )}
                    />
                  }
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="truncate">{tool.title}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
