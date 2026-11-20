# PRD Dashboard Smart Traffic Light Rawamangun

**Versi:** 1.3 (draf, diselaraskan dengan backend.py dan firmware ESP32) · **Tanggal:** 20 November 2026 · **Status:** Draf untuk ditinjau dosen pembimbing dan kelompok **Jenis produk:** Dashboard web pemantauan dan simulasi prototipe akademik

> **Penegasan ruang lingkup.** Dashboard ini adalah bagian dari prototipe simulasi akademik. Sistem tidak terhubung ke Dishub, ITCS, APILL, atau pengendali lampu lalu lintas jalan umum, dan tidak dipakai untuk mengatur arus kendaraan nyata.

---

## 1. Ringkasan Produk

Dashboard ini menampilkan prototipe Smart Traffic Light Rawamangun secara visual: peta persimpangan dari atas, enam kepala lampu (TL1–TL6) yang warnanya mengikuti tiga grup (TLA, TLB, TLC), kendaraan umum, ambulans, status pengendali ESP32, jalur data antarlapisan, dan log komunikasi. Tujuannya agar proses sistem dapat diamati langsung saat demo, pengujian, dan presentasi.

Dashboard memiliki dua mode:

| Mode | Sumber data | Status |
| --- | --- | --- |
| **Simulasi mandiri** | Mesin simulasi di dalam browser (FSM lampu, kendaraan, alur permintaan ambulans) | Versi pertama sudah dibuat dan berjalan |
| **Terhubung ke sistem nyata** | Status pengendali dan respons perintah dari Firebase Realtime Database yang ditulis Python Backend (/esp32/status, /backend/status, /responses) | Fase berikutnya (belum dibangun) |

## 2. Latar Belakang dan Masalah

Sistem utama terdiri dari aplikasi Android (CameraX, YOLOv8n), Firebase Realtime Database, Python Backend pada laptop Windows, komunikasi USB-Serial ke ESP32 DevKit V1, dan tiga modul LED traffic light (TLA, TLB, TLC) beserta LCD I2C 16x2. Komponen ini tersebar di beberapa perangkat sehingga sulit dipahami penguji dan penonton hanya dari lampu LED dan Serial Monitor.

Masalah yang diselesaikan dashboard:

1. Alur permintaan prioritas ambulans (deteksi → Firebase → backend → serial → ESP32 → LED) tidak terlihat utuh.
2. Urutan fase dan durasi lampu sulit diverifikasi hanya dengan mata dan stopwatch.
3. Kendaraan dan antrean tidak ada pada prototipe fisik, sehingga manfaat prioritas ambulans sulit didemonstrasikan.
4. Hasil pengujian (latensi, ACK/NAK/TIMEOUT, waktu tunggu) belum tercatat di satu tempat.

## 3. Tujuan dan Ukuran Keberhasilan

| ID | Tujuan | Ukuran keberhasilan |
| --- | --- | --- |
| G1 | Menampilkan siklus normal fase A, B, C sesuai spesifikasi | Durasi merah+kuning, hijau, kuning, dan semua-merah tampil sama dengan firmware: 2 s, 15 s, 3 s, 2 s; siklus 66 s |
| G2 | Menampilkan alur prioritas ambulans dari deteksi sampai LED | Mode simulasi: lima tahap jalur data menyala berurutan dan log ACK dan DONE muncul dengan request\_id yang sama. Mode terhubung: respons PING/STATUS nyata (ACK/NAK/TIMEOUT) tampil |
| G3 | Menampilkan kendaraan dan ambulans bergerak mengikuti lampu | Kendaraan berhenti pada merah dan kuning, jalan pada hijau; ambulans memicu mode prioritas |
| G4 | Menyediakan metrik sederhana untuk pembahasan penelitian | Jumlah kendaraan lewat, antrean, waktu tunggu dan waktu tempuh ambulans tampil |
| G5 | Siap dipakai di presentasi | Terbuka di laptop dan HP tanpa instalasi, tema terang dan gelap terbaca |

## 4. Ruang Lingkup

### 4.1 Dalam lingkup

- Visualisasi persimpangan, enam lampu, kendaraan, dan ambulans.
- Simulasi FSM lampu identik dengan aturan ESP32.
- Simulasi alur prioritas ambulans dengan latensi buatan.
- Panel status, tabel TL dan GPIO, jalur data, log, dan metrik.
- Mode terhubung ke Firebase (fase 2) untuk menampilkan status nyata.

### 4.2 Di luar lingkup

- Mengendalikan ESP32 atau lampu secara langsung dari dashboard (dashboard hanya membaca dan menampilkan).
- Koneksi ke APILL, ITCS, atau sistem Dishub.
- Optimasi sinyal, perhitungan PKJI, atau klaim kondisi lalu lintas aktual Rawamangun.
- Data lalu lintas pihak ketiga (TomTom Traffic Flow API tidak dipakai).
- Akun pengguna multi-peran dan manajemen pengguna.

## 5. Pengguna dan Skenario

| Pengguna | Kebutuhan | Skenario utama |
| --- | --- | --- |
| **Peneliti/mahasiswa** (pengembang) | Memverifikasi FSM, protokol, dan latensi | Menjalankan siklus normal, memanggil ambulans dari empat arah, memeriksa log |
| **Dosen pembimbing** | Memahami rancangan dan hasil dengan cepat | Melihat alur prioritas dan metrik saat bimbingan |
| **Penonton demo/sidang** | Memahami cara kerja tanpa latar teknis | Menonton ambulans mendekat dan lampu berpindah hijau |

### User story

- Sebagai peneliti, saya ingin memilih arah kedatangan ambulans dan melihat fase mana yang diberi hijau, agar pemetaan arah ke fase dapat dievaluasi.
- Sebagai dosen, saya ingin melihat kondisi tiap lampu TL1–TL6 beserta GPIO-nya, agar saya dapat mencocokkannya dengan rangkaian fisik.
- Sebagai peneliti, saya ingin melihat log perintah dan respons ACK/NAK/TIMEOUT dari Firebase pada mode terhubung (DONE hanya ada pada simulasi), agar saya dapat membandingkannya dengan Serial Monitor.
- Sebagai penonton, saya ingin melihat mobil dan ambulans bergerak, agar manfaat sistem terlihat jelas.
- Sebagai peneliti, saya ingin mengatur kecepatan dan skenario beban, agar demo dapat dipercepat.

## 6. Kebutuhan Fungsional

Prioritas: **P0** wajib, **P1** penting, **P2** tambahan.

| ID | Kebutuhan | Prioritas | Status |
| --- | --- | --- | --- |
| FR-01 | Menggambar persimpangan: 2 lajur per arah utara-selatan (lurus dan belok kanan), 1 lajur per arah timur-barat, lalu lintas lajur kiri | P0 | Selesai |
| FR-02 | Menampilkan lampu pada garis henti dan panel: enam kepala lampu TL1–TL6 yang warnanya mengikuti tiga grup (TLA = TL1+TL2, TLB = TL5+TL6, TLC = TL3+TL4) dengan kondisi merah, merah+kuning, hijau, dan kuning | P0 | Selesai |
| FR-03 | Menjalankan FSM normal sesuai firmware (13 state): STARTUP\_ALL\_RED 3 s, lalu fase A (TLA), B (TLB), C (TLC); tiap fase merah+kuning 2 s, hijau 15 s, kuning 3 s, semua-merah 2 s; siklus 66 s | P0 | Selesai |
| FR-04 | Memunculkan kendaraan acak pada tiap lajur; berhenti pada merah dan kuning, mengantre dengan jarak aman, jalan pada hijau | P0 | Selesai |
| FR-05 | Tombol Panggil ambulans dengan pilihan arah Utara, Timur, Selatan, Barat | P0 | Selesai |
| FR-06 | Alur permintaan prioritas (simulasi saja): deteksi, tulis Firebase, validasi backend, kirim serial, ACK, penerapan prioritas, DONE. Belum ada di firmware dan backend, yang baru mendukung PING dan STATUS | P0 | Selesai (simulasi) |
| FR-07 | Penerapan prioritas: jika fase tujuan sedang hijau, tahan; jika tidak, akhiri hijau aktif menuju kuning, semua-merah, lalu hijau fase tujuan | P0 | Selesai |
| FR-08 | Menahan hijau hingga ambulans melewati persimpangan ditambah 2 s, dengan batas aman 30 s, lalu kembali ke siklus normal | P0 | Selesai |
| FR-09 | Tombol Batalkan: menghapus ambulans, membatalkan permintaan, dan melepas tahanan hijau | P1 | Selesai |
| FR-10 | Panel status: mode, fase aktif, kondisi, sisa waktu, dan bilah kemajuan tiga fase | P0 | Selesai |
| FR-11 | Tabel grup TLA, TLB, TLC: jalur yang diwakili (TL1+TL2, TL5+TL6, TL3+TL4), GPIO R/Y/G dari firmware, dan indikator lampu | P1 | Selesai |
| FR-12 | Diagram jalur data lima tahap dengan penanda tahap aktif | P1 | Selesai |
| FR-13 | Log gulir dengan stempel waktu. Mode simulasi: pesan JSONL, ACK, DONE, dan peristiwa sistem. Mode terhubung: perintah dari /commands dan respons ACK/NAK/TIMEOUT dari /responses (baris serial mentah tidak tersedia di Firebase) | P0 | Selesai |
| FR-14 | Metrik: kendaraan lewat, kendaraan antre, waktu tunggu dan waktu tempuh ambulans | P1 | Selesai |
| FR-15 | Kontrol simulasi: jeda/lanjut, reset, kecepatan 1×, 2×, 4×, skenario beban Baseline/Pagi/Siang/Sore | P1 | Selesai |
| FR-16 | Mode terhubung: membaca /esp32/status, /backend/status, dan /responses dari Firebase RTDB secara real-time | P0 (fase 2) | Belum |
| FR-17 | Mode terhubung: menampilkan fase, state, kondisi, dan hitung mundur nyata dari /esp32/status serta respons ACK/NAK/TIMEOUT dari /responses; hitung mundur dikurangi lokal tiap detik dan dikoreksi saat update berikutnya; poll STATUS otomatis backend tidak tercatat di /responses (prioritas ambulans belum tersedia) | P0 (fase 2) | Belum |
| FR-18 | Saklar mode Simulasi/Terhubung dengan penanda jelas mode yang sedang tampil | P0 (fase 2) | Belum |
| FR-19 | Ekspor log dan metrik ke CSV untuk lampiran laporan (ditunda: format ekspor belum diperlukan) | P1 (fase 2) | Belum |
| FR-20 | Indikator status koneksi (Firebase, backend, ESP32) dan umur data terakhir: status ESP32 basi bila lebih dari 10 s, backend dianggap mati bila last\_seen lebih dari 30 s walau online masih true; /esp32/status.online tidak dipakai sebagai penentu karena backend hanya pernah menulis true | P1 (fase 2) | Belum |
| FR-21 | Kartu uji perangkat hanya sebagai tampilan status; dashboard tidak menulis ke /commands atau mengirim perintah | P2 | Belum |

**Tambahan setelah keputusan 19 November 2026**

| ID | Kebutuhan | Prioritas | Status |
| --- | --- | --- | --- |
| FR-22 | Menampilkan lokasi GPS ambulans (lintang, bujur, waktu data terakhir; jalur Firebase dari aplikasi Android belum dikonfirmasi) pada panel dan sebagai penanda pendukung; arah kedatangan tetap dipilih pengguna dan GPS tidak menggantikannya | P1 (fase 2) | Belum |
| FR-23 | Login pada mode terhubung (Firebase Authentication); dashboard hanya bisa dibuka pengguna terautentikasi dan hanya membaca data. Mode simulasi tetap terbuka tanpa login (usulan) | P0 (fase 2) | Belum |

### 6.1 Aturan bisnis yang harus dipertahankan

1. Pengguna memilih **arah kedatangan**, bukan nomor TL. Dashboard tidak menyediakan pilihan nomor TL.
2. YOLOv8n hanya menentukan ada atau tidaknya ambulans; arah berasal dari pilihan pengguna.
3. Prioritas hanya diteruskan bila data valid, segar (belum kedaluwarsa), dan pemetaan fase sudah disahkan.
4. Perpindahan fase selalu melewati transisi kuning dan semua-merah.
5. Hanya satu permintaan ambulans aktif pada satu waktu.
6. Bila gangguan terjadi, keadaan aman adalah semua merah dan perintah baru ditolak sampai kondisi valid (sesuai batas keselamatan pada rangkuman penelitian).

Catatan keselarasan dengan kode: aturan 3, 5, dan 6 adalah target untuk fitur prioritas ambulans yang belum ada di backend.py maupun firmware. Backend saat ini tidak memeriksa kedaluwarsa perintah dan tidak memaksa semua merah saat gangguan; bila serial gagal membalas, backend hanya menulis respons TIMEOUT dan status perintah `failed`, sedangkan firmware tetap menjalankan siklus lampu otomatis. Aturan ini hanya berlaku pada mode simulasi sampai fitur prioritas dibangun.

### 6.2 Pemetaan arah ke fase

Rangkuman penelitian menyatakan pemetaan arah ke fase **belum tervalidasi**. Dashboard versi 1 mengikuti arahan dosen pembimbing: pengelompokan fase A (TL1+TL2), B (TL5+TL6), dan C (TL3+TL4) serta urutan 1,2 → 5,6 → 3,4 tidak diubah. Tabel di bawah menerapkannya pada arah kedatangan ambulans dan tetap diverifikasi terhadap lintasan dan matriks konflik.

| Arah kedatangan | Lajur simulasi | Fase tujuan (mengikuti arahan dosen) |
| --- | --- | --- |
| Utara | TL2 (utara ke selatan, lurus) | A |
| Selatan | TL1 (selatan ke utara, lurus) | A |
| Timur | TL3 (timur ke barat) | C |
| Barat | TL4 (barat ke timur) | C |

Catatan: arahan dosen mengatur pengelompokan dan urutan fase, tetapi tidak menyebut fase target untuk tiap arah kedatangan ambulans, sehingga fase B (belok kanan) belum dipakai sebagai target prioritas. Pemetaan disimpan sebagai satu konstanta agar mudah diganti bila dosen memberi arahan tambahan.

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
| --- | --- |
| Performa | Animasi stabil sekitar 60 fps pada laptop kelas menengah dan HP; beban CPU rendah dengan satu elemen canvas |
| Latensi (fase 2) | Perubahan data Firebase tampil di dashboard kurang dari 2 detik pada jaringan normal, dihitung sejak data tertulis di Firebase (/esp32/status sendiri hanya diperbarui backend sekitar tiap 3 detik) |
| Akurasi waktu | Hitung mundur FSM mengikuti waktu simulasi; pada 1× selisih terhadap target kurang dari 0,2 s |
| Kompatibilitas | Chrome, Edge, Firefox, dan Safari terbaru; layar 360 px sampai 1920 px |
| Ukuran | Satu berkas HTML di bawah 100 KB, tanpa dependensi eksternal pada versi 1 |
| Aksesibilitas | Kontras teks memadai di tema terang dan gelap; status lampu juga diberi label teks, tidak hanya warna |
| Keamanan | Login wajib pada mode terhubung; kredensial service account tidak pernah berada di sisi dashboard; akses Firebase dibatasi Security Rules dan autentikasi; database tidak dibuka publik secara permanen |
| Keandalan | Dashboard tetap berfungsi bila koneksi terputus (kembali ke mode simulasi atau menampilkan data terakhir dengan penanda kedaluwarsa) |
| Pemeliharaan | Parameter durasi, pemetaan, dan laju kendaraan dikumpulkan dalam satu blok konfigurasi di awal kode |
| Bahasa | Antarmuka berbahasa Indonesia; istilah teknis (ACK, NAK, DONE, JSONL, GPIO) tetap dalam bahasa Inggris |

## 8. Arsitektur Teknis

### 8.1 Konteks sistem

```
Alur aktual (perintah yang didukung saat ini: PING dan STATUS):
Firebase /commands/{id}
   -> Python Backend (laptop Windows, COM3)
   -> USB-Serial JSONL 115200 8N1
   -> ESP32 DevKit V1 -> 3 modul LED (9 GPIO) + LCD I2C
ESP32 ACK/NAK -> Python Backend -> Firebase /responses/{id}
Python Backend (polling STATUS sekitar tiap 3 s) -> Firebase /esp32/status
Python Backend (heartbeat tiap 10 s) -> Firebase /backend/status

Rencana (belum ada di backend dan firmware):
Android (CameraX, YOLOv8n, pilih arah) -> Firebase -> prioritas ambulans

Dashboard (browser) <- Firebase RTDB (baca saja, fase 2)
```

Dashboard bukan bagian dari jalur kendali. Dashboard hanya membaca status sehingga kegagalan dashboard tidak mengganggu ESP32.

### 8.2 Tumpukan teknologi

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Bahasa | JavaScript, React + Vite | Komponen terpisah untuk peta, lampu, status, dan log; dibangun dengan Antigravity |
| Rendering | Canvas 2D (simulasi persimpangan), react-leaflet + OpenStreetMap (peta GPS), komponen React untuk panel | Animasi ringan; panel mudah diatur responsif |
| Mesin simulasi | FSM dan penggerak kendaraan di JavaScript, waktu simulasi terpisah dari waktu nyata | Kecepatan 1×, 2×, 4× tanpa mengubah durasi spesifikasi |
| Tema | Tailwind CSS v4 dan CSS custom properties, `prefers-color-scheme` | Terang dan gelap tanpa pustaka |
| Data (fase 2) | Firebase Realtime Database dan Authentication (Web SDK modular) | Sejalan dengan komponen Android dan Admin SDK Python |
| Hosting (fase 2) | Firebase Hosting (diputuskan di-hosting; server lokal laptop hanya untuk pengembangan) | Halaman yang dipublikasikan di claude.ai tidak boleh melakukan permintaan jaringan ke situs lain, jadi koneksi Firebase memerlukan hosting terpisah |
| Kontrol versi | Git | Riwayat perubahan konfigurasi pemetaan dan durasi |

**Keputusan:** dashboard memakai React + Vite dengan JavaScript (saran anggota kelompok); migrasi ke TypeScript dapat dipertimbangkan nanti.

### 8.3 Environment

| Aspek | Pengembangan | Demo/produksi akademik |
| --- | --- | --- |
| Perangkat | Laptop Windows (sama dengan Python Backend) | Laptop atau proyektor; HP sebagai layar tambahan |
| Peramban | Chrome terbaru dengan DevTools | Chrome atau Edge terbaru |
| Jaringan | Wi-Fi lokal dengan internet untuk Firebase | Sama; sediakan mode simulasi sebagai cadangan bila internet putus |
| Editor | VS Code | - |
| Port serial backend | COM3, 115200 bps (konfigurasi backend.py); Serial Monitor Arduino IDE harus ditutup | Sama |
| Penyajian lokal | Server statis sederhana (mis. `python -m http.server`) | Firebase Hosting atau berkas lokal |

### 8.4 Model data Firebase (skema aktual)

Skema di bawah adalah skema aktual yang ditulis backend.py (data state berasal dari firmware). Rinciannya ada pada docs/firebase-schema.md, yang menjadi acuan bila ada selisih.

```
/esp32/status            (ditulis backend tiap sekitar 3 s)
  online: true            (hanya pernah ditulis true; jangan dipakai menilai ESP32 hidup)
  state: "B_GREEN"        (13 kode, lihat docs/firebase-schema.md)
  phase: "FASE B - TLB (5,6)"
  condition: "HIJAU"
  remaining_seconds: 10
  updated_at: "2026-11-15T10:24:33.175631+00:00"   (ISO 8601 UTC)

/backend/status          (heartbeat tiap 10 s)
  online, serial_connected, serial_port, message, last_seen
  (online menjadi false saat backend berhenti lewat blok finally, termasuk karena galat serial; tidak terjadi bila proses mati mendadak)

/commands/{request_id}   (ditulis pihak lain; dashboard tidak menulis)
  cmd: "PING" | "STATUS"
  status: "pending" | "processing" | "completed" | "rejected" | "failed"
  processing_at, completed_at   (ISO 8601 UTC, ditulis backend)

/responses/{request_id}
  type: "ACK" | "NAK" | "TIMEOUT"
  id, cmd, message, received_at
  (ACK untuk STATUS menambah: state, phase, condition, remaining_seconds)
```

Dashboard hanya memiliki hak baca pada cabang ini. Listener dipasang pada cabang yang diperlukan, bukan pada root database. Polling STATUS otomatis backend (ID berawalan `poll-`) hanya memperbarui /esp32/status dan tidak muncul di /commands maupun /responses.

### 8.5 Format pesan yang ditampilkan di log

Mengikuti protokol serial aktual pada backend.py dan firmware (JSON Lines, satu objek per baris):

```
{"cmd":"PING","id":"ping-001"}
{"type":"ACK","id":"ping-001","cmd":"PING","message":"PONG"}
{"type":"ACK","id":"poll-abc123","cmd":"STATUS","state":"B_GREEN","phase":"FASE B - TLB (5,6)","condition":"HIJAU","remaining_seconds":10}
{"type":"NAK","id":"x1","message":"UNKNOWN_COMMAND"}
```

ACK berarti perintah diterima dan dijalankan, NAK berarti ditolak (oleh ESP32, atau oleh backend dengan message UNSUPPORTED\_COMMAND bila perintah bukan PING/STATUS). TIMEOUT ditulis backend ke /responses bila ESP32 tidak membalas dalam 4 detik; message-nya berupa kalimat penjelas, bukan kode. Pesan SET\_PHASE dan DONE belum ada di protokol aktual; keduanya hanya dipakai pada simulasi. Pada mode terhubung, dashboard hanya melihat data Firebase sehingga baris serial mentah direkonstruksi dari /commands (cmd, id) dan /responses.

## 9. Spesifikasi Desain (UX/UI)

### 9.1 Prinsip

1. Persimpangan adalah fokus utama dan berada di kiri atas pada layar lebar.
2. Status penting (mode, fase, sisa waktu) terbaca dalam sekali lihat.
3. Warna lampu selalu sama dengan lampu fisik: merah, kuning, hijau.
4. Tampilan sejalan dengan aplikasi Android (navy gelap dengan aksen cyan).

### 9.2 Tata letak

| Layar | Susunan |
| --- | --- |
| Lebar (di atas 880 px) | Dua kolom: kiri canvas persimpangan dan log; kanan kontrol, status, tabel lampu, jalur data, metrik |
| Sempit (HP) | Satu kolom: canvas, kontrol, status, lampu, jalur data, metrik, log |

Canvas berbentuk persegi (rasio 1:1), maksimum 700 px, skala mengikuti lebar kolom.

### 9.3 Token warna

| Token | Gelap | Terang | Pemakaian |
| --- | --- | --- | --- |
| Latar | #0A0F1C | #F1F5F9 | Latar halaman |
| Permukaan | #131A2C | #FFFFFF | Kartu |
| Permukaan 2 | #1E293B | #E2E8F0 | Kotak data, tombol |
| Garis | #243044 | #CBD5E1 | Batas kartu |
| Teks | #F8FAFC | #0F172A | Teks utama |
| Teks redup | #94A3B8 | #475569 | Label |
| Aksen | #22D3EE | #0E7490 | Tombol utama, penanda aktif |
| Sukses | #34D399 | #047857 | Status baik |
| Galat | #F87171 | #B91C1C | Mode prioritas, kesalahan |
| Peringatan | #FBBF24 | #B45309 | Tag prototipe |

Warna lampu pada canvas tetap: merah #EF4444, kuning #FBBF24, hijau #22C55E.

### 9.4 Tipografi dan komponen

- Font sistem (system-ui) agar tanpa unduhan; log memakai font monospace.
- Ukuran: judul 19 px, label kartu 12 px huruf kapital, isi 14 px, log 11,5 px.
- Kartu: sudut 12 px, garis 1 px. Tombol: sudut 8 px; tombol utama berisi warna aksen.
- Lencana mode: **NORMAL** (hijau pada permukaan netral) dan **PRIORITAS AMBULANS** (latar merah, teks putih).
- Ambulans: badan putih, palang merah, lampu bar merah dan biru bergantian, lingkaran peringatan berdenyut.

### 9.5 Perilaku interaksi

- Tombol Jeda mengubah teks menjadi Lanjut.
- Tombol kecepatan menandai pilihan aktif.
- Panggil ambulans dinonaktifkan secara logika bila ambulans sudah ada (permintaan kedua diabaikan).
- Setiap peristiwa penting menambah satu baris log dengan stempel waktu mm:ss.
- Teks log di-escape agar aman dari injeksi HTML saat data berasal dari Firebase.

## 10. Logika Simulasi

| Parameter | Nilai |
| --- | --- |
| Inisialisasi | Layar pembuka LCD 3 s, lalu 3 s semua merah (STARTUP\_ALL\_RED) |
| Merah+kuning, hijau, kuning, semua-merah per fase | 2 s, 15 s, 3 s, 2 s (sesuai firmware) |
| Siklus normal | 3 × 22 s = 66 s |
| Kecepatan kendaraan | 70 px/s; ambulans 55 px/s |
| Laju kemunculan per lajur | Baseline 0,07; Pagi 0,16; Siang 0,11; Sore 0,15 kendaraan per detik |
| Latensi simulasi | Deteksi 0,6 s; tulis Firebase 0,9 s; validasi 1,3 s; kirim serial 1,6 s; ACK 1,7 s (setelah ambulans muncul) |
| Batas aman tahan hijau | 30 s |
| Pelepasan setelah lewat | 2 s setelah ambulans melewati persimpangan |

Skenario beban hanya mengatur laju kemunculan untuk keperluan simulasi dan **bukan** data terukur. Latensi simulasi adalah angka buatan; latensi nyata hanya boleh dilaporkan dari mode terhubung.

## 11. Kriteria Penerimaan

| ID | Kriteria | Cara uji |
| --- | --- | --- |
| AC-01 | Urutan A, B, C berulang dengan durasi 2/15/3/2 s per fase (siklus 66 s) | Amati hitung mundur selama dua siklus penuh pada 1× |
| AC-02 | Tidak ada dua fase hijau bersamaan pada kondisi normal | Amati tabel lampu dan canvas |
| AC-03 | Kendaraan berhenti pada merah dan kuning, jalan pada hijau | Amati antrean pada semua enam lajur |
| AC-04 | Panggilan dari empat arah menghasilkan fase tujuan sesuai tabel pemetaan | Panggil tiap arah, cocokkan fase aktif |
| AC-05 | (Mode simulasi) Log menunjukkan request\_id yang sama pada SET\_PHASE, ACK, dan DONE | Baca log setelah satu panggilan |
| AC-06 | Setelah ambulans lewat, mode kembali NORMAL dan siklus berlanjut | Amati lencana mode dan fase berikutnya |
| AC-07 | Tombol Batalkan menghapus ambulans dan melepas tahanan | Panggil, lalu batalkan saat hijau ditahan |
| AC-08 | Tampilan terbaca pada lebar 360 px dan 1366 px, tema terang dan gelap | Uji peramban dan emulasi perangkat |
| AC-09 (fase 2) | Perubahan di Firebase tampil di dashboard kurang dari 2 s | Tulis data uji, ukur dengan log waktu |
| AC-10 (fase 2) | Penanda mode jelas dan data kedaluwarsa diberi tanda | Putuskan koneksi, amati indikator |
| AC-11 (fase 2) | Respons nyata tampil dengan request\_id yang sama dengan perintahnya: ACK PONG untuk PING, ACK berisi state untuk STATUS, NAK UNSUPPORTED\_COMMAND, dan TIMEOUT | Tulis perintah uji dari luar dashboard, cocokkan /commands dan /responses |

## 12. Rencana Pengujian

1. **Fungsional:** AC-01 sampai AC-08 dijalankan manual dan hasilnya dicatat pada tabel hasil aktual.
2. **Kesesuaian dengan firmware:** durasi dan urutan dibandingkan dengan log ESP32 pada bench test.
3. **Lintas peramban dan perangkat:** Chrome, Edge, Firefox, satu HP Android, satu iPhone bila tersedia.
4. **Fase 2:** uji putus-nyambung jaringan, data kedaluwarsa (backend dihentikan paksa dan ESP32 dicabut), request\_id ganda (diabaikan backend), request\_id tidak valid (diabaikan tanpa respons), perintah tidak didukung (NAK UNSUPPORTED\_COMMAND), ESP32 tidak membalas (TIMEOUT), dan ESP32 ter-reset ke STARTUP\_ALL\_RED saat backend membuka port serial.

Hasil pengujian diisi setelah pengujian dilakukan; dokumen ini tidak memuat hasil yang belum ada.

## 13. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Pemetaan arah ke fase belum tervalidasi | Fase tujuan salah | Pisahkan sebagai konstanta; validasi dengan dosen sebelum fase 2 |
| Simulasi dianggap data nyata | Klaim keliru di laporan | Tag prototipe permanen, label mode, dan catatan skenario hanya simulasi |
| Listener Python Admin SDK berstatus eksperimental | Data terlambat | Siapkan polling REST berkala sebagai cadangan |
| Firebase dibuka publik saat uji | Kebocoran atau penyalahgunaan data | Aktifkan autentikasi dan Security Rules sebelum fase 2 |
| Jam laptop backend dan jam browser tidak sinkron | Umur data salah dinilai | Nilai kedaluwarsa dari kapan browser terakhir menerima perubahan updated\_at/last\_seen, bukan dari selisih langsung dengan jam browser |
| Halaman publik tidak boleh memanggil Firebase | Mode terhubung gagal | Hosting terpisah (Firebase Hosting atau lokal) |
| Internet putus saat demo | Dashboard kosong | Mode simulasi sebagai cadangan |
| Backend mati mendadak | online tetap true dan /esp32/status berhenti diperbarui | Nilai dari last\_seen dan updated\_at, bukan dari flag online |
| Backend membuka port serial lalu ESP32 ter-reset | State mendadak kembali ke STARTUP\_ALL\_RED; /esp32/status belum diperbarui sekitar 6,5 s | Tampilkan sebagai kondisi wajar; data lama dari sesi sebelumnya ditandai kedaluwarsa |
| Perintah pending lama diproses saat backend mulai | Respons muncul terlambat tanpa konteks | Tampilkan waktu processing\_at dan completed\_at pada log |

## 14. Rencana Rilis

| Tahap | Isi | Status |
| --- | --- | --- |
| M1 | Simulasi mandiri: FR-01 sampai FR-15 | Selesai |
| M2 | Pemetaan arah ke fase disahkan, konstanta diperbarui | Menunggu verifikasi |
| M3 | Mode terhubung ke Firebase, saklar mode, indikator koneksi (FR-16, 17, 18, 20, 22, 23) | Belum |
| M4 | Kartu uji perangkat (FR-21); ekspor CSV (FR-19) ditunda | Belum |
| M5 | Uji integrasi Android sampai LED, pengisian tabel hasil | Belum |

## 15. Keputusan dan Pertanyaan Terbuka

1. Diputuskan: pemetaan mengikuti arahan dosen. Masih terbuka: dosen belum menyebut fase target per arah kedatangan, jadi tabel 6.2 dipertahankan sampai ada arahan tambahan. Masih terbuka juga: kapan prioritas ambulans ditambahkan ke firmware dan backend, dan jalur Firebase tempat aplikasi Android menulis GPS ambulans.
2. Diputuskan: dashboard di-hosting, dengan Firebase Hosting sebagai pilihan utama.
3. Diputuskan: perlu. Lokasi GPS ambulans ditampilkan sebagai informasi pendukung (FR-22).
4. Diputuskan: belum diperlukan untuk sekarang; ekspor CSV (FR-19) ditunda.
5. Diputuskan: perlu. Login diwajibkan pada mode terhubung (FR-23).

## 16. Daftar Acuan

Kode backend.py dan firmware ESP32 Kelompok 12 (sumber kebenaran skema dan siklus lampu), serta Rangkuman Penelitian Smart Traffic Light Rawamangun (November 2026) yang memuat arsitektur, pemetaan GPIO, fase lampu, protokol serial, rencana pengujian, dan keterbatasan penelitian. Dokumentasi teknis Firebase Realtime Database, Firebase Admin SDK for Python, ESP32, pySerial, dan JSON Lines yang tercantum pada daftar pustaka rangkuman tersebut.