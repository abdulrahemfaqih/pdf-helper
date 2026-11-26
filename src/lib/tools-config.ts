import type { LucideIcon } from "lucide-react";
import {
  Files,
  FileOutput,
  FileText,
  Image,
  Images,
  LayoutGrid,
  Minimize2,
  PenLine,
  RotateCw,
  Scissors,
} from "lucide-react";

export type ToolSlug =
  | "gabungkan-pdf"
  | "pisahkan-pdf"
  | "kompres-pdf"
  | "pdf-ke-word"
  | "word-ke-pdf"
  | "edit-pdf"
  | "pdf-ke-foto"
  | "foto-ke-pdf"
  | "putar-pdf"
  | "atur-pdf";

export interface ToolConfig {
  slug: ToolSlug;
  href: `/${ToolSlug}`;
  title: string;
  description: string;
  icon: LucideIcon;
  acceptLabel: string;
  acceptExtensions: string[];
  multiple: boolean;
}

export const TOOLS_CONFIG: ToolConfig[] = [
  {
    slug: "gabungkan-pdf",
    href: "/gabungkan-pdf",
    title: "Gabungkan PDF",
    description: "Satukan beberapa file PDF menjadi satu dokumen berurutan.",
    icon: Files,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: true,
  },
  {
    slug: "pisahkan-pdf",
    href: "/pisahkan-pdf",
    title: "Pisahkan PDF",
    description: "Ekstrak halaman tertentu atau pisah semua halaman PDF.",
    icon: Scissors,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: false,
  },
  {
    slug: "kompres-pdf",
    href: "/kompres-pdf",
    title: "Kompres PDF",
    description: "Perkecil ukuran file PDF dengan kontrol tingkat kualitas.",
    icon: Minimize2,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: true,
  },
  {
    slug: "pdf-ke-word",
    href: "/pdf-ke-word",
    title: "PDF ke Word",
    description: "Ubah dokumen PDF berbasis teks menjadi file DOCX.",
    icon: FileText,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: false,
  },
  {
    slug: "word-ke-pdf",
    href: "/word-ke-pdf",
    title: "Word ke PDF",
    description: "Konversi dokumen Word DOCX menjadi PDF siap cetak.",
    icon: FileOutput,
    acceptLabel: "DOCX",
    acceptExtensions: [".docx"],
    multiple: true,
  },
  {
    slug: "edit-pdf",
    href: "/edit-pdf",
    title: "Edit PDF",
    description: "Tambahkan teks, tanda tangan, bentuk, dan gambar ke PDF.",
    icon: PenLine,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: false,
  },
  {
    slug: "pdf-ke-foto",
    href: "/pdf-ke-foto",
    title: "PDF ke Foto",
    description: "Render setiap halaman PDF menjadi gambar JPG atau PNG.",
    icon: Image,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: false,
  },
  {
    slug: "foto-ke-pdf",
    href: "/foto-ke-pdf",
    title: "Foto ke PDF",
    description: "Ubah gambar JPG, PNG, atau WebP menjadi satu file PDF.",
    icon: Images,
    acceptLabel: "JPG, PNG, WEBP",
    acceptExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    multiple: true,
  },
  {
    slug: "putar-pdf",
    href: "/putar-pdf",
    title: "Putar PDF",
    description: "Putar orientasi halaman PDF secara global atau per halaman.",
    icon: RotateCw,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: false,
  },
  {
    slug: "atur-pdf",
    href: "/atur-pdf",
    title: "Atur PDF",
    description: "Ubah urutan, hapus, duplikat, atau sisipkan halaman PDF.",
    icon: LayoutGrid,
    acceptLabel: "PDF",
    acceptExtensions: [".pdf"],
    multiple: false,
  },
];

export function getToolBySlug(slug: ToolSlug): ToolConfig {
  const found = TOOLS_CONFIG.find((tool) => tool.slug === slug);
  if (!found) {
    throw new Error(`Tool config not found for slug: ${slug}`);
  }
  return found;
}
