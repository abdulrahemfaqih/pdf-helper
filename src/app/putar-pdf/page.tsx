import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { RotatePdfTool } from "@/components/tools/rotate-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("putar-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PutarPdfPage() {
  return (
    <ToolPageShell>
      <RotatePdfTool />
    </ToolPageShell>
  );
}
