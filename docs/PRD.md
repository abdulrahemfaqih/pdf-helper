# Product Requirements Document (PRD) — PDF Utility Web App

## 1. Ringkasan Eksekutif & Latar Belakang

### 1.1 Masalah
Banyak layanan pengolahan PDF populer (seperti iLovePDF) menerapkan batasan jumlah file, batasan ukuran, pembatasan fitur harian, serta mewajibkan pengguna untuk mendaftar atau masuk (*login*) demi mengakses fungsi dasar. Hal ini menghambat produktivitas untuk kebutuhan dokumen yang cepat dan berulang.

### 1.2 Solusi
Membangun aplikasi web utilitas PDF yang **100% gratis, tanpa login, tanpa registrasi, dan tanpa batasan buatan**. Aplikasi dirancang dengan pendekatan *client-side first* (pemrosesan langsung di browser pengguna menggunakan WebAssembly & JavaScript modern) sehingga:
- **Privasi terjaga**: File pengguna tidak perlu diunggah ke server untuk mayoritas fitur.
- **Performa cepat**: Tidak ada latensi unggah/unduh jaringan untuk operasi lokal.
- **Akses instan**: Buka halaman, jatuhkan file (*drag & drop*), proses, dan unduh.

### 1.3 Target Pengguna
Pelajar, mahasiswa, pekerja kantoran, freelancer, dan siapa saja yang membutuhkan alat PDF cepat tanpa friksi akun atau iklan yang mengganggu.

---

## 2. Prinsip Produk (Non-Negotiable)

1. **Zero Friction / No Auth**: Tidak ada halaman login, tidak ada tombol daftar, tidak ada modal paywall, tidak ada cookie tracking yang mengganggu.
2. **Tool-First Interface**: Pengguna langsung melihat daftar 10 alat utama saat membuka halaman utama (*above the fold*), tanpa halaman pemasaran yang bertele-tele.
3. **Client-Side First**: Seluruh pemrosesan dilakukan di browser secara default. Pemrosesan sisi server hanya digunakan sebagai opsi opsional (*graceful fallback*) jika dibutuhkan konversi tingkat lanjut.
4. **Feedback Jelas & Cepat**: Setiap proses menampilkan *progress bar* nyata, estimasi/ukuran file sebelum-sesudah, dan pesan error yang spesifik jika file rusak atau terenkripsi kata sandi.

---

## 3. Tech Stack (Versi Terbaru)

AI Agent wajib menggunakan versi stabil terbaru berikut:

- **Framework**: Next.js `16.4.x` (App Router, Turbopack, React `19.3`)
- **Bahasa**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS `4.3.x` (CSS-first configuration menggunakan `@theme`, tanpa `tailwind.config.js`)
- **UI Components**: `shadcn/ui` terbaru (`npx shadcn@latest init`, style `new-york`, Tailwind v4 & OKLCH tokens, `sonner` untuk notifikasi toast)
- **Ikon**: `lucide-react` (stroke `1.5px` atau `1.75px`)
- **State Management**: React State / `zustand` (ringan, untuk state workspace editor dan riwayat Undo/Redo pada `Edit PDF` & `Atur PDF`)
- **Drag & Drop**: `@dnd-kit/core` dan `@dnd-kit/sortable` (untuk urutan halaman/file yang responsif di desktop & mobile)

### Library Pemrosesan PDF & Dokumen
- **Manipulasi Struktur PDF**: `pdf-lib` (Merge, Split, Rotate, Organize, Image-to-PDF, Flatten Edit)
- **Rendering & Preview PDF**: `pdfjs-dist` (Render halaman ke `<canvas>` untuk thumbnail, preview, dan PDF-to-Image, dijalankan secara non-blocking dengan Web Worker)
- **Arsip Multi-File**: `jszip` (Mengunduh banyak file hasil split/kompresi/konversi sekaligus dalam satu `.zip`)
- **Kompresi PDF**: Pendekatan berlapis 100% client-side di browser:
  - *Level Ringan*: Optimasi struktur objek (`pdf-lib` dengan `useObjectStreams: true`) tanpa merasterisasi teks.
  - *Level Rekomendasi & Ekstrem*: Rasterisasi halaman terukur & kompresi JPEG via `pdfjs-dist` + `OffscreenCanvas` / `canvas.toBlob('image/jpeg', quality)` dengan variasi DPI dan kualitas. UI wajib menampilkan catatan transparan bahwa level Rekomendasi/Ekstrem merasterisasi halaman demi pengurangan ukuran maksimal.
- **Konversi Word <-> PDF**:
  - *Tier 1 (Default Client-Side / Zero-Backend)*:
    - **PDF ke Word**: Ekstraksi teks & struktur paragraf menggunakan `pdfjs-dist` lalu pembentukan file `.docx` menggunakan library `docx`. Jika PDF berupa hasil scan tanpa lapisan teks, sistem memberi peringatan jelas bahwa dokumen berbasis gambar tidak dapat diekstrak (tanpa OCR).
    - **Word ke PDF**: Parsing `.docx` ke HTML terstruktur menggunakan `mammoth` di dalam `iframe` terisolasi (dengan stylesheet warna hex eksplisit agar aman dari token `oklch()` Tailwind CSS v4), lalu dirender ke PDF multi-halaman via `jsPDF` dengan pemecahan halaman berbasis blok DOM agar teks tidak terpotong di tengah baris.
  - *Tier 2 (Arsitektur Siap Ekstensi)*: Abstraksi melalui interface `ConversionAdapter` sehingga di masa depan dapat dihubungkan ke API Route / Docker LibreOffice (`soffice --headless`) tanpa mengubah kode UI.

---

## 4. Spesifikasi Detail 10 Fitur & Alur UX

Setiap fitur memiliki rute independen (`/gabungkan-pdf`, `/pisahkan-pdf`, dst.) dengan pola UX seragam:
**State 1: Upload Zone** -> **State 2: Workspace & Konfigurasi** -> **State 3: Processing** -> **State 4: Result & Download**.

### 4.1 Gabungkan PDF (`/gabungkan-pdf`)
- **Fungsi**: Menggabungkan 2 atau lebih file PDF menjadi 1 file PDF.
- **Alur UX**:
  1. Unggah multi-file PDF (*drag & drop* atau tombol pilih file).
  2. Tampilkan daftar/grid file dengan thumbnail halaman pertama, nama file, jumlah halaman, dan ukuran file.
  3. Pengguna dapat mengubah urutan file dengan *drag & drop* (`@dnd-kit`), menambah file lagi, atau menghapus file tertentu.
  4. Klik **"Gabungkan PDF"** -> proses instan -> unduh hasil (`gabungan.pdf`).

### 4.2 Pisahkan PDF (`/pisahkan-pdf`)
- **Fungsi**: Memisahkan halaman dari 1 file PDF menjadi beberapa file atau mengekstrak halaman tertentu.
- **Alur UX**:
  1. Unggah 1 file PDF.
  2. Tampilkan grid seluruh thumbnail halaman bernomor.
  3. Panel samping menyediakan 3 mode:
     - **Pilih Halaman**: Klik langsung thumbnail halaman yang ingin diekstrak.
     - **Rentang Kustom**: Input rentang teks (contoh: `1-3, 5, 8-10`) dengan opsi *gabungkan semua rentang jadi 1 PDF* atau *pisah per rentang*.
     - **Pisahkan Semua**: Setiap halaman menjadi 1 file PDF terpisah.
  4. Jika hasil > 1 file, otomatis dikemas dalam `.zip`.

### 4.3 Kompres PDF (`/kompres-pdf`)
- **Fungsi**: Memperkecil ukuran file PDF dengan kontrol rasio kualitas.
- **Alur UX**:
  1. Unggah 1 atau beberapa file PDF.
  2. Pilih tingkat kompresi di panel samping (Radio Card):
     - **Kompresi Ringan**: Kualitas tinggi, teks tetap vektor, pengurangan ukuran moderat.
     - **Kompresi Rekomendasi**: Seimbang antara keterbacaan dan ukuran file (rasterisasi terukur).
     - **Kompresi Ekstrem**: Ukuran sekecil mungkin (cocok untuk dokumen scan/lampiran email).
  3. Setelah selesai, tampilkan perbandingan metrik yang jelas per file maupun total: `Ukuran Awal -> Ukuran Akhir (Hemat XX%)`. Jika mengunggah lebih dari 1 file, hasil otomatis dikemas dalam `.zip`.

### 4.4 PDF ke Word (`/pdf-ke-word`)
- **Fungsi**: Mengonversi dokumen PDF menjadi file Microsoft Word (`.docx`) yang dapat diedit.
- **Alur UX**:
  1. Unggah 1 file PDF.
  2. Tampilkan info halaman & catatan transparan bahwa PDF berbasis teks (*text-selectable*) akan mempertahankan struktur paragraf dengan baik, sedangkan PDF hasil scan tidak didukung OCR.
  3. Klik **"Konversi ke Word"** -> jika teks tidak ditemukan tampilkan peringatan jelas; jika tersedia hasilkan dan unduh `.docx`.

### 4.5 Word ke PDF (`/word-ke-pdf`)
- **Fungsi**: Mengonversi file `.docx` menjadi dokumen PDF siap cetak.
- **Alur UX**:
  1. Unggah 1 atau beberapa file `.docx`.
  2. Tampilkan preview dokumen singkat & opsi ukuran halaman (A4 / Letter) dan margin.
  3. Klik **"Konversi ke PDF"** -> hasilkan dan unduh `.pdf` (atau `.zip` jika > 1 file).

### 4.6 Edit PDF (`/edit-pdf`)
- **Fungsi**: Menambahkan anotasi, teks, tanda tangan, bentuk, atau gambar di atas halaman PDF.
- **Alur UX**:
  1. Unggah 1 file PDF.
  2. Workspace terdiri dari:
     - **Top Toolbar**: Pilih alat (`Pilih/Geser`, `Tambah Teks`, `Gambar Bebas/Tanda Tangan`, `Bentuk: Kotak/Garis`, `Sisipkan Gambar`), Undo/Redo, Zoom In/Out.
     - **Sidebar Kiri**: Navigasi thumbnail halaman untuk berpindah halaman dengan cepat.
     - **Canvas Utama**: Area kerja interaktif per halaman.
     - **Panel Properti Kontekstual**: Ukuran font, warna teks/garis (Hitam, Biru, Merah, Putih), ketebalan garis.
  3. Klik **"Simpan PDF"** -> semua elemen di-flatten permanen ke dalam PDF baru via `pdf-lib` dengan memperhitungkan rotasi halaman (`/Rotate`), `CropBox`, serta normalisasi gambar `.webp` ke PNG/JPEG.

### 4.7 PDF ke Foto (`/pdf-ke-foto`)
- **Fungsi**: Mengubah halaman PDF menjadi file gambar (`.jpg` atau `.png`).
- **Alur UX**:
  1. Unggah 1 file PDF.
  2. Preview grid halaman; pengguna bisa memilih "Semua Halaman" atau memilih halaman tertentu.
  3. Opsi di panel samping:
     - **Format**: `JPG` atau `PNG`.
     - **Resolusi / Kualitas**: Standar (150 DPI) atau Tinggi (300 DPI).
  4. Unduh 1 gambar langsung (jika 1 halaman) atau file `.zip` (jika banyak halaman).

### 4.8 Foto ke PDF (`/foto-ke-pdf`)
- **Fungsi**: Mengonversi 1 atau banyak gambar (`.jpg`, `.jpeg`, `.png`, `.webp`) menjadi 1 file PDF. Gambar `.webp` dan orientasi EXIF dinormalisasi via `<canvas>` / `createImageBitmap` menjadi PNG/JPEG sebelum disematkan oleh `pdf-lib`.
- **Alur UX**:
  1. Unggah banyak gambar sekaligus.
  2. Tampilkan grid preview gambar yang bisa diurutkan ulang (*drag & drop*), diputar per gambar, atau dihapus.
  3. Panel samping:
     - **Orientasi**: Potret / Lanskap / Otomatis.
     - **Ukuran Halaman**: A4 / Letter / Sesuaikan Ukuran Gambar.
     - **Margin**: Tanpa Margin / Kecil / Besar.
  4. Klik **"Buat PDF"** -> unduh hasil.

### 4.9 Putar PDF (`/putar-pdf`)
- **Fungsi**: Memutar orientasi halaman PDF ($90^\circ$ searah jarum jam, $90^\circ$ berlawanan, atau $180^\circ$).
- **Alur UX**:
  1. Unggah 1 file PDF.
  2. Tampilkan grid thumbnail semua halaman.
  3. Pengguna dapat:
     - Memutar **semua halaman sekaligus** lewat tombol di panel samping.
     - Memutar **halaman individual** lewat tombol putar yang muncul di tiap kartu thumbnail.
  4. Thumbnail langsung berotasi secara visual (animasi halus) sebelum file final digenerate.

### 4.10 Atur PDF (`/atur-pdf`)
- **Fungsi**: Mengelola urutan halaman, menghapus halaman yang tidak diinginkan, atau menyisipkan halaman dari PDF lain.
- **Alur UX**:
  1. Unggah 1 file PDF (dengan tombol **"+ Tambah PDF"** untuk menyisipkan halaman dari dokumen lain).
  2. Grid thumbnail interaktif mendukung:
     - *Drag & drop* untuk mengurutkan ulang halaman.
     - Tombol **Hapus** pada tiap halaman (dengan dukungan Undo).
     - Tombol **Duplikat** halaman.
     - Tombol **Urutkan Terbalik (Reverse)** di toolbar.
  3. Klik **"Simpan Perubahan"** -> unduh PDF baru.

---

## 5. Persyaratan Non-Fungsional & Performa

1. **Non-Blocking UI**: Proses berat (rendering banyak halaman `pdfjs-dist`, kompresi, pembuatan ZIP) wajib berjalan secara asinkron atau di dalam **Web Worker** agar browser tidak *freeze*.
2. **Memory Management**:
   - Wajib memanggil `URL.revokeObjectURL()` saat file dihapus atau komponen *unmount*.
   - Gunakan *lazy rendering* (`IntersectionObserver`) untuk thumbnail halaman jika PDF memiliki lebih dari 20 halaman agar RAM tetap rendah.
3. **Code Splitting**: Library berat (`pdf-lib`, `pdfjs-dist`, `jszip`, `mammoth`, `docx`, `jspdf`) wajib di-import secara dinamis (`dynamic import`) hanya pada rute fitur yang membutuhkannya agar *First Load JS* di homepage tetap sangat kecil (< 100 KB gzipped, diverifikasi melalui chunk hasil build).
4. **Error Handling**:
   - Validasi ekstensi dan MIME type file sebelum diproses.
   - Tangani PDF terproteksi password secara elegan dengan pesan jelas ("File PDF ini dilindungi kata sandi dan tidak dapat diproses").
   - Berikan peringatan halus (bukan blokir keras) jika total ukuran file sangat besar (> 150 MB) karena keterbatasan memori browser.
5. **Aksesibilitas & Responsivitas**:
   - Sepenuhnya responsif di Desktop, Tablet, dan Mobile.
   - Navigasi keyboard didukung pada tombol utama, dialog, dan pemilihan file.