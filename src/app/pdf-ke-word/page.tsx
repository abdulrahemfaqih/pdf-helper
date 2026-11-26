import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { PdfToWordTool } from "@/components/tools/pdf-to-word-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("pdf-ke-word");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PdfKeWordPage() {
  return (
    <ToolPageShell>
      <PdfToWordTool />
    </ToolPageShell>
  );
}
