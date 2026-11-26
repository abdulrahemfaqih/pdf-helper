import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { SplitPdfTool } from "@/components/tools/split-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("pisahkan-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PisahkanPdfPage() {
  return (
    <ToolPageShell>
      <SplitPdfTool />
    </ToolPageShell>
  );
}
