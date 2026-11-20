# Aturan proyek: Dashboard Smart Traffic Light Rawamangun

## Konteks
Dashboard web untuk prototipe simulasi akademik. Bukan pengendali lampu jalan
umum; tidak terhubung ke Dishub, ITCS, atau APILL. Baca docs/PRD.md dan
docs/firebase-schema.md dulu. Bila keduanya berbeda, firebase-schema.md menang.

## Stack
React + Vite, JavaScript, Tailwind CSS v4, react-leaflet + OpenStreetMap,
Firebase Realtime Database dan Authentication, Firebase Hosting.

## Aturan penting
- Dashboard hanya MEMBACA data. Jangan menulis ke /commands, jalur lain, atau ESP32.
- Pakai HANYA jalur dan field di docs/firebase-schema.md: /esp32/status,
  /backend/status, /commands, /responses. Jangan mengarang jalur atau field.
  Jalur GPS ambulans belum dikonfirmasi: tanyakan sebelum membuat listener.
- Lampu fisik hanya 3 grup: TLA (TL1+TL2), TLB (TL5+TL6), TLC (TL3+TL4).
  Kepala lampu TL1-TL6 boleh digambar terpisah, tetapi warnanya mengikuti grupnya.
- Mesin simulasi mengikuti tabel 13 state di firebase-schema.md bagian 3:
  tiap fase MERAH+KUNING 2 s, HIJAU 15 s, KUNING 3 s, SEMUA MERAH 2 s (22 s);
  siklus 66 s; STARTUP_ALL_RED 3 s setelah layar pembuka 3 s.
  Jangan memakai siklus 60 s dari prototipe lama.
- Urutan fase: A, B, C. Pengguna memilih ARAH kedatangan ambulans, bukan nomor TL.
- Pemetaan arah ke fase ada di src/config/constants.js; jangan ditanam di komponen.
- Prioritas ambulans, SET_PHASE, dan DONE hanya ada di mode Simulasi dan harus
  berlabel jelas. Firmware dan backend baru mendukung PING dan STATUS.
- Mode Terhubung: hitung mundur dikurangi lokal dari remaining_seconds dan waktu
  terima di browser. ESP32 dianggap basi bila updated_at tidak berubah >10 s;
  backend dianggap mati bila last_seen tidak berubah >30 s walau online true.
  Jangan memakai /esp32/status.online sebagai penentu (nilainya tidak pernah false).
  Tangani state/phase/condition "UNKNOWN" dan remaining_seconds yang kosong.
- Waktu berupa ISO 8601 UTC; tampilkan dalam WIB (Asia/Jakarta).
- Jangan menaruh kunci atau rahasia di kode; gunakan variabel VITE_ dari .env.local.
- Teks antarmuka berbahasa Indonesia; istilah ACK, NAK, TIMEOUT, DONE, JSONL,
  GPIO tetap bahasa Inggris. Escape teks log yang berasal dari Firebase.

## Cara kerja
- Satu cabang per fitur, commit kecil dengan pesan jelas.
- Jalankan `npm run build` sebelum menyatakan tugas selesai.
- Tanyakan dulu bila ada ketidakjelasan (pemetaan arah ke fase, jalur GPS).