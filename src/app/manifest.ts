import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PDFAlat — Alat PDF Cepat Tanpa Login",
    short_name: "PDFAlat",
    description:
      "10 utilitas PDF gratis tanpa login. Gabung, pisah, kompres, konversi Word/foto, edit, putar, dan atur PDF langsung di browser.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FFFFFF",
    theme_color: "#2563EB",
    lang: "id",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon1.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Gabungkan PDF",
        short_name: "Gabungkan",
        url: "/gabungkan-pdf",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Pisahkan PDF",
        short_name: "Pisahkan",
        url: "/pisahkan-pdf",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Kompres PDF",
        short_name: "Kompres",
        url: "/kompres-pdf",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Edit PDF",
        short_name: "Edit PDF",
        url: "/edit-pdf",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
