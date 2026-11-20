# Skema Firebase dan Protokol Aktual (STL Rawamangun, Kelompok 12)

Sumber: `backend.py` (Python Backend) dan firmware ESP32 yang sudah ada. Dokumen ini adalah sumber kebenaran untuk dashboard. Bila ada selisih dengan PRD atau prototipe, **dokumen ini yang menang**. Bila dokumen ini berbeda dengan kode, **kode yang menang** dan dokumen ini harus diperbarui.

Dashboard hanya MEMBACA. Dashboard tidak menulis ke database dan tidak mengirim perintah ke ESP32.

## 1. Alur data

```
Firebase /commands/{id}  ->  Python Backend (listener)  ->  USB-Serial JSONL 115200  ->  ESP32
ESP32 ACK/NAK            ->  Python Backend             ->  Firebase /responses/{id}
Backend polling STATUS (sekitar tiap 3 s)  ->  Firebase /esp32/status
Backend heartbeat (tiap 10 s)              ->  Firebase /backend/status
```

Polling STATUS otomatis memakai ID berawalan `poll-` dan **hanya** memperbarui `/esp32/status`. Polling tidak muncul di `/commands` maupun `/responses`.

Backend memproses satu perintah pada satu waktu (satu thread serial). Port serial default `COM3`, 115200 bps; Serial Monitor Arduino IDE harus ditutup agar port tidak terkunci.

URL database diisi lewat `VITE_FIREBASE_DATABASE_URL` di `.env.local`; jangan ditulis di kode.

## 2. Jalur dan field

Semua waktu berupa string ISO 8601 UTC, mis. `2026-11-15T10:24:33.175631+00:00`, ditulis oleh jam laptop backend (bukan jam server Firebase).

### /esp32/status
Diperbarui backend setiap polling STATUS atau perintah STATUS yang mendapat ACK (sekitar tiap 3 detik selama backend berjalan dan ESP32 membalas).

| Field | Tipe | Contoh |
|---|---|---|
| online | boolean | true |
| state | string (kode, lihat bagian 3) | `B_GREEN` |
| phase | string (label) | `FASE B - TLB (5,6)` |
| condition | string (label) | `HIJAU` |
| remaining_seconds | number | 10 |
| updated_at | string ISO UTC | `2026-11-15T10:24:33.175631+00:00` |

Catatan penting:
- `online` **hanya pernah ditulis `true`** oleh backend. Nilainya tidak pernah menjadi `false`, sehingga jangan dipakai untuk menilai ESP32 hidup. Gunakan kesegaran `updated_at`.
- Bila ESP32 tidak membalas (TIMEOUT) atau backend berhenti, node ini tidak diubah dan datanya tertinggal.
- Bila balasan ESP32 tidak memuat suatu field, `state`, `phase`, dan `condition` berisi `UNKNOWN`, sedangkan `remaining_seconds` bisa tidak ada (kosong). Tangani kedua kasus ini.

### /backend/status
Ditulis saat backend siap, tiap 10 detik sebagai heartbeat, dan saat backend berhenti. Setiap penulisan memperbarui `last_seen`.

| Field | Tipe | Catatan |
|---|---|---|
| last_seen | string ISO UTC | dasar penilaian backend hidup atau mati |
| online | boolean | `true` saat siap dan saat heartbeat; menjadi `false` bila backend berhenti lewat blok penutup (CTRL+C **atau** galat seperti kegagalan port serial) |
| serial_connected | boolean | hasil `connection.is_open`; tidak membuktikan ESP32 membalas |
| serial_port | string | mis. `COM3`; tidak ditulis ulang saat shutdown |
| message | string | `Backend aktif dan menunggu perintah.`, `Backend aktif dan listener berjalan.`, atau `Backend dihentikan.` |

Heartbeat dapat tertunda saat backend sibuk memproses perintah atau menunggu timeout serial (4 detik), tetapi tetap jauh di bawah ambang 30 detik pada kondisi normal.

### /commands/{request_id}
Ditulis pihak lain (bukan dashboard). `request_id` harus cocok `^[A-Za-z0-9_-]{1,32}$`.

| Field | Keterangan |
|---|---|
| cmd | hanya `PING` atau `STATUS` (backend menghapus spasi dan mengubah ke huruf besar, jadi `ping` juga diterima) |
| status | `pending` lalu `processing`, lalu `completed`, `rejected`, atau `failed` |
| processing_at, completed_at | string ISO UTC, ditulis backend |

Aturan pemrosesan backend:
- Hanya perintah berstatus `pending` yang diantrekan, satu kali per `request_id` selama backend berjalan.
- `request_id` yang tidak cocok pola **diabaikan tanpa respons** dan statusnya tetap `pending`.
- Saat backend baru dijalankan, semua perintah `pending` yang sudah ada di `/commands` ikut diproses. Tidak ada masa kedaluwarsa perintah.
- `completed`: ESP32 membalas ACK. `rejected`: ESP32 membalas NAK, atau backend menolak perintah selain PING/STATUS. `failed`: tidak ada balasan dalam 4 detik (TIMEOUT).

### /responses/{request_id}

| Field | Keterangan |
|---|---|
| type | `ACK`, `NAK`, atau `TIMEOUT` |
| id, cmd | sama dengan perintah asal (`cmd` tidak ada bila perintah asal kosong) |
| message | `PONG` (untuk PING), kode alasan pada NAK, atau pada TIMEOUT berupa kalimat penjelas (`Tidak menerima ACK/NAK untuk {cmd} (request_id={id}).`), bukan kode |
| received_at | string ISO UTC, selalu ditambahkan backend |
| state, phase, condition, remaining_seconds | hanya pada ACK untuk STATUS |

Kode NAK dari ESP32 yang dikenal: `INVALID_ID`, `INVALID_JSON_OR_COMMAND`, `UNKNOWN_COMMAND`, `LINE_TOO_LONG`. Dari backend: `UNSUPPORTED_COMMAND`. Respons ditulis dengan `set`, sehingga satu `request_id` hanya punya satu respons terakhir.

## 3. Daftar state ESP32 (13 state)

Durasi dalam detik. Satu fase = MERAH+KUNING 2, HIJAU 15, KUNING 3, lalu SEMUA MERAH 2 = 22 detik. **Satu siklus = 3 x 22 = 66 detik.** Setelah layar pembuka 3 detik, ada STARTUP_ALL_RED 3 detik.

Lampu: R = merah, Y = kuning, G = hijau, RY = merah dan kuning menyala bersamaan.

| state | detik | phase (label) | condition (label) | TLA | TLB | TLC |
|---|---|---|---|---|---|---|
| STARTUP_ALL_RED | 3 | STARTUP ALL RED | SEMUA MERAH | R | R | R |
| A_RED_YELLOW | 2 | FASE A - TLA (1,2) | MERAH + KUNING | RY | R | R |
| A_GREEN | 15 | FASE A - TLA (1,2) | HIJAU | G | R | R |
| A_YELLOW | 3 | FASE A - TLA (1,2) | KUNING | Y | R | R |
| ALL_RED_A_TO_B | 2 | TRANSISI A -> B | SEMUA MERAH | R | R | R |
| B_RED_YELLOW | 2 | FASE B - TLB (5,6) | MERAH + KUNING | R | RY | R |
| B_GREEN | 15 | FASE B - TLB (5,6) | HIJAU | R | G | R |
| B_YELLOW | 3 | FASE B - TLB (5,6) | KUNING | R | Y | R |
| ALL_RED_B_TO_C | 2 | TRANSISI B -> C | SEMUA MERAH | R | R | R |
| C_RED_YELLOW | 2 | FASE C - TLC (3,4) | MERAH + KUNING | R | R | RY |
| C_GREEN | 15 | FASE C - TLC (3,4) | HIJAU | R | R | G |
| C_YELLOW | 3 | FASE C - TLC (3,4) | KUNING | R | R | Y |
| ALL_RED_C_TO_A | 2 | TRANSISI C -> A | SEMUA MERAH | R | R | R |

Urutan: STARTUP_ALL_RED, lalu A_RED_YELLOW ... ALL_RED_A_TO_B, B_..., ALL_RED_B_TO_C, C_..., ALL_RED_C_TO_A, lalu kembali ke A_RED_YELLOW.

## 4. Perangkat keras sebenarnya

ESP32 melapor per **grup**, bukan per TL1-TL6:

| Grup | Mewakili jalur | GPIO R / Y / G |
|---|---|---|
| TLA | 1 dan 2 | 4 / 13 / 14 |
| TLB | 5 dan 6 | 26 / 27 / 32 |
| TLC | 3 dan 4 | 18 / 19 / 23 |

LCD 16x2 I2C: SDA GPIO 21, SCL GPIO 22, alamat 0x27. Total 3 modul LED dan 9 GPIO (bukan 6 modul dan 18 GPIO seperti di PRD versi lama).

Di peta atau canvas, TL1 dan TL2 boleh digambar sebagai dua kepala lampu, tetapi warnanya harus mengikuti grup TLA. Begitu juga TL5 dan TL6 mengikuti TLB, serta TL3 dan TL4 mengikuti TLC.

## 5. Waktu dan kesegaran data

- Parse string ISO dengan `new Date(...)`, tampilkan dalam WIB (Asia/Jakarta, UTC+7).
- **Hitung mundur:** saat update baru diterima, simpan `remaining_seconds` dan waktu terima (jam browser), lalu kurangi secara lokal tiap detik; koreksi saat update berikutnya datang. Jangan menghitung dari selisih `updated_at` dengan jam browser (jam laptop backend dan browser bisa berbeda).
- **Kedaluwarsa:** `esp32/status.updated_at` tidak berubah lebih dari 10 detik berarti data basi (backend polling sekitar tiap 3 detik, bisa lebih lama bila ada TIMEOUT). `backend/status.last_seen` tidak berubah lebih dari 30 detik berarti backend dianggap mati, **walaupun `online` masih true** (backend yang mati mendadak tidak sempat menulis `online: false`). Agar tahan beda jam, ukur umur dari kapan browser terakhir menerima nilai `updated_at` atau `last_seen` yang berubah, bukan dari selisih langsung dengan jam browser.
- Jangan memakai `esp32/status.online` untuk menilai ESP32 hidup; nilainya tidak pernah `false`.
- Membuka port serial dapat me-reset ESP32, jadi `state` bisa kembali ke `STARTUP_ALL_RED` secara mendadak. Setelah port dibuka, backend menunggu 6,5 detik (splash 3 + startup 3) sebelum polling. Selama itu `/esp32/status` belum diperbarui dan masih berisi data sesi sebelumnya, yang akan terlihat basi.

## 6. Protokol serial aktual (backend ke ESP32)

JSON Lines, satu objek per baris, 115200 8N1.

```
{"cmd":"PING","id":"ping-001"}
{"type":"ACK","id":"ping-001","cmd":"PING","message":"PONG"}

{"cmd":"STATUS","id":"poll-abc123"}
{"type":"ACK","id":"poll-abc123","cmd":"STATUS","state":"B_GREEN","phase":"FASE B - TLB (5,6)","condition":"HIJAU","remaining_seconds":10}

{"type":"NAK","id":"x1","message":"UNKNOWN_COMMAND"}
```

Aturan sisi backend: JSON dikirim ringkas (tanpa spasi) dan diakhiri newline; balasan dicocokkan lewat `id`; baris yang tidak diawali `{` (log fase/countdown ESP32) hanya dicetak ke konsol dan tidak masuk Firebase; batas tunggu balasan 4 detik, lewat dari itu backend menulis `TIMEOUT`.

Tidak ada field `version`, tidak ada pesan `DONE`, dan tidak ada `SET_PHASE`.

## 7. Yang BELUM tersedia (jangan dikarang)

1. **Prioritas ambulans.** Firmware dan backend baru menerima `PING` dan `STATUS`. Tidak ada perintah prioritas, tidak ada mode prioritas di status. Backend juga belum punya pemeriksaan kedaluwarsa perintah atau pemaksaan semua merah saat gangguan; firmware tetap menjalankan siklus otomatis. Mode terhubung hanya bisa menampilkan fase, kondisi, hitung mundur, respons perintah, dan status backend. Alur prioritas hanya boleh ditampilkan di mode simulasi, dengan label jelas.
2. **GPS ambulans.** Tidak ada di backend. Jalur yang ditulis aplikasi Android belum dikonfirmasi; tanyakan sebelum membuat listener.
3. **Wi-Fi dan Firebase di ESP32.** Belum aktif; seluruh data lewat USB-Serial dan backend.
4. **Status ESP32 offline.** Backend tidak pernah menulis `esp32/status.online = false`; hilangnya ESP32 hanya terlihat dari `updated_at` yang berhenti berubah.

## 8. Aturan untuk agen

- Gunakan hanya jalur dan field pada dokumen ini. Tanyakan bila butuh yang lain.
- Jangan membuat tombol atau kode yang menulis ke `/commands` atau jalur lain.
- Pisahkan jelas mode **Simulasi** dan mode **Terhubung** di antarmuka.
- Mesin simulasi harus mengikuti tabel state di bagian 3 (siklus 66 detik, ada MERAH+KUNING), bukan siklus 60 detik di prototipe lama.
- Pada mode terhubung, log hanya boleh berisi data dari `/commands` dan `/responses`; jangan menampilkan `SET_PHASE` atau `DONE`.