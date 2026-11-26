import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { OrganizePdfTool } from "@/components/tools/organize-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("atur-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function AturPdfPage() {
  return (
    <ToolPageShell>
      <OrganizePdfTool />
    </ToolPageShell>
  );
}
