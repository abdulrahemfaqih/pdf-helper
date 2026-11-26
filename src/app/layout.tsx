import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  title: {
    default: `${SITE_NAME} — Alat PDF Cepat Tanpa Login`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Utilitas PDF gratis tanpa login dan tanpa batas. Gabungkan, pisahkan, kompres, konversi Word/foto, edit, putar, dan atur PDF langsung di browser Anda.",
  keywords: [
    "alat pdf gratis",
    "pdf online tanpa login",
    "gabungkan pdf",
    "pisahkan pdf",
    "kompres pdf",
    "pdf ke word",
    "word ke pdf",
    "edit pdf online",
    "pdf ke foto",
    "foto ke pdf",
    "putar pdf",
    "atur pdf",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Alat PDF Cepat Tanpa Login`,
    description:
      "10 alat PDF gratis tanpa login. Semua proses berjalan aman langsung di browser Anda.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Alat PDF Cepat Tanpa Login`,
    description:
      "10 alat PDF gratis tanpa login. Semua proses berjalan aman langsung di browser Anda.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <TooltipProvider>
          <PwaRegister />
          {children}
          <Toaster position="bottom-right" theme="light" />
        </TooltipProvider>
      </body>
    </html>
  );
}
