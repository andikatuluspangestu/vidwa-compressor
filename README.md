# VidWA Compressor

✨ Kompres video HD untuk Status WhatsApp Anda tanpa kehilangan kualitas, langsung di browser. ✨

Aplikasi ini adalah alat kompresi video sisi klien yang dirancang khusus untuk mengoptimalkan video agar memiliki kualitas terbaik saat diunggah sebagai Status atau Story WhatsApp.

**[➡️ Coba Live Demo](https://vidwa-compressor.vercel.app/)**

![VidWA Compressor Screenshot](https://raw.githubusercontent.com/julianromli/fastcompress/main/public/screenshot.png)
*<p align="center">Tampilan antarmuka terinspirasi dari FastCompress</p>*

---

## 🧐 Masalahnya Apa?

Pernahkah Anda mengunggah video berkualitas tinggi ke Status WhatsApp, hanya untuk melihatnya menjadi pecah dan buram? WhatsApp menerapkan kompresi yang sangat agresif pada media untuk menghemat bandwidth, yang sering kali merusak kejernihan video Anda. Alat ini dirancang untuk mengatasi masalah tersebut.

Dengan melakukan pra-kompresi video Anda ke format dan ukuran yang "ramah" bagi WhatsApp, Anda dapat meminimalkan penurunan kualitas yang disebabkan oleh server WhatsApp, sehingga status Anda terlihat lebih tajam dan jernih.

## 🚀 Fitur Utama

- **🔒 100% Privat & Aman**: Semua proses video dilakukan langsung di browser Anda. File Anda tidak pernah diunggah ke server mana pun.
- **📱 Dioptimalkan untuk WhatsApp**: Menggunakan *single-pass encoding* yang andal untuk mencapai keseimbangan terbaik antara kualitas dan ukuran file.
- **⚙️ Pengaturan Fleksibel**:
    - **Preset**: Pilih antara "Kualitas Terbaik", "Seimbang", atau "Ukuran Terkecil".
    - **Manual**: Sesuaikan ukuran file target, resolusi (1080p, 720p, 480p), dan opsi untuk menghapus audio.
- **✂️ Pemangkas Video**: Tentukan waktu mulai dan selesai untuk memotong video sebelum dikompres.
- **🔄 Konversi ke GIF**: Ubah klip video Anda menjadi GIF animasi berkualitas tinggi.
- **📊 Info Detail**: Lihat resolusi asli, durasi, dan FPS video Anda sebelum memulai.
- **⏱️ Estimasi Waktu (ETA)**: Lihat perkiraan sisa waktu saat kompresi sedang berjalan.
- **💾 Simpan Pengaturan**: Pilihan kompresi terakhir Anda disimpan secara otomatis untuk kunjungan berikutnya.
- **🔔 Notifikasi**: Dapatkan notifikasi browser saat video Anda selesai diproses.
- **🖼️ Pratinjau Instan**: Lihat *thumbnail* video secara instan setelah diunggah.
- **🖱️ Antarmuka Drag & Drop**: Cukup seret dan lepas file video Anda untuk memulai.
- **📋 Salin ke Clipboard**: Salin video/GIF yang telah dikompres langsung ke *clipboard*.
- **💨 Cepat & Efisien**: Ditenagai oleh FFmpeg.wasm yang berjalan dengan WebAssembly untuk kecepatan pemrosesan yang mendekati *native*.


## 🛠️ Tumpukan Teknologi (Tech Stack)

- **[React](https://react.dev/)**: Untuk membangun antarmuka pengguna yang interaktif.
- **[TypeScript](https://www.typescriptlang.org/)**: Untuk kode JavaScript yang lebih aman dan mudah dikelola.
- **[FFmpeg.wasm](https://ffmpegwasm.netlify.app/)**: Inti dari aplikasi, menjalankan FFmpeg di browser menggunakan WebAssembly.
- **[Tailwind CSS](https://tailwindcss.com/)**: Untuk styling yang cepat dan modern.

## 🤔 Cara Kerjanya

1.  **Pilih Video**: Anda memilih file video dari perangkat Anda atau melepaskannya ke area unggah.
2.  **Muat FFmpeg**: Aplikasi memuat *core library* FFmpeg sebagai modul WebAssembly. Proses ini mungkin memerlukan beberapa saat pada kunjungan pertama Anda.
3.  **Atur & Kompres**: Anda mengonfigurasi pengaturan yang diinginkan (preset, ukuran target, resolusi, pemotongan, dll). Aplikasi kemudian menggunakan `libx264` (untuk video) atau proses palet dua langkah (untuk GIF) untuk mengompres media secara efisien.
4.  **Unduh & Gunakan**: Video atau GIF yang telah dikompresi disajikan kepada Anda untuk diunduh atau disalin, semuanya tanpa pernah menyentuh server.

## 💻 Menjalankan Secara Lokal

Untuk menjalankan proyek ini di mesin lokal Anda, ikuti langkah-langkah berikut:

1.  **Clone repositori ini:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/vidwa-compressor.git
    cd vidwa-compressor
    ```

2.  **Instal dependensi:**
    (Asumsi Anda menggunakan `npm` sebagai package manager)
    ```bash
    npm install
    ```

3.  **Jalankan server pengembangan:**
    ```bash
    npm run start 
    # atau `npm run dev` tergantung konfigurasi project Anda
    ```

4.  Buka [http://localhost:3000](http://localhost:3000) (atau port yang sesuai) di browser Anda.

## 🙏 Kredit & Inspirasi

Proyek ini sangat terinspirasi oleh proyek luar biasa [fastcompress](https://github.com/julianromli/fastcompress) oleh **Julian Romli**. Terima kasih banyak atas konsep dan implementasi aslinya yang menjadi dasar dari aplikasi ini.

## 📄 Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT. Lihat file `LICENSE` untuk detailnya.

---

### **MIT License**

Copyright (c) 2024 Andika Tulus Pangestu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.