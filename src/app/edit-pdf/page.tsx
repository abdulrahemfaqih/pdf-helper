import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { EditPdfTool } from "@/components/tools/edit-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("edit-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function EditPdfPage() {
  return (
    <ToolPageShell>
      <EditPdfTool />
    </ToolPageShell>
  );
}
