import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { PdfToImageTool } from "@/components/tools/pdf-to-image-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("pdf-ke-foto");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PdfKeFotoPage() {
  return (
    <ToolPageShell>
      <PdfToImageTool />
    </ToolPageShell>
  );
}
