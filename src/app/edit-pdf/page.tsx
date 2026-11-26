import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { EditPdfTool } from "@/components/tools/edit-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("edit-pdf");

export default function EditPdfPage() {
  return (
    <ToolPageShell toolSlug="edit-pdf">
      <EditPdfTool />
    </ToolPageShell>
  );
}
