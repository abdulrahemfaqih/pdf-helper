import type { Metadata } from "next";
import { ToolPageShell } from "@/components/shared/tool-page-shell";
import { WordToPdfTool } from "@/components/tools/word-to-pdf-tool";
import { getToolBySlug } from "@/lib/tools-config";

const tool = getToolBySlug("word-ke-pdf");

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function WordKePdfPage() {
  return (
    <ToolPageShell>
      <WordToPdfTool />
    </ToolPageShell>
  );
}
