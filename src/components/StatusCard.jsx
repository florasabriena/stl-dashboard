import React from 'react';
import { CYCLE_DURATION } from '../config/constants.js';

/**
 * StatusCard
 * Mode Terhubung menampilkan:
 * - state, phase, condition dari /esp32/status (tangani "UNKNOWN")
 * - hitung mundur lokal dari remaining_seconds dan waktu terima browser (tangani kosong)
 * - tidak ada tampilan prioritas ambulans di mode Terhubung
 */
export default function StatusCard({
  fsmState,
  mode = 'simulasi',
  liveEsp32Status = null,
  localCountdown = null,
}) {
  const isConnectedMode = mode === 'terhubung';

  // Tentukan data mana yang ditampilkan berdasarkan mode
  let displayStateCode = 'STARTUP_ALL_RED';
  let displayPhase = 'STARTUP ALL RED';
  let displayCondition = 'SEMUA MERAH';
  let displayRemaining = 0;
  let isPriorityActive = false;
  let cycleElapsed = 0;

  if (isConnectedMode) {
    // Sumber data: /esp32/status nyata dari Firebase
    displayStateCode = liveEsp32Status?.state || 'UNKNOWN';
    displayPhase = liveEsp32Status?.phase || 'UNKNOWN';
    displayCondition = liveEsp32Status?.condition || 'UNKNOWN';
    displayRemaining = localCountdown; // null bila kosong
    isPriorityActive = false; // PRD: Tidak ada prioritas ambulans di mode terhubung
    cycleElapsed = 0;
  } else {
    // Sumber data: Mesin simulasi lokal (FSM)
    displayStateCode = fsmState?.stateCode || 'STARTUP_ALL_RED';
    displayPhase = fsmState?.phase || 'STARTUP ALL RED';
    displayCondition = fsmState?.condition || 'SEMUA MERAH';
    displayRemaining = Math.ceil(fsmState?.remainingSeconds ?? 0);
    isPriorityActive = fsmState?.mode === 'PRIORITAS AMBULANS';
    cycleElapsed = Math.round(fsmState?.cycleElapsed || 0);
  }

  // Pengaturan warna kondisi lampu
  let conditionColorClass = 'text-tl-red';
  let conditionDotClass = 'bg-tl-red shadow-tl-red/50';

  if (displayCondition === 'HIJAU') {
    conditionColorClass = 'text-tl-green';
    conditionDotClass = 'bg-tl-green shadow-tl-green/50';
  } else if (displayCondition === 'KUNING') {
    conditionColorClass = 'text-tl-yellow';
    conditionDotClass = 'bg-tl-yellow shadow-tl-yellow/50';
  } else if (displayCondition === 'MERAH + KUNING') {
    conditionColorClass = 'text-amber-500';
    conditionDotClass = 'bg-amber-500 shadow-amber-500/50';
  } else if (displayCondition === 'UNKNOWN') {
    conditionColorClass = 'text-text-muted';
    conditionDotClass = 'bg-text-muted/60';
  }

  const cyclePercent = ((cycleElapsed / CYCLE_DURATION) * 100).toFixed(1);

  return (
    <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
      {/* Header Kartu */}
      <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Status Pengendali Lampu
        </h3>
        {isConnectedMode ? (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-surface-2 text-success border border-success/30 tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            TERHUBUNG ESP32
          </span>
        ) : isPriorityActive ? (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-error text-white tracking-wide animate-pulse">
            PRIORITAS AMBULANS (simulasi)
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-surface-2 text-success border border-success/30 tracking-wide">
            NORMAL
          </span>
        )}
      </div>

      {/* Grid Fase Aktif & Kondisi Lampu */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Fase Aktif */}
        <div className="rounded-lg bg-surface-2 p-3 border border-border-line">
          <div className="text-[11px] font-medium text-text-muted uppercase mb-1">
            Fase Aktif
          </div>
          <div
            className={`text-base font-bold truncate ${
              displayPhase === 'UNKNOWN' ? 'text-text-muted italic' : 'text-text-main'
            }`}
            title={displayPhase}
          >
            {displayPhase}
          </div>
          <div className="text-[11px] text-text-muted mt-1 font-mono truncate">
            State: {displayStateCode}
          </div>
        </div>

        {/* Kondisi Lampu */}
        <div className="rounded-lg bg-surface-2 p-3 border border-border-line">
          <div className="text-[11px] font-medium text-text-muted uppercase mb-1">
            Kondisi Lampu
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full shadow-xs ${conditionDotClass}`} />
            <span className={`text-base font-bold ${conditionColorClass}`}>
              {displayCondition}
            </span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {isConnectedMode
              ? 'Status firmware ESP32'
              : isPriorityActive
              ? 'Tahanan prioritas aktif'
              : 'Siklus otomatis 66 s'}
          </div>
        </div>
      </div>

      {/* Hitung Mundur */}
      <div className="rounded-lg bg-surface-2 p-4 text-center mb-5 border border-border-line">
        <div className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold">
          Sisa Waktu Fase
        </div>
        <div className="font-mono text-4xl font-extrabold text-accent">
          {displayRemaining != null ? (
            <>
              {displayRemaining}{' '}
              <span className="text-lg font-normal text-text-muted">detik</span>
            </>
          ) : (
            <span className="text-2xl font-normal text-text-muted italic">
              Tidak ada data
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-muted mt-1">
          {isConnectedMode
            ? 'Hitung mundur lokal dikoreksi polling /esp32/status'
            : 'Simulasi FSM internal 13 state'}
        </div>
      </div>

      {/* Bilah Kemajuan Siklus 66 Detik (Hanya di mode Simulasi) */}
      {!isConnectedMode ? (
        <div>
          <div className="flex justify-between items-center text-xs text-text-muted mb-2 font-medium">
            <span>Progres Siklus (66 s)</span>
            <span className="font-mono text-text-main">
              {cycleElapsed} s / {CYCLE_DURATION} s ({cyclePercent}%)
            </span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden flex p-0.5 border border-border-line">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                cycleElapsed < 22
                  ? 'bg-accent'
                  : cycleElapsed < 44
                  ? 'bg-emerald-500'
                  : 'bg-purple-500'
              }`}
              style={{ width: `${cyclePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1 font-mono">
            <span className={cycleElapsed < 22 ? 'text-accent font-bold' : ''}>
              Fase A (22 s)
            </span>
            <span className={cycleElapsed >= 22 && cycleElapsed < 44 ? 'text-emerald-500 font-bold' : ''}>
              Fase B (22 s)
            </span>
            <span className={cycleElapsed >= 44 ? 'text-purple-500 font-bold' : ''}>
              Fase C (22 s)
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-surface/50 p-2 text-center text-[11px] text-text-muted border border-border-line">
          Mode Terhubung: Pembacaan langsung dari node <code>/esp32/status</code>
        </div>
      )}
    </div>
  );
}
