import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { CompressPdfTool } from "@/components/tools/compress-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("kompres-pdf");

export default function KompresPdfPage() {
  return (
    <ToolPageShell toolSlug="kompres-pdf">
      <CompressPdfTool />
    </ToolPageShell>
  );
}
