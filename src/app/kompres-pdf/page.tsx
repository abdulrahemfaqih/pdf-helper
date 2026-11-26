import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { CompressPdfTool } from "@/components/tools/compress-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("kompres-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function KompresPdfPage() {
  return (
    <ToolPageShell>
      <CompressPdfTool />
    </ToolPageShell>
  );
}
