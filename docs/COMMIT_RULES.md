# Aturan Pesan Commit (Commit Message Rules)

Repositori ini menggunakan standar **Conventional Commits** dengan deskripsi dalam **Bahasa Indonesia** agar riwayat perubahan mudah dipahami dan konsisten.

---

## 1. Format Dasar

```text
<type>(<scope>): <subject>

[body opsional]

[footer opsional]
```

### Aturan Penulisan Subject
- Wajib ditulis dalam **Bahasa Indonesia** menggunakan kata kerja imperatif/ringkas (contoh: `tambah`, `perbaiki`, `perbarui`, `hapus`, `rapikan`).
- Panjang baris header maksimal **72 karakter**.
- Awali `<subject>` dengan **huruf kecil** dan **tanpa tanda titik (`.`)** di akhir baris.
- Jelaskan **apa** yang berubah secara singkat dan jelas (tambahkan detail **mengapa** di body jika diperlukan).

---

## 2. Daftar `<type>` yang Diizinkan

| Type | Penggunaan |
| :--- | :--- |
| `feat` | Penambahan fitur atau alat PDF baru |
| `fix` | Perbaikan bug atau masalah tampilan/performa |
| `docs` | Perubahan dokumentasi (`docs/`, `README.md`, `AGENTS.md`) |
| `style` | Perubahan format kode (spasi, semicolon, lint) tanpa mengubah logika |
| `refactor` | Restrukturisasi kode tanpa menambah fitur atau memperbaiki bug |
| `perf` | Peningkatan performa atau optimasi ukuran bundle/chunk |
| `test` | Penambahan atau pembaruan pengujian |
| `chore` | Pembaruan dependensi, konfigurasi build, atau tooling (`package.json`, `eslint`) |

---

## 3. Daftar `<scope>` yang Disarankan

Scope bersifat opsional tetapi sangat dianjurkan agar area perubahan langsung terlihat:
- `core`: layout, navbar, footer, homepage, `tools-config`, `file-utils`
- `ui`: komponen bersama (`FileDropzone`, `ToolWorkspace`, `PdfThumbnail`, `shadcn/ui`)
- `merge`: fitur Gabungkan PDF (`/gabungkan-pdf`)
- `split`: fitur Pisahkan PDF (`/pisahkan-pdf`)
- `compress`: fitur Kompres PDF (`/kompres-pdf`)
- `word`: fitur PDF ke Word & Word ke PDF (`/pdf-ke-word`, `/word-ke-pdf`)
- `edit`: fitur Edit PDF (`/edit-pdf`)
- `image`: fitur PDF ke Foto & Foto ke PDF (`/pdf-ke-foto`, `/foto-ke-pdf`)
- `rotate`: fitur Putar PDF (`/putar-pdf`)
- `organize`: fitur Atur PDF (`/atur-pdf`)
- `config`: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `globals.css`

---

## 4. Contoh Pesan Commit yang Benar

```text
feat(merge): tambah fitur pengurutan drag-and-drop dan gabung PDF
fix(edit): perbaiki proyeksi koordinat anotasi pada halaman terputar
perf(core): terapkan lazy rendering thumbnail pdfjs via IntersectionObserver
docs(core): tambah dokumen spesifikasi proyek dan aturan pesan commit
chore(config): konfigurasi alias canvas Turbopack untuk pdfjs-dist
```

### Contoh yang Ditolak
- `update code` (tidak memakai Bahasa Indonesia, tidak ada `<type>`, terlalu umum)
- `Memperbaiki bug.` (huruf kapital & memakai tanda titik)
- `feat: Menambahkan fitur baru yang sangat panjang sekali melebihi batas maksimal tujuh puluh dua karakter.` (melebihi 72 karakter)
