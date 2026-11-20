import React from 'react';

/**
 * ConnectionBar
 * Menampilkan indikator koneksi Firebase RTDB, Python Backend, ESP32, dan umur data.
 * Catatan penting:
 * - /esp32/status.online tidak pernah false; gunakan updated_at (>10 s = basi).
 * - backend/status.last_seen (>30 s = mati walau online true).
 */
export default function ConnectionBar({ mode = 'simulasi' }) {
  const isConnectedMode = mode === 'terhubung';

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Status Koneksi Sistem
        </h3>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
          {isConnectedMode ? 'Data Realtime' : 'Simulasi Lokal'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Firebase Indicator */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between">
          <span className="text-text-muted text-[11px] mb-1">Firebase RTDB</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isConnectedMode ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
            <span className="text-text-main">{isConnectedMode ? 'Terhubung' : 'Standby'}</span>
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode ? 'Read-only listener' : 'Mode simulasi'}
          </span>
        </div>

        {/* Backend Indicator */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between">
          <span className="text-text-muted text-[11px] mb-1">Python Backend</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isConnectedMode ? 'bg-success' : 'bg-text-muted'}`} />
            <span className="text-text-main">{isConnectedMode ? 'Aktif (COM3)' : 'Virtual'}</span>
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode ? 'Heartbeat: 2s lalu' : 'Simulasi FSM'}
          </span>
        </div>

        {/* ESP32 Indicator */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between">
          <span className="text-text-muted text-[11px] mb-1">ESP32 DevKit</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isConnectedMode ? 'bg-success' : 'bg-accent'}`} />
            <span className="text-text-main">{isConnectedMode ? '9 GPIO Aktif' : 'Simulasi'}</span>
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode ? 'Poll STATUS: Segar' : 'Siklus 66 detik'}
          </span>
        </div>

        {/* Umur Data */}
        <div className="rounded-lg bg-surface-2 p-2.5 flex flex-col justify-between">
          <span className="text-text-muted text-[11px] mb-1">Umur Data</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-text-main font-mono text-sm">
              {isConnectedMode ? '< 1s' : '0s'}
            </span>
          </div>
          <span className="text-[10px] text-text-muted mt-1 truncate">
            {isConnectedMode ? 'Ambang basi: 10s' : 'Sinkron 60 FPS'}
          </span>
        </div>
      </div>
    </div>
  );
}
