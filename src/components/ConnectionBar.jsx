import React from 'react';
import { THRESHOLDS } from '../config/constants.js';

/**
 * ConnectionBar
 * Menampilkan indikator kesehatan koneksi sistem:
 * 1. Firebase RTDB: status dari .info/connected
 * 2. Python Backend: mati bila last_seen tidak berubah >30 detik, walau online true
 * 3. ESP32 DevKit: basi bila updated_at tidak berubah >10 detik
 *    (jangan memakai /esp32/status.online sebagai penentu)
 * 4. Umur Data: diukur dari kapan browser terakhir menerima nilai yang berubah
 */
export default function ConnectionBar({
  mode = 'simulasi',
  firebaseConnected = false,
  backendData = null,
  esp32Data = null,
  esp32Age = 0,
  backendAge = 0,
}) {
  const isConnectedMode = mode === 'terhubung';

  // Evaluasi kondisi nyata di mode terhubung
  const isEsp32Stale = isConnectedMode && esp32Age > THRESHOLDS.esp32StaleSeconds;
  const isBackendDead = isConnectedMode && backendAge > THRESHOLDS.backendOfflineSeconds;

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Status Koneksi Sistem
          </h3>
          {isConnectedMode && isEsp32Stale && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40">
              Data ESP32 Basi (&gt;10 s)
            </span>
          )}
          {isConnectedMode && isBackendDead && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error/20 text-error border border-error/40">
              Backend Mati (&gt;30 s)
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
          {isConnectedMode ? 'Mode Terhubung (RTDB)' : 'Mode Simulasi (Lokal)'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* 1. Indikator Firebase */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between border border-border-line">
          <span className="text-text-muted text-[11px] mb-1 font-medium">Firebase RTDB</span>
          <div className="flex items-center gap-1.5 font-bold">
            {isConnectedMode ? (
              firebaseConnected ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                  <span className="text-success">Terhubung</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-error" />
                  <span className="text-error">Terputus</span>
                </>
              )
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-text-muted opacity-50" />
                <span className="text-text-muted">Standby</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode
              ? firebaseConnected
                ? '.info/connected: True'
                : 'Mencoba koneksi...'
              : 'Simulasi tanpa RTDB'}
          </span>
        </div>

        {/* 2. Indikator Python Backend */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between border border-border-line">
          <span className="text-text-muted text-[11px] mb-1 font-medium">Python Backend</span>
          <div className="flex items-center gap-1.5 font-bold">
            {isConnectedMode ? (
              !isBackendDead && backendData ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="text-success">
                    Aktif ({backendData.serial_port || 'COM3'})
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
                  <span className="text-error">
                    {backendData ? 'Tidak Merespons' : 'Offline'}
                  </span>
                </>
              )
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="text-accent">Virtual FSM</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode
              ? `Last seen: ${backendAge}s lalu ${isBackendDead ? '(mati)' : ''}`
              : 'Simulasi internal'}
          </span>
        </div>

        {/* 3. Indikator ESP32 DevKit */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between border border-border-line">
          <span className="text-text-muted text-[11px] mb-1 font-medium">ESP32 DevKit V1</span>
          <div className="flex items-center gap-1.5 font-bold">
            {isConnectedMode ? (
              !isEsp32Stale && esp32Data ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="text-success">9 GPIO Aktif</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-500">
                    {esp32Data ? 'Data Basi' : 'Menunggu Polling'}
                  </span>
                </>
              )
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="text-accent">Siklus 66 Detik</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode
              ? `Poll STATUS: ${esp32Age}s lalu ${isEsp32Stale ? '(basi)' : ''}`
              : 'TLA / TLB / TLC'}
          </span>
        </div>

        {/* 4. Indikator Umur Data Browser */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between border border-border-line">
          <span className="text-text-muted text-[11px] mb-1 font-medium">Umur Data Terakhir</span>
          <div className="flex items-center gap-1.5 font-bold font-mono">
            {isConnectedMode ? (
              <span
                className={`text-sm ${
                  isEsp32Stale || isBackendDead
                    ? 'text-error font-extrabold'
                    : 'text-text-main'
                }`}
              >
                {esp32Age} s
              </span>
            ) : (
              <span className="text-sm text-accent">0 s</span>
            )}
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode
              ? 'Diukur dari update browser'
              : 'Real-time 60 FPS'}
          </span>
        </div>
      </div>
    </div>
  );
}
