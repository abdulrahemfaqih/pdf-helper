import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { SplitPdfTool } from "@/components/tools/split-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("pisahkan-pdf");

export default function PisahkanPdfPage() {
  return (
    <ToolPageShell toolSlug="pisahkan-pdf">
      <SplitPdfTool />
    </ToolPageShell>
  );
}
