import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { MergePdfTool } from "@/components/tools/merge-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("gabungkan-pdf");

export default function GabungkanPdfPage() {
  return (
    <ToolPageShell toolSlug="gabungkan-pdf">
      <MergePdfTool />
    </ToolPageShell>
  );
}
