import React, { useState } from 'react';
import {
  AMBULANCE_SPEED_KMH,
  CYCLE_DURATION,
  DIRECTION_TO_PHASE,
  QUEUE_DENSITY_LEVELS,
  THRESHOLDS,
} from '../config/constants.js';
import LogPanel from './LogPanel.jsx';

/**
 * ControlPanel
 * Halaman Panel Kontrol terpisah untuk mengatur simulasi, kepadatan antrean,
 * skenario multi-ambulans, dan memantau ringkasan status, notifikasi, serta log.
 */
export default function ControlPanel({
  mode = 'simulasi',
  fsmState,
  liveEsp32Status = null,
  localCountdown = null,
  simSpeed = 1,
  isPaused = false,
  trafficScenario = 'Baseline',
  onTrafficScenarioChange,
  onSpeedChange,
  onTogglePause,
  onReset,
  queueCount = 0,
  rawQueueCount = 0,
  queueDensityInfo = QUEUE_DENSITY_LEVELS.RENDAH,
  queueOverride = 'auto',
  onQueueOverrideChange,
  activeAmbulances = [],
  prioritizedAmbulanceId = null,
  onCallAmbulance,
  onSpawnMultiScenario,
  onCancelAmbulance,
  movementLogs = [],
  onClearMovementLogs,
  logs = [],
  connectedLogs = [],
  onClearLogs,
  firebaseConnected = false,
  esp32Age = 0,
  backendAge = 0,
}) {
  const [selectedPatientType, setSelectedPatientType] = useState('darurat');
  const isConnectedMode = mode === 'terhubung';

  // Data Ringkasan Status
  const displayStateCode = isConnectedMode
    ? liveEsp32Status?.state || 'UNKNOWN'
    : fsmState?.stateCode || 'STARTUP_ALL_RED';
  const displayPhase = isConnectedMode
    ? liveEsp32Status?.phase || 'UNKNOWN'
    : fsmState?.phase || 'STARTUP ALL RED';
  const displayRemaining = isConnectedMode
    ? localCountdown
    : Math.ceil(fsmState?.remainingSeconds ?? 0);
  const isPriorityActive = !isConnectedMode && fsmState?.mode === 'PRIORITAS AMBULANS';
  const cycleElapsed = isConnectedMode ? 0 : Math.round(fsmState?.cycleElapsed || 0);
  const cyclePercent = Math.min(100, Math.max(0, (cycleElapsed / CYCLE_DURATION) * 100));

  // Status Notifikasi Kontekstual
  const isEsp32Stale = isConnectedMode && esp32Age > THRESHOLDS.esp32StaleSeconds;
  const isBackendDead = isConnectedMode && backendAge > THRESHOLDS.backendOfflineSeconds;
  const prioritizedAmb = activeAmbulances.find((a) => a.requestId === prioritizedAmbulanceId);
  const lastAckOrDone = logs.find((l) => l.type === 'ACK' || l.type === 'DONE');

  return (
    <div className="grid grid-cols-1 min-[881px]:grid-cols-12 gap-6 items-start">
      {/* KOLOM KIRI: Kontrol Simulasi, Kepadatan Antrean, Multi-Ambulans, Catatan 5m */}
      <div className="min-[881px]:col-span-7 flex flex-col gap-6">
        {/* 1. KONTROL SIMULASI */}
        <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Kontrol Simulasi
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Mengubah kecepatan, beban lalu lintas, dan status simulasi canvas
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              {isConnectedMode ? 'Mode Terhubung' : 'Mode Simulasi'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Kecepatan */}
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted text-xs font-medium mr-1">Kecepatan:</span>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onSpeedChange && onSpeedChange(spd)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    simSpeed === spd
                      ? 'bg-accent text-slate-950 shadow-xs'
                      : 'bg-surface-2 text-text-muted hover:text-text-main border border-border-line'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>

            {/* Beban, Jeda, Reset */}
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="ctrl-traffic-scenario" className="text-text-muted text-xs">
                Beban:
              </label>
              <select
                id="ctrl-traffic-scenario"
                value={trafficScenario}
                onChange={(e) =>
                  onTrafficScenarioChange && onTrafficScenarioChange(e.target.value)
                }
                className="text-xs rounded-lg bg-surface-2 border border-border-line px-3 py-1.5 text-text-main outline-hidden focus:border-accent"
              >
                <option value="Baseline">Baseline</option>
                <option value="Pagi">Pagi (Padat)</option>
                <option value="Siang">Siang</option>
                <option value="Sore">Sore (Padat)</option>
              </select>

              <button
                type="button"
                onClick={onTogglePause}
                className="px-3.5 py-1.5 rounded-lg bg-surface-2 border border-border-line text-text-main text-xs font-semibold hover:border-accent transition-colors cursor-pointer"
              >
                {isPaused ? '▶ Lanjut' : '⏸ Jeda'}
              </button>

              <button
                type="button"
                onClick={onReset}
                className="px-3.5 py-1.5 rounded-lg bg-surface-2 border border-border-line text-text-muted text-xs font-semibold hover:text-text-main hover:border-border-line transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {isConnectedMode ? (
          <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2 border-b border-border-line pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Kontrol Prioritas Ambulans & Antrean
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
                Read-Only
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Dalam <strong>Mode Terhubung</strong>, dashboard hanya membaca status aktual dari Firebase
              (<code>/esp32/status</code>, <code>/backend/status</code>, <code>/commands</code>, dan{' '}
              <code>/responses</code>). Pengaturan kepadatan antrean dan pemanggilan prioritas ambulans
              hanya tersedia di <strong>Mode Simulasi</strong>.
            </p>
          </div>
        ) : (
          <>
            {/* 2. KEPADATAN ANTREAN */}
            <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Kepadatan Antrean
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Menentukan jarak hijau sesuai jumlah kendaraan terdeteksi
                  </p>
                </div>
                <span
                  className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${
                    queueDensityInfo.id === 'rendah'
                      ? 'bg-success/10 text-success border-success/40'
                      : queueDensityInfo.id === 'sedang'
                        ? 'bg-warning/10 text-warning border-warning/40'
                        : 'bg-error/10 text-error border-error/40'
                  }`}
                >
                  {queueDensityInfo.label.toUpperCase()} ({queueCount} kend.)
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/40">
                  Lampu hijau di {queueDensityInfo.triggerDistanceMeters} m
                </span>

                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor="ctrl-queue-override" className="text-text-muted">
                    Deteksi Antrean:
                  </label>
                  <select
                    id="ctrl-queue-override"
                    value={queueOverride}
                    onChange={(e) =>
                      onQueueOverrideChange && onQueueOverrideChange(e.target.value)
                    }
                    className="text-xs rounded-lg bg-surface-2 border border-border-line px-3 py-1.5 text-text-main outline-hidden focus:border-accent"
                  >
                    <option value="auto">Otomatis ({rawQueueCount} di canvas)</option>
                    <option value="rendah">Simulasi Rendah (≤ 5 · 50 m)</option>
                    <option value="sedang">Simulasi Sedang (≤ 15 · 100 m)</option>
                    <option value="tinggi">Simulasi Tinggi (&gt; 15 · 150 m)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  {
                    key: 'rendah',
                    title: 'Rendah (≤ 5)',
                    subtitle: '→ Hijau 50 m',
                    activeClass: 'border-accent bg-accent/10 text-text-main',
                    subClass: 'text-accent',
                  },
                  {
                    key: 'sedang',
                    title: 'Sedang (≤ 15)',
                    subtitle: '→ Hijau 100 m',
                    activeClass: 'border-warning bg-warning/10 text-text-main',
                    subClass: 'text-warning',
                  },
                  {
                    key: 'tinggi',
                    title: 'Tinggi (> 15)',
                    subtitle: '→ Hijau 150 m',
                    activeClass: 'border-error bg-error/10 text-text-main',
                    subClass: 'text-error',
                  },
                ].map((tier) => {
                  const isActive = queueDensityInfo.id === tier.key;
                  return (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() =>
                        onQueueOverrideChange &&
                        onQueueOverrideChange(queueOverride === tier.key ? 'auto' : tier.key)
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? tier.activeClass
                          : 'border-border-line bg-surface-2/60 text-text-muted hover:border-border-line/80'
                      }`}
                    >
                      <div className="font-bold text-text-main">{tier.title}</div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${isActive ? tier.subClass : 'text-text-muted'}`}>
                        {tier.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. SKENARIO MULTI-AMBULANS */}
            <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Skenario Multi-Ambulans
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Simulasi · {AMBULANCE_SPEED_KMH} km/jam · prioritas ditentukan oleh pilihan pengguna
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-warning/40 text-warning bg-warning/10">
                  Simulasi
                </span>
              </div>

              {/* Pilihan Jenis Pasien */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                <span className="text-text-muted font-medium mr-1">Jenis Pasien:</span>
                <button
                  type="button"
                  onClick={() => setSelectedPatientType('darurat')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    selectedPatientType === 'darurat'
                      ? 'bg-error/15 text-error border-error/60 shadow-xs'
                      : 'bg-surface-2 border-border-line text-text-muted hover:text-text-main'
                  }`}
                >
                  Darurat (Prioritas Utama)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPatientType('non-darurat')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    selectedPatientType === 'non-darurat'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/60 shadow-xs'
                      : 'bg-surface-2 border-border-line text-text-muted hover:text-text-main'
                  }`}
                >
                  Non-Darurat (Sekunder)
                </button>
              </div>

              {/* Tombol 4 Arah */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-4">
                {['Utara', 'Selatan', 'Timur', 'Barat'].map((dir) => {
                  const info = DIRECTION_TO_PHASE[dir];
                  const activeInDir = activeAmbulances.find(
                    (a) => a.direction === dir && !a.passed
                  );

                  return (
                    <button
                      key={dir}
                      type="button"
                      disabled={!!activeInDir}
                      onClick={() =>
                        onCallAmbulance && onCallAmbulance(dir, selectedPatientType)
                      }
                      className={`p-3 rounded-xl border text-left transition-all ${
                        activeInDir
                          ? activeInDir.patientType === 'darurat'
                            ? 'border-error bg-error/15 text-error font-bold cursor-not-allowed'
                            : 'border-amber-500 bg-amber-500/15 text-amber-400 font-bold cursor-not-allowed'
                          : 'border-accent/40 bg-surface-2 hover:border-accent hover:bg-accent/10 cursor-pointer'
                      }`}
                    >
                      <div className="font-bold text-text-main text-sm">{dir}</div>
                      <div className="text-[11px] text-text-muted mt-0.5 truncate">
                        {activeInDir
                          ? `${activeInDir.label} (${activeInDir.distanceToStopLine.toFixed(0)} m)`
                          : `${info.lane} → Fase ${info.targetPhase}`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Daftar Ambulans Aktif */}
              {activeAmbulances.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-surface-2 border border-border-line flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-bold text-text-main">
                      Ambulans Aktif ({activeAmbulances.length} unit)
                    </span>
                    <button
                      type="button"
                      onClick={() => onCancelAmbulance && onCancelAmbulance(null)}
                      className="px-2 py-0.5 rounded bg-error/10 border border-error/40 text-error hover:bg-error/20 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Batalkan Semua
                    </button>
                  </div>

                  {activeAmbulances.map((amb) => {
                    const isDarurat = amb.patientType === 'darurat';
                    const isPrioritized = amb.requestId === prioritizedAmbulanceId;
                    return (
                      <div
                        key={amb.requestId}
                        className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-[11px] ${
                          isPrioritized
                            ? 'border-error/60 bg-error/10'
                            : 'border-border-line bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-text-main">
                            {amb.label}
                          </span>
                          <span className="text-text-muted">· {amb.direction}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isDarurat
                                ? 'bg-error text-white'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {isDarurat ? 'DARURAT' : 'NON-DARURAT'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              amb.passed
                                ? 'bg-success/20 text-success'
                                : isPrioritized
                                  ? 'bg-accent/20 text-accent animate-pulse'
                                  : 'bg-surface-2 text-text-muted'
                            }`}
                          >
                            {amb.passed
                              ? 'MELINTAS'
                              : isPrioritized
                                ? 'DIPRIORITASKAN'
                                : 'MENUNGGU'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-text-muted">
                            Sisa: <strong className="text-text-main">{amb.distanceToStopLine.toFixed(1)} m</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => onCancelAmbulance && onCancelAmbulance(amb.requestId)}
                            className="text-error hover:underline font-sans font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tombol CTA Multi-Ambulans */}
              <button
                type="button"
                onClick={onSpawnMultiScenario}
                className="w-full py-2.5 px-4 rounded-xl bg-accent text-slate-950 text-xs sm:text-sm font-bold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
              >
                ⚡ Simulasi Multi-Ambulans (3 Arah)
              </button>
            </div>

            {/* 4. CATATAN WAKTU PERPINDAHAN AMBULANS (PER 5 METER) */}
            <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2.5">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Catatan Waktu Perpindahan Ambulans (Per 5 Meter)
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Kecepatan target {AMBULANCE_SPEED_KMH} km/jam (11,11 m/s · ideal 0,45 dtk per 5 m)
                  </p>
                </div>
                {movementLogs.length > 0 && onClearMovementLogs && (
                  <button
                    type="button"
                    onClick={onClearMovementLogs}
                    className="text-[11px] text-text-muted hover:text-text-main px-2.5 py-1 rounded-md bg-surface-2 border border-border-line cursor-pointer"
                  >
                    Bersihkan
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-text-muted border-b border-border-line">
                      <th className="py-2 px-2 font-semibold">Arah</th>
                      <th className="py-2 px-2 font-semibold">Jarak (m)</th>
                      <th className="py-2 px-2 font-semibold">Waktu (dtk)</th>
                      <th className="py-2 px-2 font-semibold">Selisih dari ideal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="pt-3">
                          <div className="rounded-lg border border-dashed border-border-line py-6 px-4 text-center text-xs text-text-muted">
                            Belum ada catatan pergerakan. Panggil ambulans untuk merekam waktu perpindahan tiap 5 meter.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      movementLogs.slice(0, 30).map((row) => {
                        const diff = row.deltaSeconds - 0.45;
                        const diffLabel = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} dtk`;
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-border-line/50 last:border-0 font-mono text-[11px]"
                          >
                            <td className="py-2 px-2 font-sans font-semibold text-text-main">
                              {row.ambulanceLabel} · {row.direction}{' '}
                              <span
                                className={`text-[10px] ${
                                  row.patientType === 'darurat' ? 'text-error' : 'text-amber-400'
                                }`}
                              >
                                ({row.patientType === 'darurat' ? 'Darurat' : 'Non'})
                              </span>
                            </td>
                            <td className="py-2 px-2 text-accent">{row.segmentLabel}</td>
                            <td className="py-2 px-2 font-bold text-success">
                              {row.deltaSeconds.toFixed(2)} dtk
                            </td>
                            <td
                              className={`py-2 px-2 ${
                                Math.abs(diff) <= 0.05 ? 'text-text-muted' : 'text-warning'
                              }`}
                            >
                              {diffLabel}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* KOLOM KANAN: Ringkasan Status, Notifikasi & Umpan Balik, Log Komunikasi Sistem */}
      <div className="min-[881px]:col-span-5 flex flex-col gap-6">
        {/* 1. RINGKASAN STATUS */}
        <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Ringkasan Status
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Pantau efek perintah secara langsung
              </p>
            </div>
            {isConnectedMode ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success border border-success/30">
                TERHUBUNG
              </span>
            ) : isPriorityActive ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-error text-white animate-pulse">
                PRIORITAS (simulasi)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success border border-success/30">
                NORMAL
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-surface-2 p-3.5 border border-border-line">
              <div className="text-[10.5px] font-semibold uppercase text-text-muted mb-1">
                Fase Aktif
              </div>
              <div className="text-sm font-bold text-text-main truncate" title={displayPhase}>
                {displayPhase}
              </div>
              <div className="text-[11px] font-mono text-text-muted mt-1 truncate">
                State: {displayStateCode}
              </div>
            </div>

            <div className="rounded-lg bg-surface-2 p-3.5 border border-border-line">
              <div className="text-[10.5px] font-semibold uppercase text-text-muted mb-1">
                Sisa Waktu Fase
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold font-mono text-accent">
                  {displayRemaining != null ? displayRemaining : '-'}
                </span>
                <span className="text-xs text-text-muted">detik</span>
              </div>
            </div>
          </div>

          {/* Progres Siklus */}
          <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-accent to-violet-500 transition-all duration-200"
              style={{ width: `${isConnectedMode ? 100 : cyclePercent}%` }}
            />
          </div>
        </div>

        {/* 2. NOTIFIKASI & UMPAN BALIK */}
        <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
          <div className="mb-4 border-b border-border-line pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Notifikasi & Umpan Balik
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Status respons perintah, antrean, dan kondisi perangkat
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Hijau: Status perintah / koneksi */}
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success mt-1 shrink-0" />
              <div>
                <div className="font-bold text-success">
                  {lastAckOrDone ? 'Perintah diproses' : 'Sistem siap'}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {lastAckOrDone
                    ? lastAckOrDone.msg
                    : 'FSM siklus 66 detik aktif; pilih skenario atau panggil ambulans.'}
                </div>
              </div>
            </div>

            {/* Kuning: Kepadatan Antrean */}
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning mt-1 shrink-0" />
              <div>
                <div className="font-bold text-warning">
                  Antrean {queueDensityInfo.label.toLowerCase()} ({queueCount} kendaraan)
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  Jarak pemicu lampu hijau otomatis disetel pada {queueDensityInfo.triggerDistanceMeters} m.
                </div>
              </div>
            </div>

            {/* Merah: Kondisi Perangkat */}
            <div
              className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                isEsp32Stale || isBackendDead || (isConnectedMode && !firebaseConnected)
                  ? 'border-error/40 bg-error/10'
                  : 'border-border-line bg-surface-2/60'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                  isEsp32Stale || isBackendDead || (isConnectedMode && !firebaseConnected)
                    ? 'bg-error'
                    : 'bg-text-muted'
                }`}
              />
              <div>
                <div
                  className={`font-bold ${
                    isEsp32Stale || isBackendDead || (isConnectedMode && !firebaseConnected)
                      ? 'text-error'
                      : 'text-text-main'
                  }`}
                >
                  {isConnectedMode
                    ? isBackendDead
                      ? 'Perangkat backend offline'
                      : isEsp32Stale
                        ? 'Data ESP32 basi (>10 detik)'
                        : 'Perangkat keras terhubung'
                    : 'Mode Simulasi Lokal'}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {isConnectedMode
                    ? isBackendDead || isEsp32Stale
                      ? `Update terakhir ESP32 ${esp32Age} dtk lalu, backend ${backendAge} dtk lalu.`
                      : 'Firebase RTDB, backend, dan ESP32 mengirim data normal.'
                    : 'Tidak menulis ke Firebase atau menggerakkan lampu fisik.'}
                </div>
              </div>
            </div>

            {/* Biru/Cyan: Prioritas Ambulans */}
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent mt-1 shrink-0" />
              <div>
                <div className="font-bold text-accent">
                  {prioritizedAmb
                    ? `Prioritas ambulans aktif (${prioritizedAmb.label})`
                    : 'Prioritas ambulans siaga'}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {prioritizedAmb
                    ? `${prioritizedAmb.direction} → Fase ${prioritizedAmb.targetPhase} sedang diproses (${prioritizedAmb.distanceToStopLine.toFixed(1)} m).`
                    : 'Belum ada ambulans yang memicu prioritas hijau.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. LOG KOMUNIKASI SISTEM */}
        <LogPanel
          logs={logs}
          mode={mode}
          connectedLogs={connectedLogs}
          onClearLogs={onClearLogs}
        />
      </div>
    </div>
  );
}
