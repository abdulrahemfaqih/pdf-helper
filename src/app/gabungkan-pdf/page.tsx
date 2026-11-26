import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { MergePdfTool } from "@/components/tools/merge-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("gabungkan-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function GabungkanPdfPage() {
  return (
    <ToolPageShell>
      <MergePdfTool />
    </ToolPageShell>
  );
}
