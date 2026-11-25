/**
 * Dashboard Smart Traffic Light Rawamangun
 * Konstanta Konfigurasi Sistem
 * Sumber data: docs/firebase-schema.md (bagian 3, 4, 5) dan docs/PRD.md
 */

/**
 * 13 State ESP32 persis dari tabel di docs/firebase-schema.md bagian 3
 * Lampu: R = merah, Y = kuning, G = hijau, RY = merah dan kuning bersamaan.
 * Durasi: 2 s (RY), 15 s (G), 3 s (Y), 2 s (R/All Red).
 * Siklus normal: 3 x 22 s = 66 s.
 * Layar pembuka 3 s, STARTUP_ALL_RED 3 s.
 */
export const FSM_STATES = [
  {
    state: 'STARTUP_ALL_RED',
    duration: 3,
    phase: 'STARTUP ALL RED',
    condition: 'SEMUA MERAH',
    tla: 'R',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'STARTUP',
    isTransition: false,
  },
  {
    state: 'A_RED_YELLOW',
    duration: 2,
    phase: 'FASE A - TLA (1,2)',
    condition: 'MERAH + KUNING',
    tla: 'RY',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'A',
    isTransition: false,
  },
  {
    state: 'A_GREEN',
    duration: 15,
    phase: 'FASE A - TLA (1,2)',
    condition: 'HIJAU',
    tla: 'G',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'A',
    isTransition: false,
  },
  {
    state: 'A_YELLOW',
    duration: 3,
    phase: 'FASE A - TLA (1,2)',
    condition: 'KUNING',
    tla: 'Y',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'A',
    isTransition: false,
  },
  {
    state: 'ALL_RED_A_TO_B',
    duration: 2,
    phase: 'TRANSISI A -> B',
    condition: 'SEMUA MERAH',
    tla: 'R',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'TRANSITION',
    isTransition: true,
  },
  {
    state: 'B_RED_YELLOW',
    duration: 2,
    phase: 'FASE B - TLB (5,6)',
    condition: 'MERAH + KUNING',
    tla: 'R',
    tlb: 'RY',
    tlc: 'R',
    phaseGroup: 'B',
    isTransition: false,
  },
  {
    state: 'B_GREEN',
    duration: 15,
    phase: 'FASE B - TLB (5,6)',
    condition: 'HIJAU',
    tla: 'R',
    tlb: 'G',
    tlc: 'R',
    phaseGroup: 'B',
    isTransition: false,
  },
  {
    state: 'B_YELLOW',
    duration: 3,
    phase: 'FASE B - TLB (5,6)',
    condition: 'KUNING',
    tla: 'R',
    tlb: 'Y',
    tlc: 'R',
    phaseGroup: 'B',
    isTransition: false,
  },
  {
    state: 'ALL_RED_B_TO_C',
    duration: 2,
    phase: 'TRANSISI B -> C',
    condition: 'SEMUA MERAH',
    tla: 'R',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'TRANSITION',
    isTransition: true,
  },
  {
    state: 'C_RED_YELLOW',
    duration: 2,
    phase: 'FASE C - TLC (3,4)',
    condition: 'MERAH + KUNING',
    tla: 'R',
    tlb: 'R',
    tlc: 'RY',
    phaseGroup: 'C',
    isTransition: false,
  },
  {
    state: 'C_GREEN',
    duration: 15,
    phase: 'FASE C - TLC (3,4)',
    condition: 'HIJAU',
    tla: 'R',
    tlb: 'R',
    tlc: 'G',
    phaseGroup: 'C',
    isTransition: false,
  },
  {
    state: 'C_YELLOW',
    duration: 3,
    phase: 'FASE C - TLC (3,4)',
    condition: 'KUNING',
    tla: 'R',
    tlb: 'R',
    tlc: 'Y',
    phaseGroup: 'C',
    isTransition: false,
  },
  {
    state: 'ALL_RED_C_TO_A',
    duration: 2,
    phase: 'TRANSISI C -> A',
    condition: 'SEMUA MERAH',
    tla: 'R',
    tlb: 'R',
    tlc: 'R',
    phaseGroup: 'TRANSITION',
    isTransition: true,
  },
];

/**
 * Konstanta durasi
 */
export const STARTUP_DURATION = 3; // Detik STARTUP_ALL_RED
export const PHASE_DURATION = 22;  // Detik per fase: 2 (RY) + 15 (G) + 3 (Y) + 2 (All Red)
export const CYCLE_DURATION = 66;  // Detik siklus penuh: 3 fase x 22 s

/**
 * 3 Grup Lampu Fisik dan Pemetaan GPIO ESP32 (docs/firebase-schema.md bagian 4)
 * ESP32 melapor per grup, bukan per TL1-TL6. Total 3 modul LED dan 9 GPIO.
 */
export const LAMP_GROUPS = {
  TLA: {
    name: 'TLA',
    lanes: 'TL1 + TL2',
    heads: ['TL1', 'TL2'],
    direction: 'Utara & Selatan (Lurus)',
    gpio: { r: 4, y: 13, g: 14 },
  },
  TLB: {
    name: 'TLB',
    lanes: 'TL5 + TL6',
    heads: ['TL5', 'TL6'],
    direction: 'Utara & Selatan (Belok Kanan)',
    gpio: { r: 26, y: 27, g: 32 },
  },
  TLC: {
    name: 'TLC',
    lanes: 'TL3 + TL4',
    heads: ['TL3', 'TL4'],
    direction: 'Timur & Barat',
    gpio: { r: 18, y: 19, g: 23 },
  },
};

/**
 * Pemetaan tiap kepala lampu TL1–TL6 ke grupnya.
 * Kepala lampu TL1 dan TL2 mengikuti TLA, TL5 dan TL6 mengikuti TLB, TL3 dan TL4 mengikuti TLC.
 */
export const TL_HEAD_TO_GROUP = {
  TL1: 'TLA',
  TL2: 'TLA',
  TL3: 'TLC',
  TL4: 'TLC',
  TL5: 'TLB',
  TL6: 'TLB',
};

/**
 * Pemetaan arah kedatangan ambulans ke fase tujuan (PRD 6.2 & AGENTS.md)
 * Pengguna memilih ARAH, bukan nomor TL.
 * - Utara -> TL2 (lurus) -> Fase A
 * - Selatan -> TL1 (lurus) -> Fase A
 * - Timur -> TL3 -> Fase C
 * - Barat -> TL4 -> Fase C
 */
export const DIRECTION_TO_PHASE = {
  Utara: {
    direction: 'Utara',
    lane: 'TL2',
    laneType: 'Utara ke Selatan (Lurus)',
    targetPhase: 'A',
    targetGroup: 'TLA',
    targetGreenState: 'A_GREEN',
  },
  Selatan: {
    direction: 'Selatan',
    lane: 'TL1',
    laneType: 'Selatan ke Utara (Lurus)',
    targetPhase: 'A',
    targetGroup: 'TLA',
    targetGreenState: 'A_GREEN',
  },
  Timur: {
    direction: 'Timur',
    lane: 'TL3',
    laneType: 'Timur ke Barat',
    targetPhase: 'C',
    targetGroup: 'TLC',
    targetGreenState: 'C_GREEN',
  },
  Barat: {
    direction: 'Barat',
    lane: 'TL4',
    laneType: 'Barat ke Timur',
    targetPhase: 'C',
    targetGroup: 'TLC',
    targetGreenState: 'C_GREEN',
  },
};

/**
 * Perangkat Keras Aktual ESP32 DevKit V1
 */
export const HARDWARE_CONFIG = {
  totalModules: 3,
  totalGpio: 9,
  lcdI2C: {
    model: 'LCD 16x2 I2C',
    sda: 21,
    scl: 22,
    address: '0x27',
  },
  serial: {
    port: 'COM3',
    baudRate: 115200,
    config: '8N1',
  },
};

/**
 * Ambang Kedaluwarsa Data & Timeout (docs/firebase-schema.md bagian 5)
 */
export const THRESHOLDS = {
  esp32StaleSeconds: 10,       // esp32/status.updated_at tidak berubah > 10 s = basi
  backendOfflineSeconds: 30,   // backend/status.last_seen tidak berubah > 30 s = mati
  serialTimeoutSeconds: 4,     // Timeout balasan ESP32 ke backend
  maxHoldPrioritySeconds: 30,  // Batas aman tahan hijau ambulans (PRD 10)
  postClearHoldSeconds: 2,     // Tambahan tahan hijau setelah ambulans lewat (PRD 10)
};

/**
 * Lokasi Geografis Persimpangan Rawamangun
 */
export const MAP_CONFIG = {
  name: 'Persimpangan Rawamangun Muka / Jl. Pemuda',
  latitude: -6.1950,
  longitude: 106.8830,
  timezone: 'Asia/Jakarta', // WIB (UTC+7)
  zoom: 17,
};

/**
 * Parameter Simulasi (PRD bagian 10) & Konfigurasi Ambulans
 */
export const AMBULANCE_SPEED_KMH = 40; // Kecepatan standar ambulans (40 km/jam)
export const AMBULANCE_SPEED_MPS = AMBULANCE_SPEED_KMH / 3.6; // ~11.111 m/s
export const PIXELS_PER_METER = 1.5; // Skala kanvas: 1.5 px = 1 meter (150 m = 225 px)
export const AMBULANCE_SPAWN_DISTANCE_METERS = 155; // Jarak awal ambulans sebelum garis henti (m)

/**
 * Klasifikasi kepadatan antrean & jarak trigger lampu hijau ambulans
 * - Rendah (<= 5 kendaraan): lampu hijau di 50 m
 * - Sedang (6..15 kendaraan): lampu hijau di 100 m
 * - Tinggi (> 15 kendaraan): lampu hijau di 150 m
 */
export const QUEUE_DENSITY_LEVELS = {
  RENDAH: {
    id: 'rendah',
    label: 'Rendah',
    rule: '≤ 5 kendaraan',
    maxCount: 5,
    triggerDistanceMeters: 50,
    color: '#22C55E',
  },
  SEDANG: {
    id: 'sedang',
    label: 'Sedang',
    rule: '6–15 kendaraan',
    maxCount: 15,
    triggerDistanceMeters: 100,
    color: '#F59E0B',
  },
  TINGGI: {
    id: 'tinggi',
    label: 'Tinggi',
    rule: '> 15 kendaraan',
    maxCount: Infinity,
    triggerDistanceMeters: 150,
    color: '#EF4444',
  },
};

/**
 * Menentukan tingkat kepadatan antrean & jarak trigger lampu hijau berdasarkan jumlah antrean
 */
export function getQueueDensityInfo(queueCount = 0) {
  if (queueCount <= QUEUE_DENSITY_LEVELS.RENDAH.maxCount) {
    return QUEUE_DENSITY_LEVELS.RENDAH;
  }
  if (queueCount <= QUEUE_DENSITY_LEVELS.SEDANG.maxCount) {
    return QUEUE_DENSITY_LEVELS.SEDANG;
  }
  return QUEUE_DENSITY_LEVELS.TINGGI;
}

/**
 * Jenis pasien ambulans untuk penentuan prioritas skenario multi-ambulans
 */
export const PATIENT_TYPES = {
  DARURAT: {
    id: 'darurat',
    label: 'Darurat',
    priority: 1,
    description: 'Pasien gawat darurat (prioritas utama)',
  },
  NON_DARURAT: {
    id: 'non-darurat',
    label: 'Non-Darurat',
    priority: 2,
    description: 'Pasien tidak darurat / rujukan biasa (prioritas sekunder)',
  },
};

export const SIMULATION_PARAMS = {
  vehicleSpeed: 70,           // px/s
  ambulanceSpeed: AMBULANCE_SPEED_MPS * PIXELS_PER_METER, // 40 km/jam -> ~16.67 px/s
  spawnRates: {
    Baseline: 0.07,           // kendaraan/detik per lajur
    Pagi: 0.16,
    Siang: 0.11,
    Sore: 0.15,
  },
  latencies: {
    detection: 0.6,           // Deteksi (s)
    firebaseWrite: 0.9,       // Tulis Firebase (s)
    backendValidate: 1.3,     // Validasi backend (s)
    serialSend: 1.6,          // Kirim serial (s)
    ackReceive: 1.7,          // Terima ACK (s)
  },
};
