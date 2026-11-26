# Design System & Spesifikasi UI — Minimalist Utility

## 1. Filosofi Desain

Aplikasi ini mengadopsi pendekatan **Swiss Utilitarian / Minimalist Functionalism**. Fokus utama adalah kejelasan visual, kepadatan informasi yang nyaman, kontras tinggi, dan kecepatan interaksi. Antarmuka harus terasa seperti alat kerja profesional yang tenang dan presisi.

---

## 2. Aturan Ketat Anti-AI-Slop (WAJIB DITAATI AI AGENT)

AI Agent **DILARANG KERAS** menerapkan pola desain klise berikut:
1. **Tanpa Gradien**: Dilarang menggunakan `bg-gradient-to-*`, radial glow, blur blob di background, atau teks gradien. Semua warna harus solid (*flat*).
2. **Tanpa Eyebrow / Pill Badge di Atas Judul**: Dilarang menaruh teks kecil dalam kapsul di atas `<h1>` (contoh yang dilarang: `"100% Gratis • Tanpa Login"` di dalam pill biru muda).
3. **Tanpa Emoji**: Dilarang menggunakan emoji Unicode (📄, 🚀, ✨, 🔥, dll.) di mana pun dalam UI, tombol, heading, alert, atau placeholder. Gunakan ikon garis tipis dari `lucide-react`.
4. **Tanpa Tipografi Berlebihan**:
   - Dilarang membuat hero heading raksasa (`text-6xl` / `text-7xl`) yang mendorong konten utama ke bawah layar.
   - Dilarang mencampur font serif miring (*italic serif*) sebagai aksen marketing.
5. **Tanpa Elemen Marketing Palsu**: Tidak ada bagian testimoni, tidak ada logo "Dipercaya oleh...", tidak ada animasi mengambang (*floating cards*), dan tidak ada bayangan warna (*colored glow shadows*).
6. **Tanpa Dark Mode Toggle di MVP**: Fokus pada satu tema terang (*light mode*) yang sangat rapi, bersih, dan kontrasnya sempurna untuk membaca dokumen.

---

## 3. Sistem Warna (Hitam, Putih, dan Biru)

Menggunakan format **OKLCH** sesuai standar Tailwind CSS v4 dan `shadcn/ui` terbaru pada `src/app/globals.css`.

### 3.1 Palet Utama

| Peran | Nama Token | Nilai Hex Referensi | Nilai OKLCH | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Background Utama** | `--background` | `#FFFFFF` | `oklch(1 0 0)` | Latar halaman utama & workspace canvas |
| **Surface / Panel** | `--muted` / `--card` | `#F8FAFC` | `oklch(0.984 0.003 247.858)` | Sidebar, area dropzone, header kartu |
| **Teks Utama** | `--foreground` | `#09090B` | `oklch(0.141 0.005 285.823)` | Heading, label utama, isi teks |
| **Teks Sekunder** | `--muted-foreground` | `#52525B` | `oklch(0.442 0.017 285.786)` | Deskripsi alat, metadata ukuran file |
| **Border / Garis** | `--border` | `#E4E4E7` | `oklch(0.92 0.004 286.32)` | Pembatas kartu, divider, input |
| **Border Kuat / Hover** | `--border-strong` | `#18181B` | `oklch(0.21 0.006 285.885)` | Hover state pada kartu alat |
| **Aksen Primer (Biru)** | `--primary` | `#2563EB` | `oklch(0.546 0.245 262.881)` | Tombol CTA utama, active state, dropzone aktif |
| **Aksen Primer Hover** | `--primary-hover` | `#1D4ED8` | `oklch(0.488 0.243 264.376)` | Hover tombol CTA utama |
| **Biru Halus (Tint)** | `--accent-blue` | `#EFF6FF` | `oklch(0.97 0.014 254.604)` | Background dropzone saat file di-drag, item terpilih |
| **Teks di atas Biru** | `--primary-foreground` | `#FFFFFF` | `oklch(1 0 0)` | Teks tombol biru |
| **Destructive / Hapus** | `--destructive` | `#DC2626` | `oklch(0.577 0.245 27.325)` | Hanya untuk tombol hapus halaman/file & pesan error |

### 3.2 Aturan Penggunaan Warna
- **Dominasi 85% Putih & Abu-abu sangat terang** untuk ruang bernapas.
- **10% Hitam (`#09090B`)** untuk tipografi dan struktur tegas.
- **5% Biru (`#2563EB`)** khusus untuk elemen interaktif utama (CTA proses, fokus input, halaman terpilih, progress bar). Jangan mewarnai semua ikon kartu dengan warna-warni berbeda; gunakan ikon hitam/abu gelap yang berubah menjadi biru saat kartu di-hover.

---

## 4. Tipografi

- **Font Utama**: `Inter` atau `Geist Sans` (via `next/font/google`).
- **Font Monospace**: `Geist Mono` atau `JetBrains Mono` (khusus untuk menampilkan ukuran file seperti `2.4 MB`, nomor halaman, dan rentang halaman `1-5`).
- **Skala Tipografi**:
  - **Page Title (Homepage)**: `text-2xl md:text-3xl font-semibold tracking-tight text-foreground`
  - **Tool Title (Halaman Fitur)**: `text-xl font-semibold tracking-tight text-foreground`
  - **Card Title**: `text-base font-medium text-foreground`
  - **Body / Deskripsi**: `text-sm text-muted-foreground leading-relaxed`
  - **Metadata / Label Kecil**: `text-xs font-medium text-muted-foreground`
- **Tabular Numbers**: Wajib menggunakan class `tabular-nums` untuk persentase progres, jumlah halaman, dan ukuran file agar angka tidak bergeser saat berubah.

---

## 5. Struktur Layout & Wireframe

### 5.1 Navbar Global (Tinggi tetap `56px` / `h-14`)
Sticky di atas, latar putih solid dengan `border-b border-border`.
- **Kiri**: Logo teks **PDFAlat** dengan ikon kotak/dokumen minimal (`font-semibold tracking-tight`). Saat berada di halaman fitur (`/gabungkan-pdf`, dll.), dapat menampilkan breadcrumb ringkas `/ Nama Alat` di samping logo.
- **Tengah/Kanan**: Dropdown menu **"Semua Alat"** (akses cepat pindah ke 9 alat lain tanpa kembali ke beranda).
- **Tidak ada** tombol Login, Daftar, atau Harga.

### 5.2 Layout Halaman Utama (`/`)
Kompak dan langsung menampilkan 10 alat di layar pertama (*above the fold*).

```text
+-----------------------------------------------------------------------+
| [Logo] PDFAlat                                        [Semua Alat v]  |
+-----------------------------------------------------------------------+
|                                                                       |
|  Alat PDF cepat tanpa login.                                          |
|  Semua proses berjalan aman langsung di browser Anda.                 |
|                                                                       |
|  +------------------+  +------------------+  +------------------+     |
|  | [Icon]           |  | [Icon]           |  | [Icon]           |     |
|  | Gabungkan PDF    |  | Pisahkan PDF     |  | Kompres PDF      |     |
|  | Satukan beberapa |  | Ekstrak halaman  |  | Perkecil ukuran  |     |
|  | file PDF jadi 1. |  | tertentu.        |  | file PDF Anda.   |     |
|  +------------------+  +------------------+  +------------------+     |
|                                                                       |
|  [ ... Grid responsif: 1 kolom mobile, 2 kolom tablet, 4/5 desktop ]  |
|  [ Total 10 Kartu Alat dengan jarak seragam gap-4 ]                   |
|                                                                       |
+-----------------------------------------------------------------------+
|  Pemrosesan lokal di browser. Tidak ada file yang disimpan di server. |
+-----------------------------------------------------------------------+
```

**Detail Kartu Alat**:
- Latar `#FFFFFF`, border `1px solid var(--border)`, sudut `rounded-lg` (`8px`), padding `p-5`.
- Tidak ada drop shadow default.
- Saat hover: border berubah menjadi biru (`border-primary`) atau hitam (`border-foreground`), ikon berubah warna menjadi biru (`text-primary`), transisi `150ms ease`.

### 5.3 Layout Workspace Fitur (Contoh: `/gabungkan-pdf`, `/pisahkan-pdf`, dll.)

Setiap rute fitur mengikuti 4 state UX yang seragam (selaras dengan PRD):

#### State A: Belum Ada File (Empty / Upload State)
- Header ringkas di atas: Judul alat + 1 kalimat deskripsi (tampilkan hanya di State A agar ruang kanvas pada State B maksimal).
- **Dropzone Utama**: Area besar di tengah (`max-w-2xl mx-auto`), border putus-putus `border-2 border-dashed border-border`, latar `--muted`, sudut `rounded-xl`, tinggi minimal `280px`.
- Isi Dropzone: Ikon upload (`lucide-react`), teks **"Tarik dan jatuhkan file di sini"**, tombol solid biru **"Pilih File"**, dan keterangan format yang diterima (`PDF` / `DOCX` / `JPG, PNG, WEBP`).
- Saat file di-drag ke atas dropzone: Border menjadi biru solid (`border-primary`) dan latar berubah ke `--accent-blue`.

#### State B: Workspace Aktif (Split Layout)
Desktop menggunakan layout 2 kolom: **Area Preview/Kanvas (kiri, fleksibel)** + **Panel Pengaturan & Aksi (kanan, lebar tetap `320px`)**. Mobile menumpuk vertikal dengan tombol CTA *sticky* di bawah.
- Toolbar atas kanvas menyesuaikan jenis alat: alat multi-file (`Gabungkan PDF`, `Foto ke PDF`, `Atur PDF`, `Kompres PDF`, `Word ke PDF`) menampilkan `[+ Tambah File]` + `[Reset]`, sedangkan alat file tunggal (`Pisahkan PDF`, `Putar PDF`, `Edit PDF`, `PDF ke Word`, `PDF ke Foto`) menampilkan `[Ganti File]` + `[Reset]`.

```text
+-----------------------------------------------------------------------+
| [Logo] PDFAlat  /  Pisahkan PDF                       [Semua Alat v]  |
+-----------------------------------------------------------------------+
|                                                  |                    |
|  [Ganti File]             [Reset]  [12 Halaman]  |  Pengaturan        |
|  ----------------------------------------------  |  ----------------  |
|  +--------+  +--------+  +--------+  +--------+  |  Mode Pemisahan:   |
|  |        |  |        |  |        |  |        |  |  (o) Pilih Halaman |
|  | Page 1 |  | Page 2 |  | Page 3 |  | Page 4 |  |  ( ) Rentang       |
|  |  [v]   |  |        |  |  [v]   |  |        |  |  ( ) Pisah Semua   |
|  +--------+  +--------+  +--------+  +--------+  |                    |
|                                                  |  Terpilih: 2 hal.  |
|  +--------+  +--------+  +--------+  +--------+  |                    |
|  |        |  |        |  |        |  |        |  |                    |
|  | Page 5 |  | Page 6 |  | Page 7 |  | Page 8 |  |  [  Pisahkan PDF ] |
|  |        |  |        |  |        |  |        |  |  (Tombol Biru CTA) |
|  +--------+  +--------+  +--------+  +--------+  |                    |
+--------------------------------------------------+--------------------+
```

#### State C: Sedang Memproses (Processing State)
- Panel terpusat (`max-w-md mx-auto`) dengan latar `--card` dan `border border-border rounded-xl p-6`:
  - Status ringkas (misal: *"Memproses halaman 4 dari 12..."*).
  - Komponen `Progress` tipis (`h-1.5`) warna biru (`--primary`) dengan persentase `tabular-nums`.
  - Tombol sekunder outline **"Batalkan"** jika operasi mendukung pembatalan.

#### State D: Hasil Selesai (Result State)
- Panel bersih di tengah halaman (tidak perlu redirect ke URL baru):
  - Ikon centang biru/hitam dalam lingkaran tipis.
  - Pesan jelas: **"File siap diunduh"** + nama file & ukuran akhir (serta daftar ringkasan metrik per file/total `Awal -> Akhir (Hemat XX%)` untuk `Kompres PDF` maupun hasil multi-file dalam `.zip`).
  - Tombol CTA utama biru: **"Unduh File"** (atau **"Unduh ZIP"** jika output > 1 file).
  - Tombol sekunder outline: **"Proses File Lain"** (mereset state dan membersihkan Object URL dengan bersih).

---

## 6. Komponen shadcn/ui yang Digunakan

Instal hanya komponen yang benar-benar diperlukan agar bundle tetap ramping:
- `button` (varian `default` biru, `outline`, `ghost`, `destructive`)
- `card`
- `input` & `label`
- `radio-group`
- `select`
- `slider` (untuk zoom/ketebalan di Edit PDF atau kualitas gambar)
- `progress` (bar tipis `h-1.5` warna biru)
- `dropdown-menu` (navigasi cepat "Semua Alat")
- `tooltip` (untuk tombol ikon di toolbar Edit PDF)
- `sonner` (notifikasi error/sukses di sudut kanan bawah, gaya monochrome bersih)