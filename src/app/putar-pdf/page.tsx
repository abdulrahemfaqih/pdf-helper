import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { RotatePdfTool } from "@/components/tools/rotate-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("putar-pdf");

export default function PutarPdfPage() {
  return (
    <ToolPageShell toolSlug="putar-pdf">
      <RotatePdfTool />
    </ToolPageShell>
  );
}
