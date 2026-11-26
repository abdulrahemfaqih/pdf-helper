import type * as React from "react";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

interface ToolPageShellProps {
  children: React.ReactNode;
}

export function ToolPageShell({ children }: ToolPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
