import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { WordToPdfTool } from "@/components/tools/word-to-pdf-tool";
import { buildToolMetadata } from "@/lib/seo";

export const metadata: Metadata = buildToolMetadata("word-ke-pdf");

export default function WordKePdfPage() {
  return (
    <ToolPageShell toolSlug="word-ke-pdf">
      <WordToPdfTool />
    </ToolPageShell>
  );
}
