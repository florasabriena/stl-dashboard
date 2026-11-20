import React from 'react';
import { CYCLE_DURATION, PHASE_DURATION } from '../config/constants.js';

/**
 * StatusCard
 * Menampilkan:
 * - Mode aktif (NORMAL atau PRIORITAS AMBULANS berlabel simulasi)
 * - Fase aktif (FASE A - TLA, FASE B - TLB, FASE C - TLC, atau STARTUP)
 * - Kondisi lampu (HIJAU, KUNING, MERAH, MERAH + KUNING, SEMUA MERAH)
 * - Sisa waktu hitung mundur
 * - Bilah kemajuan siklus 66 detik (A: 22 s, B: 22 s, C: 22 s)
 */
export default function StatusCard({ fsmState, mode = 'simulasi' }) {
  if (!fsmState) return null;

  const isSim = mode === 'simulasi';
  const isPriority = fsmState.mode === 'PRIORITAS AMBULANS';
  const remainingSec = Math.ceil(fsmState.remainingSeconds || 0);

  // Hitung progres dalam siklus 66 detik
  const cycleElapsed = Math.min(
    Math.max(Math.round(fsmState.cycleElapsed || 0), 0),
    CYCLE_DURATION
  );
  const cyclePercent = ((cycleElapsed / CYCLE_DURATION) * 100).toFixed(1);

  // Penentuan warna kondisi lampu
  let conditionColorClass = 'text-tl-red';
  let conditionDotClass = 'bg-tl-red shadow-tl-red/50';

  if (fsmState.condition === 'HIJAU') {
    conditionColorClass = 'text-tl-green';
    conditionDotClass = 'bg-tl-green shadow-tl-green/50';
  } else if (fsmState.condition === 'KUNING') {
    conditionColorClass = 'text-tl-yellow';
    conditionDotClass = 'bg-tl-yellow shadow-tl-yellow/50';
  } else if (fsmState.condition === 'MERAH + KUNING') {
    conditionColorClass = 'text-amber-500';
    conditionDotClass = 'bg-amber-500 shadow-amber-500/50';
  }

  return (
    <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Status Pengendali Lampu
        </h3>
        {/* Lencana Mode */}
        {isPriority ? (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-error text-white tracking-wide animate-pulse">
            PRIORITAS AMBULANS (simulasi)
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-surface-2 text-success border border-success/30 tracking-wide">
            NORMAL
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Fase Aktif */}
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="text-[11px] font-medium text-text-muted uppercase mb-1">
            Fase Aktif
          </div>
          <div className="text-base font-bold text-text-main truncate" title={fsmState.phase}>
            {fsmState.phase || 'STARTUP'}
          </div>
          <div className="text-[11px] text-text-muted mt-1 font-mono">
            State: {fsmState.stateCode}
          </div>
        </div>

        {/* Kondisi Lampu */}
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="text-[11px] font-medium text-text-muted uppercase mb-1">
            Kondisi Lampu
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full shadow-xs ${conditionDotClass}`} />
            <span className={`text-base font-bold ${conditionColorClass}`}>
              {fsmState.condition || 'SEMUA MERAH'}
            </span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {isPriority ? 'Prioritas ambulans ditahan' : 'Siklus otomatis 66 s'}
          </div>
        </div>
      </div>

      {/* Hitung Mundur */}
      <div className="rounded-lg bg-surface-2 p-4 text-center mb-5 border border-border-line">
        <div className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold">
          Sisa Waktu Fase
        </div>
        <div className="font-mono text-4xl font-extrabold text-accent">
          {remainingSec} <span className="text-lg font-normal text-text-muted">detik</span>
        </div>
        <div className="text-[11px] text-text-muted mt-1">
          {isSim
            ? 'Mesin status internal (FSM murni 13 state)'
            : 'Hitung mundur dikurangi lokal dari /esp32/status'}
        </div>
      </div>

      {/* Bilah Kemajuan Siklus 66 Detik */}
      <div>
        <div className="flex justify-between items-center text-xs text-text-muted mb-2 font-medium">
          <span>Progres Siklus (66 s)</span>
          <span className="font-mono text-text-main">
            {cycleElapsed} s / {CYCLE_DURATION} s ({cyclePercent}%)
          </span>
        </div>
        <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden flex p-0.5 border border-border-line relative">
          {/* Garis penanda 3 fase (masing-masing 22 detik = 33.33%) */}
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
    </div>
  );
}
