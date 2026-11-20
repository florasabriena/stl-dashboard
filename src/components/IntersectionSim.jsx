import React from 'react';

/**
 * IntersectionSim
 * Menampilkan simulasi grafis persimpangan jalan Rawamangun (rasio 1:1, max 700px).
 * Karakteristik jalan (FR-01):
 * - Utara & Selatan: 2 lajur per arah (lurus & belok kanan)
 * - Timur & Barat: 1 lajur per arah
 * - Lalu lintas lajur kiri
 * - Kepala lampu TL1–TL6 (grup TLA, TLB, TLC)
 */
export default function IntersectionSim() {
  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Simulasi Persimpangan Rawamangun
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            2 lajur U-S (lurus & belok kanan), 1 lajur T-B · Lalu lintas lajur kiri
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-surface-2 text-text-muted">
          Canvas 1:1
        </span>
      </div>

      {/* Container Canvas Placeholder 1:1 */}
      <div className="relative w-full aspect-square max-w-[700px] mx-auto rounded-lg bg-surface-2 border border-border-line overflow-hidden flex flex-col items-center justify-center p-4">
        {/* Placeholder Sketsa Visual Persimpangan */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          {/* Garis Jalan Vertikal (Utara - Selatan) */}
          <div className="w-1/3 h-full border-x-2 border-dashed border-text-muted relative flex justify-center">
            <div className="w-0.5 h-full border-r border-dashed border-text-muted/60" />
          </div>
          {/* Garis Jalan Horizontal (Timur - Barat) */}
          <div className="absolute h-1/3 w-full border-y-2 border-dashed border-text-muted flex items-center">
            <div className="h-0.5 w-full border-b border-dashed border-text-muted/60" />
          </div>
        </div>

        {/* Indikator Arah Mata Angin */}
        <div className="absolute top-3 text-[11px] font-mono text-text-muted font-bold">
          [UTARA] TL2 / TL6
        </div>
        <div className="absolute bottom-3 text-[11px] font-mono text-text-muted font-bold">
          [SELATAN] TL1 / TL5
        </div>
        <div className="absolute left-3 text-[11px] font-mono text-text-muted font-bold -rotate-90">
          [BARAT] TL4
        </div>
        <div className="absolute right-3 text-[11px] font-mono text-text-muted font-bold rotate-90">
          [TIMUR] TL3
        </div>

        {/* Pusat Persimpangan Placeholder Info */}
        <div className="relative z-10 text-center bg-surface/90 backdrop-blur-xs p-4 rounded-xl border border-border-line shadow-sm max-w-xs">
          <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent flex items-center justify-center mx-auto mb-2 text-accent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h4 className="text-sm font-bold text-text-main">
            Area Simulasi Canvas
          </h4>
          <p className="text-xs text-text-muted mt-1">
            Visualisasi canvas 60 FPS untuk pergerakan kendaraan, antrean, dan lampu TL1–TL6 akan dirender di sini.
          </p>
        </div>
      </div>

      {/* Kontrol Cepat Simulasi Placeholder */}
      <div className="mt-3 pt-2 border-t border-border-line flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-[11px]">Kecepatan:</span>
          <button type="button" className="px-2 py-1 rounded-md bg-accent text-surface text-[11px] font-bold">1×</button>
          <button type="button" className="px-2 py-1 rounded-md bg-surface-2 text-text-muted text-[11px]">2×</button>
          <button type="button" className="px-2 py-1 rounded-md bg-surface-2 text-text-muted text-[11px]">4×</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="px-3 py-1 rounded-lg bg-surface-2 text-text-main text-xs font-medium hover:bg-surface-2/80 transition-colors">
            Jeda
          </button>
          <button type="button" className="px-3 py-1 rounded-lg bg-surface-2 text-text-main text-xs font-medium hover:bg-surface-2/80 transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
