import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { ImageToPdfTool } from "@/components/tools/image-to-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("foto-ke-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function FotoKePdfPage() {
  return (
    <ToolPageShell>
      <ImageToPdfTool />
    </ToolPageShell>
  );
}
