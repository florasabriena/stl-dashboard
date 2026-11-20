import React from 'react';

/**
 * MapView
 * Menampilkan peta OpenStreetMap (Leaflet) untuk lokasi geografis persimpangan Rawamangun
 * dan penanda GPS ambulans pendukung (FR-22).
 */
export default function MapView() {
  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Peta Geografis Persimpangan & Ambulans
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Kawasan Rawamangun, Jakarta Timur · Penanda GPS pendukung
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-surface-2 text-text-muted">
          Leaflet + OSM
        </span>
      </div>

      {/* Map Box Placeholder */}
      <div className="w-full h-56 rounded-lg bg-surface-2 border border-border-line relative overflow-hidden flex items-center justify-center">
        {/* Grid pattern mock */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 text-center p-3">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent/20 text-accent mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-xs font-bold text-text-main">
            Persimpangan Rawamangun Muka / Jl. Pemuda
          </div>
          <div className="text-[11px] font-mono text-text-muted mt-0.5">
            Koordinat: -6.1950°, 106.8830° (WIB / UTC+7)
          </div>
          <div className="text-[10px] text-text-muted mt-2 max-w-xs mx-auto">
            Status GPS Ambulans: Menunggu data koordinat Android
          </div>
        </div>
      </div>
    </div>
  );
}
