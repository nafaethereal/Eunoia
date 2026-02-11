# Eunoia - Setup & Deployment Guide

Website minimalis dan estetik untuk teman-teman seniman.

## 1. Persiapan Firebase (Gratis)
Agar website ini bisa jalan (login & database), kamu perlu bikin proyek Firebase dulu. Gratis kok!

1. Buka [Firebase Console](https://console.firebase.google.com/) dan login dengan Google.
2. Klik **"Add Project"**, beri nama "Eunoia" (atau bebas), matikan Google Analytics (biar cepet), lalu "Create Project".
3. **Setup Authentication:**
   - Di menu kiri, pilih **Build > Authentication**.
   - Klik **Get Started**.
   - Pilih **Google**, aktifkan (Switch ke ON), pilih email support, lalu **Save**.
4. **Setup Firestore Database:**
   - Pilih **Build > Firestore Database**.
   - Klik **Create Database**.
   - Pilih lokasi (bebas, misalnya Singapore atau US), klik Next.
   - **PENTING:** Pilih **"Start in test mode"** (supaya bisa langsung write data tanpa ribet rules dulu). Klik **Enable**.

> **Catatan:** Kita TIDAK pakai Firebase Storage (berbayar). Gambar akan disimpan sebagai Base64 di Firestore (gratis).


## 2. Dapatkan Kodingan Firebase
1. Di halaman Project Overview (klik icon gear ⚙️ di samping "Project Overview").
2. Pilih **Project settings**.
3. Scroll ke bawah ke bagian **"Your apps"**.
4. Klik icon **`</>` (Web)**.
5. Beri nama aplikasi (misal: "Eunoia Web"), klik **Register app**.
6. Kamu akan melihat kode `const firebaseConfig = { ... }`.
7. **COPY** bagian itu saja.

## 3. Masukkan ke Codingan
1. Buka file `app.js` di folder codingan ini.
2. Cari bagian paling atas yang ada tulisan `// --- FIREBASE CONFIGURATION ---`.
3. Ganti dummy config dengan config asli yang kamu copy tadi.

## 4. Cara Upload ke GitHub Pages (Hosting Gratis)
1. Buka [GitHub](https://github.com/) dan bikin repository baru (misal: `eunoia-art`).
2. Upload semua file (`index.html`, `dashboard.html`, `style.css`, `app.js`) ke repository itu.
3. Di halaman repository GitHub:
   - Klik **Settings**.
   - Pilih menu **Pages** di kiri.
   - Di bagian **Source**, pilih `Deploy from a branch`.
   - Pilih branch `main` (atau master), folder `/(root)`, lalu **Save**.
4. Tunggu sebentar, GitHub akan ngasi link website kamu (misal: `https://username.github.io/eunoia-art/`).

## 5. Selesai!
Sekarang kamu bisa share link itu ke temen-temen kamu.
- Mereka harus login pake Google.
- Bisa upload gambar (maksimal 1MB per gambar).
- Bisa nulis jurnal privat (cuma mereka yang bisa baca).

> **Tips:** Kalau gambar terlalu besar, kompres dulu pakai [TinyPNG](https://tinypng.com/) atau [Squoosh](https://squoosh.app/).
