import type { Metadata } from "next";
import { TOOLS_CONFIG, getToolBySlug, type ToolSlug } from "@/lib/tools-config";

export const SITE_NAME = "PDFAlat";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://pdf-helpers.vercel.app";

interface ToolSeoDetail {
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
}

const TOOL_SEO_DETAILS: Record<ToolSlug, ToolSeoDetail> = {
  "gabungkan-pdf": {
    seoTitle: "Gabungkan PDF Online Gratis Tanpa Login",
    seoDescription:
      "Gabungkan beberapa file PDF menjadi satu dokumen secara instan di browser. Urutkan file dengan drag and drop, gratis dan tanpa batas ukuran.",
    keywords: [
      "gabungkan pdf",
      "merge pdf online gratis",
      "satukan file pdf",
      "gabung pdf tanpa login",
    ],
  },
  "pisahkan-pdf": {
    seoTitle: "Pisahkan PDF Online Gratis — Ekstrak Halaman PDF",
    seoDescription:
      "Pisahkan halaman PDF atau ekstrak rentang halaman tertentu langsung di browser. Cepat, gratis, tanpa upload ke server, dan mendukung unduh ZIP.",
    keywords: [
      "pisahkan pdf",
      "split pdf online",
      "ekstrak halaman pdf",
      "potong pdf gratis",
    ],
  },
  "kompres-pdf": {
    seoTitle: "Kompres PDF Online Gratis — Perkecil Ukuran PDF",
    seoDescription:
      "Perkecil ukuran file PDF dengan 3 pilihan tingkat kompresi (Ringan, Rekomendasi, Ekstrem) langsung di browser tanpa mengurangi privasi dokumen.",
    keywords: [
      "kompres pdf",
      "perkecil ukuran pdf",
      "compress pdf online gratis",
      "kompres pdf tanpa batas",
    ],
  },
  "pdf-ke-word": {
    seoTitle: "PDF ke Word Online Gratis — Konversi PDF ke DOCX",
    seoDescription:
      "Konversi dokumen PDF berbasis teks menjadi file Microsoft Word (.docx) yang dapat diedit langsung di browser Anda secara gratis.",
    keywords: [
      "pdf ke word",
      "convert pdf to word gratis",
      "ubah pdf jadi docx",
      "konversi pdf ke word",
    ],
  },
  "word-ke-pdf": {
    seoTitle: "Word ke PDF Online Gratis — Konversi DOCX ke PDF",
    seoDescription:
      "Ubah dokumen Word (.docx) menjadi PDF siap cetak dengan pilihan ukuran kertas A4 atau Letter langsung di browser tanpa login.",
    keywords: [
      "word ke pdf",
      "docx ke pdf online",
      "ubah word jadi pdf gratis",
      "konversi word ke pdf",
    ],
  },
  "edit-pdf": {
    seoTitle: "Edit PDF Online Gratis — Tambah Teks & Tanda Tangan",
    seoDescription:
      "Tambahkan teks, tanda tangan bebas, bentuk kotak/garis, dan gambar ke file PDF langsung di browser tanpa perlu daftar akun.",
    keywords: [
      "edit pdf online gratis",
      "tanda tangan pdf online",
      "tambah teks di pdf",
      "anotasi pdf browser",
    ],
  },
  "pdf-ke-foto": {
    seoTitle: "PDF ke Foto JPG & PNG Online Gratis (150/300 DPI)",
    seoDescription:
      "Ubah halaman PDF menjadi gambar JPG atau PNG berkualitas tinggi hingga 300 DPI langsung di browser dengan opsi unduh ZIP.",
    keywords: [
      "pdf ke jpg",
      "pdf ke png",
      "pdf ke foto online",
      "konversi pdf ke gambar",
    ],
  },
  "foto-ke-pdf": {
    seoTitle: "Foto ke PDF Online Gratis — JPG, PNG & WebP ke PDF",
    seoDescription:
      "Gabungkan foto JPG, PNG, atau WebP menjadi satu dokumen PDF dengan pengaturan orientasi, margin, dan ukuran halaman A4/Letter.",
    keywords: [
      "foto ke pdf",
      "jpg ke pdf online",
      "gambar ke pdf gratis",
      "webp ke pdf",
    ],
  },
  "putar-pdf": {
    seoTitle: "Putar PDF Online Gratis — Rotasi Halaman PDF",
    seoDescription:
      "Putar orientasi halaman PDF 90 atau 180 derajat secara keseluruhan maupun per halaman dengan pratinjau langsung di browser.",
    keywords: [
      "putar pdf",
      "rotate pdf online",
      "putar halaman pdf",
      "ubah orientasi pdf",
    ],
  },
  "atur-pdf": {
    seoTitle: "Atur Halaman PDF Online Gratis — Urutkan, Hapus & Sisipkan",
    seoDescription:
      "Kelola halaman PDF dengan mudah: seret untuk mengurutkan ulang, hapus, duplikat, balik urutan, atau sisipkan halaman dari PDF lain.",
    keywords: [
      "atur halaman pdf",
      "urutkan halaman pdf",
      "hapus halaman pdf",
      "organize pdf online",
    ],
  },
};

export function buildToolMetadata(slug: ToolSlug): Metadata {
  const tool = getToolBySlug(slug);
  const seo = TOOL_SEO_DETAILS[slug];

  return {
    title: seo.seoTitle,
    description: seo.seoDescription,
    keywords: seo.keywords,
    alternates: {
      canonical: tool.href,
    },
    openGraph: {
      title: `${seo.seoTitle} | ${SITE_NAME}`,
      description: seo.seoDescription,
      url: tool.href,
      siteName: SITE_NAME,
      locale: "id_ID",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${seo.seoTitle} | ${SITE_NAME}`,
      description: seo.seoDescription,
    },
  };
}

export function buildHomeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "id-ID",
        description:
          "Aplikasi utilitas PDF gratis tanpa login yang memproses dokumen langsung di browser.",
      },
      {
        "@type": "ItemList",
        name: "Daftar Alat PDFAlat",
        itemListElement: TOOLS_CONFIG.map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.title,
          url: `${SITE_URL}${tool.href}`,
        })),
      },
    ],
  };
}

export function buildToolJsonLd(slug: ToolSlug) {
  const tool = getToolBySlug(slug);
  const seo = TOOL_SEO_DETAILS[slug];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: `${tool.title} — ${SITE_NAME}`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        inLanguage: "id-ID",
        url: `${SITE_URL}${tool.href}`,
        description: seo.seoDescription,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "IDR",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Beranda",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: tool.title,
            item: `${SITE_URL}${tool.href}`,
          },
        ],
      },
    ],
  };
}
