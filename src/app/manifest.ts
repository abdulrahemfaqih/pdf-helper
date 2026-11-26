import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PDFAlat — Alat PDF Cepat Tanpa Login",
    short_name: "PDFAlat",
    description:
      "Utilitas PDF gratis, tanpa login, dan diproses aman langsung di browser Anda.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#2563EB",
    lang: "id",
  };
}
