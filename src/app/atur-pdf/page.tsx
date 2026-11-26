import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { OrganizePdfTool } from "@/components/tools/organize-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("atur-pdf");

export default function AturPdfPage() {
  return (
    <ToolPageShell toolSlug="atur-pdf">
      <OrganizePdfTool />
    </ToolPageShell>
  );
}
