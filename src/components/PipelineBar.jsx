import React from 'react';

/**
 * PipelineBar
 * Menampilkan lima tahap jalur data prioritas ambulans (simulasi).
 * Catatan penting:
 * - Tidak ada tampilan prioritas ambulans di mode Terhubung (FR-06 & firebase-schema.md).
 * - Di mode Terhubung, panel ini menginformasikan bahwa prioritas ambulans hanya aktif di mode simulasi.
 */
export default function PipelineBar({ activeStep = 0, isPriorityActive = false, mode = 'simulasi' }) {
  const isConnectedMode = mode === 'terhubung';

  if (isConnectedMode) {
    return (
      <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2 border-b border-border-line pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Jalur Data Sistem
          </h3>
          <span className="text-[10px] text-text-muted font-mono bg-surface-2 px-2 py-0.5 rounded-full">
            Read-Only
          </span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Mode Terhubung beroperasi dalam mode baca-saja (baca <code>/esp32/status</code>,{' '}
          <code>/backend/status</code>, dan <code>/responses</code>). Fitur prioritas ambulans{' '}
          belum diimplementasikan pada firmware/backend fisik dan hanya tersedia pada <strong>Mode Simulasi</strong>.
        </p>
      </div>
    );
  }

  const stages = [
    { id: 1, label: '1. Deteksi', desc: 'YOLOv8n / Pilihan Arah' },
    { id: 2, label: '2. Firebase', desc: 'Tulis /commands' },
    { id: 3, label: '3. Backend', desc: 'Validasi & Serial' },
    { id: 4, label: '4. ESP32', desc: 'FSM & 9 GPIO LED' },
    { id: 5, label: '5. Respons', desc: 'ACK & DONE' },
  ];

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Jalur Data Prioritas Ambulans (Simulasi)
        </h3>
        <span className="text-[10px] text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full font-medium">
          Hanya Mode Simulasi
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stages.map((stage) => {
          const isActive = isPriorityActive && activeStep >= stage.id;
          const isCurrent = isPriorityActive && activeStep === stage.id;

          return (
            <div
              key={stage.id}
              className={`rounded-lg p-2.5 border text-center transition-all ${
                isCurrent
                  ? 'border-accent bg-accent/20 shadow-xs ring-1 ring-accent'
                  : isActive
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-border-line bg-surface-2 opacity-50'
              }`}
            >
              <div
                className={`text-xs font-bold mb-0.5 ${
                  isActive ? 'text-accent' : 'text-text-main'
                }`}
              >
                {stage.label}
              </div>
              <div className="text-[10px] text-text-muted truncate">
                {stage.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
