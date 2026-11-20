import React from 'react';

/**
 * StatusCard
 * Menampilkan:
 * - Mode aktif (NORMAL / PRIORITAS AMBULANS)
 * - Fase aktif (FASE A, B, atau C)
 * - Kondisi lampu (HIJAU, KUNING, MERAH, MERAH + KUNING, SEMUA MERAH)
 * - Sisa waktu (hitung mundur)
 * - Bilah kemajuan siklus 66 detik (A: 22 s, B: 22 s, C: 22 s)
 */
export default function StatusCard({ mode = 'simulasi' }) {
  // Data placeholder untuk kerangka awal
  const isSim = mode === 'simulasi';
  const isPriority = false; // Mode darurat ambulans
  const currentPhase = 'FASE A - TLA (1,2)';
  const currentCondition = 'HIJAU';
  const remainingSeconds = 15;
  const cycleTotal = 66; // 3 x 22 s
  const currentElapsed = 7;

  return (
    <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Status Pengendali Lampu
        </h3>
        {/* Lencana Mode */}
        {isPriority ? (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-error text-white tracking-wide animate-pulse">
            PRIORITAS AMBULANS
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
          <div className="text-base font-bold text-text-main truncate">
            {currentPhase}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Utara - Selatan (Lurus)
          </div>
        </div>

        {/* Kondisi Lampu */}
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="text-[11px] font-medium text-text-muted uppercase mb-1">
            Kondisi Lampu
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-tl-green shadow-xs shadow-tl-green/50" />
            <span className="text-base font-bold text-tl-green">
              {currentCondition}
            </span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Fase berjalan
          </div>
        </div>
      </div>

      {/* Hitung Mundur */}
      <div className="rounded-lg bg-surface-2 p-4 text-center mb-5 border border-border-line">
        <div className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold">
          Sisa Waktu Fase
        </div>
        <div className="font-mono text-4xl font-extrabold text-accent">
          {remainingSeconds} <span className="text-lg font-normal text-text-muted">detik</span>
        </div>
        <div className="text-[11px] text-text-muted mt-1">
          {isSim ? 'Hitung mundur simulasi internal' : 'Koreksi lokal dari /esp32/status'}
        </div>
      </div>

      {/* Bilah Kemajuan Siklus 66 Detik */}
      <div>
        <div className="flex justify-between items-center text-xs text-text-muted mb-2 font-medium">
          <span>Progres Siklus (66 s)</span>
          <span className="font-mono text-text-main">{currentElapsed} s / {cycleTotal} s</span>
        </div>
        <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden flex p-0.5 border border-border-line">
          {/* Fase A (22s) */}
          <div className="h-full bg-accent rounded-l-full" style={{ width: '33.33%' }} title="Fase A (22 s)" />
          {/* Fase B (22s) */}
          <div className="h-full bg-surface border-x border-border-line" style={{ width: '33.33%' }} title="Fase B (22 s)" />
          {/* Fase C (22s) */}
          <div className="h-full bg-surface rounded-r-full" style={{ width: '33.33%' }} title="Fase C (22 s)" />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-1 font-mono">
          <span className="text-accent font-semibold">Fase A (22s)</span>
          <span>Fase B (22s)</span>
          <span>Fase C (22s)</span>
        </div>
      </div>
    </div>
  );
}
