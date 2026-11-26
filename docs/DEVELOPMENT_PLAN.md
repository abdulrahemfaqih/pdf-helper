# Alur Development & Instruksi Delegasi AI Agent

Dokumen ini adalah panduan eksekusi langkah demi langkah bagi AI Agent. **Kerjakan secara berurutan per fase.** Jangan melompat ke fase berikutnya sebelum semua *checklist* verifikasi pada fase aktif terpenuhi tanpa error TypeScript maupun build error.

---

## 1. Struktur Folder Proyek

Gunakan struktur modular agar setiap alat terisolasi, mudah di-debug, dan mendukung *code splitting* otomatis oleh Next.js App Router:

```text
src/
├── app/
│   ├── layout.tsx                 # Root layout, Font Inter & Geist Mono, Toaster (sonner)
│   ├── globals.css                # Tailwind v4 @import "tailwindcss", @theme OKLCH tokens
│   ├── page.tsx                   # Homepage (Grid 10 Alat)
│   ├── gabungkan-pdf/page.tsx
│   ├── pisahkan-pdf/page.tsx
│   ├── kompres-pdf/page.tsx
│   ├── pdf-ke-word/page.tsx
│   ├── word-ke-pdf/page.tsx
│   ├── edit-pdf/page.tsx
│   ├── pdf-ke-foto/page.tsx
│   ├── foto-ke-pdf/page.tsx
│   ├── putar-pdf/page.tsx
│   └── atur-pdf/page.tsx
├── components/
│   ├── ui/                        # Komponen shadcn/ui
│   ├── layout/
│   │   ├── navbar.tsx             # Header global + dropdown Semua Alat
│   │   └── footer.tsx             # Footer minimal 1 baris
│   ├── shared/
│   │   ├── file-dropzone.tsx      # Komponen drag & drop reusable
│   │   ├── tool-workspace.tsx     # Kerangka split layout (Canvas + Sidebar)
│   │   ├── processing-state.tsx   # Tampilan progress bar saat proses
│   │   ├── result-state.tsx       # Tampilan unduh hasil & reset
│   │   └── pdf-thumbnail.tsx      # Lazy-rendered thumbnail halaman via pdfjs-dist
│   └── tools/                     # Komponen client khusus per alat
│       ├── merge-pdf-tool.tsx
│       ├── split-pdf-tool.tsx
│       ├── compress-pdf-tool.tsx
│       ├── pdf-to-word-tool.tsx
│       ├── word-to-pdf-tool.tsx
│       ├── edit-pdf-tool.tsx
│       ├── pdf-to-image-tool.tsx
│       ├── image-to-pdf-tool.tsx
│       ├── rotate-pdf-tool.tsx
│       └── organize-pdf-tool.tsx
├── lib/
│   ├── tools-config.ts            # Metadata 10 alat (slug, nama, deskripsi, ikon)
│   ├── file-utils.ts              # Format bytes, validasi MIME, trigger download, ZIP helper
│   ├── pdf/
│   │   ├── pdfjs-worker.ts        # Setup worker pdfjs-dist yang aman untuk Next.js/Turbopack
│   │   ├── merge.ts
│   │   ├── split.ts
│   │   ├── compress.ts
│   │   ├── rotate.ts
│   │   ├── organize.ts
│   │   ├── image-to-pdf.ts
│   │   ├── pdf-to-image.ts
│   │   ├── edit.ts
│   │   └── conversion-adapter.ts  # Interface & implementasi PDF <-> Word
│   └── utils.ts                   # cn() helper dari shadcn/ui
```

---

## 2. Fase Pengembangan (Execution Roadmap)

### Phase 0: Inisialisasi Proyek & Design System
**Tujuan**: Menyiapkan fondasi Next.js 16, Tailwind CSS v4, shadcn/ui, worker `pdfjs-dist`, dan token warna Hitam-Putih-Biru.

1. Inisialisasi proyek Next.js terbaru dengan TypeScript, Tailwind CSS v4, ESLint, App Router, dan direktori `src/`:
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack
   ```
2. Inisialisasi `shadcn/ui`:
   ```bash
   npx shadcn@latest init
   ```
   Tambahkan komponen: `button`, `card`, `input`, `label`, `radio-group`, `select`, `slider`, `progress`, `dropdown-menu`, `tooltip`, `sonner`.
3. Instal paket dasar rendering PDF agar `next.config.ts` dan komponen shared Phase 1 langsung terkompilasi bersih:
   ```bash
   npm install pdfjs-dist
   ```
4. Konfigurasi `src/app/globals.css` dengan token warna OKLCH dari `DESIGN_SYSTEM.md` (pastikan warna `--primary` adalah Biru `#2563EB`, background `#FFFFFF`, foreground `#09090B`).
5. Konfigurasi `next.config.ts` agar kompatibel dengan `pdfjs-dist` di Next.js 16 + Turbopack (`turbopack.resolveAlias` untuk `canvas`, serta salin/sediakan `pdf.worker.min.mjs` di `public/` dan pastikan modul `pdfjs-dist` hanya di-import secara dinamis di client agar tidak memicu error SSR `DOMMatrix is not defined`).

**Verifikasi Phase 0**:
- `npm run dev` dan `npx tsc --noEmit` berjalan tanpa error.
- Tidak ada warning CSS Tailwind v4.

---

### Phase 1: Core Layout, Homepage & Shared Components
**Tujuan**: Membangun antarmuka utama dan komponen fondasi yang dipakai bersama oleh seluruh 10 alat.

1. Buat `src/lib/tools-config.ts` berisi definisi ke-10 alat (slug, judul, deskripsi singkat 1 kalimat, nama ikon Lucide).
2. Buat `src/lib/file-utils.ts` & `src/lib/pdf/pdfjs-worker.ts`:
   - Format bytes, validasi ekstensi & MIME type, deteksi error PDF terenkripsi kata sandi, peringatan halus jika total ukuran file `> 150 MB`, trigger download, dan helper `URL.revokeObjectURL`.
3. Bangun `Navbar` (`h-14`, sticky, brand **PDFAlat** + breadcrumb halaman fitur, dropdown "Semua Alat") dan `Footer` minimalis.
4. Bangun `src/app/page.tsx` (Homepage):
   - Heading ringkas tanpa eyebrow/emoji/gradien.
   - Grid responsif 10 kartu alat yang langsung terlihat *above the fold*.
5. Bangun komponen `shared/`:
   - `FileDropzone`: Mendukung drag & drop, klik file picker, validasi ekstensi/MIME, peringatan ukuran `> 150 MB`, dan state drag-active warna biru.
   - `ToolWorkspace`: Layout 2 kolom (kanvas + sidebar 320px di desktop, responsif dengan CTA sticky di mobile).
   - `ProcessingState` & `ResultState` (mendukung hasil single-file maupun multi-file/ZIP + perbandingan metrik ukuran).
   - `PdfThumbnail`: Menggunakan `IntersectionObserver` + dynamic import `pdfjs-dist` untuk merender preview halaman secara *lazy* dan membersihkan memori saat unmount.

**Verifikasi Phase 1**:
- Audit visual terhadap `DESIGN_SYSTEM.md`: Pastikan **0 gradien, 0 emoji, 0 eyebrow badge**.
- Semua 10 rute placeholder dapat diklik dari homepage dan dropdown navbar tanpa error `tsc --noEmit` maupun `npm run build`.

---

### Phase 2: Fitur Manipulasi Struktur PDF (5 Fitur Inti)
**Tujuan**: Mengimplementasikan fitur berbasis `pdf-lib` + `@dnd-kit` dengan performa cepat.

Instal dependensi: `npm install pdf-lib jszip @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities zustand`

1. **Gabungkan PDF** (`/gabungkan-pdf`): Multi-file upload (minimal 2 file untuk merge), reorder dengan `@dnd-kit`, merge via `pdf-lib`.
2. **Pisahkan PDF** (`/pisahkan-pdf`): Mode pilih halaman klik thumbnail, input rentang (`1-3, 5`), pisah semua ke ZIP.
3. **Putar PDF** (`/putar-pdf`): Rotasi global dan per halaman dengan preview visual langsung pada thumbnail.
4. **Atur PDF** (`/atur-pdf`): Reorder drag & drop per halaman, hapus halaman dengan dukungan Undo, duplikat, sisipkan halaman dari PDF lain (`+ Tambah PDF` dengan pelacakan sumber dokumen per halaman), dan tombol reverse order.
5. **Foto ke PDF** (`/foto-ke-pdf`): Multi-image upload (JPG/PNG/WebP — normalisasi `.webp` dan orientasi EXIF ke PNG/JPEG via `createImageBitmap` + `<canvas>` sebelum `pdf-lib`), reorder, opsi ukuran halaman (A4/Letter/Fit), orientasi, dan margin.

**Verifikasi Phase 2**:
- Uji unggah PDF multi-halaman (>10 halaman) pada setiap fitur.
- Pastikan file hasil unduhan valid dan dapat dibuka di PDF viewer sistem.
- Pastikan `URL.revokeObjectURL` dipanggil saat reset.

---

### Phase 3: Fitur Rendering & Optimasi (2 Fitur)
**Tujuan**: Mengimplementasikan rendering gambar resolusi tinggi dan kompresi ukuran file.

1. **PDF ke Foto** (`/pdf-ke-foto`):
   - Render halaman via `pdfjs-dist` ke offscreen canvas.
   - Opsi format JPG/PNG dan DPI (150 / 300).
   - Unduh langsung jika 1 halaman, atau otomatis bundle via `jszip` jika > 1 halaman.
2. **Kompres PDF** (`/kompres-pdf`):
   - Implementasikan 3 level kompresi client-side: **Ringan** (`pdf-lib` dengan `useObjectStreams: true`), **Rekomendasi**, dan **Ekstrem** (rasterisasi terukur via `pdfjs-dist` + JPEG re-encoding dengan variasi DPI & kualitas, disertai catatan transparan di UI bahwa mode ini merasterisasi halaman).
   - Mendukung 1 atau beberapa file (otomatis `.zip` jika > 1 file) dan tampilkan metrik perbandingan ukuran (`Awal -> Akhir` dan `% penghematan`).
   - Pastikan proses berjalan asinkron dengan update progress bar per halaman agar UI tidak macet.

**Verifikasi Phase 3**:
- Hasil kompresi benar-benar lebih kecil ukurannya pada PDF berisi gambar/scan.
- Kualitas teks pada PDF ke Foto 300 DPI tajam dan tidak terpotong.

---

### Phase 4: Fitur Konversi Dokumen & Editor Interaktif (3 Fitur Kompleks)
**Tujuan**: Menyelesaikan fitur dengan interaksi dan parsing paling kompleks.

Instal dependensi: `npm install docx mammoth jspdf html2canvas` (dengan rendering HTML terisolasi untuk mencegah konflik `oklch()` Tailwind v4).

1. **PDF ke Word** (`/pdf-ke-word`):
   - Ekstrak teks dan posisi baris/paragraf dari setiap halaman menggunakan `pdfjs-dist`.
   - Jika tidak ada teks yang dapat diekstrak (PDF hasil scan), tampilkan peringatan jelas daripada mengunduh `.docx` kosong.
   - Susun dokumen `.docx` yang bersih menggunakan `docx`.
   - Buat abstraksi `ConversionAdapter` agar mudah diganti ke engine server jika suatu saat dideploy dengan Docker/LibreOffice.
2. **Word ke PDF** (`/word-ke-pdf`):
   - Mendukung 1 atau beberapa `.docx` (otomatis `.zip` jika > 1 file).
   - Parse `.docx` menggunakan `mammoth` ke HTML terstruktur di dalam `iframe` terisolasi dengan CSS warna hex eksplisit (hindari pewarisan token `oklch()` Tailwind v4 yang membuat `html2canvas` gagal).
   - Render ke PDF via `jsPDF` dengan paginasi berbasis blok elemen DOM (agar teks/tabel tidak terpotong di tengah baris) serta opsi ukuran halaman (A4 / Letter) dan margin.
3. **Edit PDF** (`/edit-pdf`):
   - Bangun workspace dengan Top Toolbar, Thumbnail Sidebar, dan Interactive Canvas.
   - Fitur wajib: Tambah Teks (bisa digeser & ubah ukuran/warna), Gambar Bebas/Tanda Tangan (SVG/Canvas path), Bentuk dasar (Kotak/Garis), Sisipkan Gambar (PNG/JPG/WebP, normalisasi WebP via `<canvas>`), Zoom In/Out, dan Undo/Redo (`zustand`).
   - Saat klik **"Simpan PDF"**, proyeksikan koordinat layar secara akurat ke sistem koordinat PDF (`pdf-lib`, origin di kiri-bawah) dengan memperhitungkan level zoom, `CropBox`, dan rotasi halaman (`/Rotate`) agar posisi elemen tepat 100%.

**Verifikasi Phase 4**:
- Pada **Edit PDF**, teks dan tanda tangan yang ditambahkan berada di posisi yang persis sama saat PDF hasil unduhan dibuka kembali (termasuk pada halaman dengan rotasi `90`/`180`/`270`).
- Konversi Word <-> PDF berjalan mulus di browser tanpa error `oklch`, CORS, atau server.

---

### Phase 5: Optimasi Performa, QA & Build Verification
**Tujuan**: Memastikan aplikasi siap produksi, cepat, dan bebas bug.

1. **Dynamic Imports**: Pastikan seluruh modul `src/lib/pdf/*` dan library berat hanya dimuat saat pengguna membuka rute alat tersebut (verifikasi chunk JS di `.next/static/chunks` hasil `npm run build` agar homepage tetap ramping).
2. **Error Handling Audit**:
   - Uji file yang bukan format semestinya (misal: upload `.txt` di halaman Merge PDF).
   - Uji PDF kosong atau terenkripsi kata sandi -> pastikan muncul toast error yang ramah dari `sonner`.
3. **Responsive Audit**: Uji seluruh 10 halaman di viewport Mobile (`375px`), Tablet (`768px`), dan Desktop (`1440px`).
4. **Final Build Check**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

---

## 3. Aturan Kerja untuk AI Agent

- **Jangan membuat fitur mock/palsu**: Semua 10 alat harus benar-benar memproses file nyata dan menghasilkan file unduhan yang valid.
- **Bahasa Antarmuka**: 100% Bahasa Indonesia yang natural, ringkas, dan profesional (contoh: gunakan *"Gabungkan PDF"*, *"Unduh"*, *"Pilih File"*, bukan terjemahan kaku).
- **Kebersihan Kode**: Hindari `any` di TypeScript; pisahkan logika pemrosesan file di `src/lib/pdf/` dari komponen UI di `src/components/tools/`.