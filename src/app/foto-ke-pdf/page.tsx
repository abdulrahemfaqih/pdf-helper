import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { ImageToPdfTool } from "@/components/tools/image-to-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("foto-ke-pdf");

export default function FotoKePdfPage() {
  return (
    <ToolPageShell toolSlug="foto-ke-pdf">
      <ImageToPdfTool />
    </ToolPageShell>
  );
}
