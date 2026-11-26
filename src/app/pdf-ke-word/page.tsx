import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { PdfToWordTool } from "@/components/tools/pdf-to-word-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("pdf-ke-word");

export default function PdfKeWordPage() {
  return (
    <ToolPageShell toolSlug="pdf-ke-word">
      <PdfToWordTool />
    </ToolPageShell>
  );
}
