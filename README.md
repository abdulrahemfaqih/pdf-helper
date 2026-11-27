# PDFAlat

Aplikasi web utilitas PDF **100% gratis, tanpa login, dan tanpa upload ke server** (**PWA**) berbasis **Next.js 16 (App Router, Turbopack)**, **Tailwind CSS v4**, dan **shadcn/ui**.

Live production: [https://pdf-helpers.vercel.app](https://pdf-helpers.vercel.app)

## Fitur Utama (10 Alat Client-Side)

Seluruh pemrosesan berjalan langsung di browser menggunakan `pdf-lib`, `pdfjs-dist`, `jszip`, `docx`, `mammoth`, `jspdf`, dan `html2canvas`:

1. **Gabungkan PDF** (`/gabungkan-pdf`)
2. **Pisahkan PDF** (`/pisahkan-pdf`)
3. **Kompres PDF** (`/kompres-pdf`)
4. **PDF ke Word** (`/pdf-ke-word`)
5. **Word ke PDF** (`/word-ke-pdf`)
6. **Edit PDF** (`/edit-pdf`)
7. **PDF ke Foto** (`/pdf-ke-foto`)
8. **Foto ke PDF** (`/foto-ke-pdf`)
9. **Putar PDF** (`/putar-pdf`)
10. **Atur PDF** (`/atur-pdf`)

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

Dokumentasi spesifikasi dan arsitektur tersedia di folder [docs/](file:///d:/PROJECT/pdf-helper/docs).
