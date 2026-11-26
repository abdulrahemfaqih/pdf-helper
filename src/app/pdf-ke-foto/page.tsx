import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { PdfToImageTool } from "@/components/tools/pdf-to-image-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("pdf-ke-foto");

export default function PdfKeFotoPage() {
  return (
    <ToolPageShell toolSlug="pdf-ke-foto">
      <PdfToImageTool />
    </ToolPageShell>
  );
}
