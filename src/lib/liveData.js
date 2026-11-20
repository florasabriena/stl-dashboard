/**
 * Modul LiveData - Listener HANYA-BACA Firebase RTDB
 * Berdasarkan dokumen: docs/firebase-schema.md
 *
 * Aturan penting:
 * - HANYA MEMBACA data. Tidak pernah menulis ke database atau ESP32.
 * - Listener dipasang pada path spesifik:
 *     /esp32/status
 *     /backend/status
 *     /commands (limitToLast 50)
 *     /responses (limitToLast 50)
 *     .info/connected
 *   JANGAN memasang listener di root database.
 * - ESP32 basi bila updated_at tidak berubah >10 detik.
 * - Backend mati bila last_seen tidak berubah >30 detik, walau online true.
 * - Ukur umur dari saat browser terakhir menerima nilai yang berubah.
 * - Tangani state/phase/condition "UNKNOWN" dan remaining_seconds yang kosong.
 * - Escape semua teks dari Firebase agar aman dari injeksi.
 */
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { db } from './firebase.js';
import { THRESHOLDS } from '../config/constants.js';

/**
 * Sanitasi string untuk mencegah injeksi HTML / XSS
 */
export function escapeText(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Memformat string ISO 8601 UTC menjadi format waktu lokal WIB (Asia/Jakarta, UTC+7)
 */
export function formatToWIB(isoString) {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return escapeText(String(isoString));
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return escapeText(String(isoString));
  }
}

/**
 * Memformat format tanggal lengkap WIB (Asia/Jakarta)
 */
export function formatFullWIB(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return escapeText(String(isoString));
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'short',
      timeStyle: 'medium',
      hour12: false,
    }).format(d);
  } catch {
    return escapeText(String(isoString));
  }
}

/**
 * Berlangganan status koneksi soket Firebase RTDB (.info/connected)
 */
export function subscribeToFirebaseConnection(callback) {
  const connectedRef = ref(db, '.info/connected');
  return onValue(connectedRef, (snapshot) => {
    const isConnected = !!snapshot.val();
    callback(isConnected);
  });
}

/**
 * Berlangganan status pengendali ESP32 (/esp32/status)
 * Menangani kasus "UNKNOWN" dan remaining_seconds yang kosong.
 */
export function subscribeToEsp32Status(callback) {
  const statusRef = ref(db, 'esp32/status');
  return onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback(null);
      return;
    }

    // Tangani kemungkinan field kosong atau "UNKNOWN"
    const parsedState = {
      rawOnline: !!data.online, // Catatan: online tidak pernah false, jangan dipakai menentukan hidup
      state: data.state ? String(data.state).trim() : 'UNKNOWN',
      phase: data.phase ? String(data.phase).trim() : 'UNKNOWN',
      condition: data.condition ? String(data.condition).trim() : 'UNKNOWN',
      remaining_seconds:
        data.remaining_seconds != null && !isNaN(Number(data.remaining_seconds))
          ? Number(data.remaining_seconds)
          : null,
      updated_at: data.updated_at ? String(data.updated_at) : null,
      receivedAt: Date.now(), // Jam browser saat data diterima untuk hitung mundur lokal
    };

    callback(parsedState);
  });
}

/**
 * Berlangganan status Python Backend (/backend/status)
 */
export function subscribeToBackendStatus(callback) {
  const statusRef = ref(db, 'backend/status');
  return onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback(null);
      return;
    }

    const parsedState = {
      online: !!data.online,
      serial_connected: !!data.serial_connected,
      serial_port: data.serial_port ? escapeText(data.serial_port) : 'COM3',
      message: data.message ? escapeText(data.message) : '',
      last_seen: data.last_seen ? String(data.last_seen) : null,
      receivedAt: Date.now(), // Jam browser saat data diterima untuk ukur kesegaran
    };

    callback(parsedState);
  });
}

/**
 * Berlangganan daftar perintah (/commands) dengan batasan 50 data terakhir
 */
export function subscribeToCommands(callback) {
  const commandsQuery = query(ref(db, 'commands'), limitToLast(50));
  return onValue(commandsQuery, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const list = Object.entries(data).map(([id, item]) => ({
      id: escapeText(id),
      cmd: item.cmd ? escapeText(String(item.cmd).toUpperCase().trim()) : 'UNKNOWN',
      status: item.status ? escapeText(item.status) : 'pending',
      processing_at: item.processing_at || null,
      completed_at: item.completed_at || null,
      raw: item,
    }));

    callback(list);
  });
}

/**
 * Berlangganan daftar respons (/responses) dengan batasan 50 data terakhir
 */
export function subscribeToResponses(callback) {
  const responsesQuery = query(ref(db, 'responses'), limitToLast(50));
  return onValue(responsesQuery, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const list = Object.entries(data).map(([id, item]) => ({
      id: escapeText(id),
      type: item.type ? escapeText(String(item.type).toUpperCase().trim()) : 'ACK',
      cmd: item.cmd ? escapeText(String(item.cmd).toUpperCase().trim()) : '',
      message: item.message ? escapeText(item.message) : '',
      received_at: item.received_at || null,
      state: item.state ? escapeText(item.state) : null,
      phase: item.phase ? escapeText(item.phase) : null,
      condition: item.condition ? escapeText(item.condition) : null,
      remaining_seconds:
        item.remaining_seconds != null ? Number(item.remaining_seconds) : null,
      raw: item,
    }));

    callback(list);
  });
}

/**
 * Menggabungkan dan menyusun log untuk mode Terhubung:
 * - Bersumber hanya dari /commands dan /responses
 * - Menampilkan ACK, NAK, TIMEOUT
 * - Pesan TIMEOUT berupa kalimat penjelasan
 * - Tidak menampilkan SET_PHASE atau DONE
 */
export function buildConnectedLogList(commands = [], responses = []) {
  const logEntries = [];

  // 1. Log dari Perintah (/commands)
  for (const cmd of commands) {
    const timeStr = formatToWIB(cmd.processing_at || cmd.completed_at);
    logEntries.push({
      id: `cmd-${cmd.id}`,
      time: timeStr,
      timestamp: new Date(cmd.processing_at || cmd.completed_at || 0).getTime(),
      type: 'CMD',
      msg: `{"cmd":"${cmd.cmd}","id":"${cmd.id}"}`,
      isSimulation: false,
    });
  }

  // 2. Log dari Respons (/responses)
  for (const res of responses) {
    const timeStr = formatToWIB(res.received_at);
    let jsonlPayload = '';

    if (res.type === 'ACK') {
      if (res.cmd === 'STATUS') {
        jsonlPayload = JSON.stringify({
          type: 'ACK',
          id: res.id,
          cmd: res.cmd,
          state: res.state || 'UNKNOWN',
          phase: res.phase || 'UNKNOWN',
          condition: res.condition || 'UNKNOWN',
          remaining_seconds: res.remaining_seconds,
        });
      } else {
        jsonlPayload = JSON.stringify({
          type: 'ACK',
          id: res.id,
          cmd: res.cmd || 'PING',
          message: res.message || 'PONG',
        });
      }
    } else if (res.type === 'TIMEOUT') {
      // Pada TIMEOUT, message berupa kalimat penjelas
      const explanation = res.message || `Tidak menerima ACK/NAK untuk ${res.cmd} (request_id=${res.id}).`;
      jsonlPayload = JSON.stringify({
        type: 'TIMEOUT',
        id: res.id,
        cmd: res.cmd,
        message: explanation,
      });
    } else {
      // NAK
      jsonlPayload = JSON.stringify({
        type: 'NAK',
        id: res.id,
        message: res.message || 'UNKNOWN_COMMAND',
      });
    }

    logEntries.push({
      id: `res-${res.id}`,
      time: timeStr,
      timestamp: new Date(res.received_at || 0).getTime(),
      type: res.type, // 'ACK' | 'NAK' | 'TIMEOUT'
      msg: jsonlPayload,
      isSimulation: false,
    });
  }

  // Urutkan berdasarkan waktu (terbaru di atas)
  return logEntries.sort((a, b) => b.timestamp - a.timestamp);
}
