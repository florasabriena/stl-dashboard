import React, { useState } from 'react';
import ConnectionBar from './components/ConnectionBar';
import StatusCard from './components/StatusCard';
import LampPanel from './components/LampPanel';
import PipelineBar from './components/PipelineBar';
import IntersectionSim from './components/IntersectionSim';
import MapView from './components/MapView';
import LogPanel from './components/LogPanel';
import Login from './components/Login';

/**
 * Dashboard Smart Traffic Light Rawamangun
 * Kerangka Aplikasi Utama
 */
export default function App() {
  // Saklar mode: 'simulasi' | 'terhubung'
  const [mode, setMode] = useState('simulasi');
  const [showLogin, setShowLogin] = useState(false);

  const isSim = mode === 'simulasi';

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'terhubung') {
      // Optional: prompt login dialog untuk mode terhubung bila belum login
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-text-main transition-colors">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border-line bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Judul & Tag */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[19px] font-bold tracking-tight text-text-main">
              Smart Traffic Light Rawamangun
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-warning/40 text-warning bg-warning/10">
              Prototipe simulasi akademik
            </span>
          </div>

          {/* Saklar Mode & Penanda Mode */}
          <div className="flex items-center gap-3">
            {/* Lencana Penanda Mode Jelas */}
            {isSim ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-accent/15 text-accent border border-accent/30 tracking-wide">
                MODE SIMULASI
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-success/15 text-success border border-success/30 tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                MODE TERHUBUNG
              </span>
            )}

            {/* Segmented Switch */}
            <div className="flex p-0.5 rounded-lg bg-surface-2 border border-border-line text-xs">
              <button
                type="button"
                onClick={() => handleModeChange('simulasi')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  isSim
                    ? 'bg-accent text-surface shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Simulasi
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('terhubung')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  !isSim
                    ? 'bg-accent text-surface shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Terhubung
              </button>
            </div>

            {/* Tombol Auth untuk mode terhubung */}
            {!isSim && (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-line bg-surface-2 hover:bg-surface-2/80 text-text-muted hover:text-text-main transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA DUA KOLOM (SATU KOLOM DI HP) */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 min-[881px]:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI (Fokus Utama: Canvas Persimpangan, MapView, Log) */}
          <div className="min-[881px]:col-span-7 flex flex-col gap-6">
            <IntersectionSim />
            <MapView />
            <LogPanel mode={mode} />
          </div>

          {/* KOLOM KANAN (Status, Lampu, Koneksi, Jalur Data, Kontrol) */}
          <div className="min-[881px]:col-span-5 flex flex-col gap-6">
            <ConnectionBar mode={mode} />
            <StatusCard mode={mode} />
            <LampPanel />
            <PipelineBar />

            {/* Kontrol Panggilan Ambulans Placeholder (Hanya Mode Simulasi) */}
            {isSim && (
              <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Panggil Ambulans (Simulasi)
                  </h3>
                  <span className="text-[10px] text-text-muted">Pilih arah kedatangan</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  <button
                    type="button"
                    className="p-2.5 rounded-lg border border-border-line bg-surface-2 hover:border-accent hover:text-accent transition-colors text-center"
                  >
                    Utara (TL2 → Fase A)
                  </button>
                  <button
                    type="button"
                    className="p-2.5 rounded-lg border border-border-line bg-surface-2 hover:border-accent hover:text-accent transition-colors text-center"
                  >
                    Selatan (TL1 → Fase A)
                  </button>
                  <button
                    type="button"
                    className="p-2.5 rounded-lg border border-border-line bg-surface-2 hover:border-accent hover:text-accent transition-colors text-center"
                  >
                    Timur (TL3 → Fase C)
                  </button>
                  <button
                    type="button"
                    className="p-2.5 rounded-lg border border-border-line bg-surface-2 hover:border-accent hover:text-accent transition-colors text-center"
                  >
                    Barat (TL4 → Fase C)
                  </button>
                </div>
                <button
                  type="button"
                  className="w-full mt-3 p-2 rounded-lg border border-error/40 text-error bg-error/5 hover:bg-error/10 text-xs font-semibold transition-colors"
                >
                  Batalkan Panggilan
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Login */}
      <Login isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
