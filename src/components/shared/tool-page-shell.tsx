import type * as React from "react";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { buildToolJsonLd } from "@/lib/seo";
import type { ToolSlug } from "@/lib/tools-config";

interface ToolPageShellProps {
  toolSlug?: ToolSlug;
  children: React.ReactNode;
}

export function ToolPageShell({ toolSlug, children }: ToolPageShellProps) {
  const jsonLd = toolSlug ? buildToolJsonLd(toolSlug) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
