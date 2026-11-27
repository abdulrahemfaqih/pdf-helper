# PDFAlat

Aplikasi web utilitas PDF gratis, tanpa login, dan responsif (**PWA**) berbasis **Next.js 16 (App Router, Turbopack)**, **Tailwind CSS v4**, dan **shadcn/ui**.

Live production: [https://pdf-helpers.vercel.app](https://pdf-helpers.vercel.app)

## Fitur Utama (10 Alat)

- **Client-Side di Browser** (`pdf-lib`, `pdfjs-dist`, `jszip`, `mammoth`, `jspdf`, `html2canvas`):
  1. **Gabungkan PDF** (`/gabungkan-pdf`)
  2. **Pisahkan PDF** (`/pisahkan-pdf`)
  3. **Kompres PDF** (`/kompres-pdf`)
  4. **Word ke PDF** (`/word-ke-pdf`)
  5. **Edit PDF** (`/edit-pdf`)
  6. **PDF ke Foto** (`/pdf-ke-foto`)
  7. **Foto ke PDF** (`/foto-ke-pdf`)
  8. **Putar PDF** (`/putar-pdf`)
  9. **Atur PDF** (`/atur-pdf`)
- **Microservice Python `pdf2docx`** (`pdf-to-word-service/`, di-deploy ke **Koyeb**):
  10. **PDF ke Word** (`/pdf-ke-word`) — menjaga gambar, garis pemisah, layout kolom, bullet list, font, dan hyperlink (maksimal 10 MB, file sementara di `/tmp` langsung dihapus setelah selesai).

## Menjalankan Secara Lokal

### 1. Frontend Next.js
```bash
npm install
# Tambahkan di .env.local untuk fitur PDF ke Word lokal:
# NEXT_PUBLIC_PDF_TO_WORD_API_URL=http://localhost:8000
npm run dev
```

### 2. Microservice PDF ke Word (`pdf-to-word-service/`)
```bash
cd pdf-to-word-service
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Environment Variables

- **Vercel**: `NEXT_PUBLIC_PDF_TO_WORD_API_URL` (URL publik microservice Koyeb, misal `https://nama-service.koyeb.app`)
- **Koyeb**: `ALLOWED_ORIGINS` (origin frontend yang diizinkan, misal `https://pdf-helpers.vercel.app`)

Panduan arsitektur, spesifikasi UI, dan langkah deploy lengkap tersedia di folder [docs/](file:///d:/PROJECT/pdf-helper/docs).
