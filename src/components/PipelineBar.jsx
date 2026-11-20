import React from 'react';

/**
 * PipelineBar
 * Menampilkan 5 tahap jalur data prioritas ambulans (simulasi).
 * Alur: Deteksi -> Firebase -> Backend -> Serial -> ESP32/LED -> Respons.
 * Catatan: Fitur prioritas ambulans hanya ada di mode simulasi dan diberi label jelas.
 */
export default function PipelineBar() {
  const stages = [
    { id: 1, label: '1. Deteksi', desc: 'YOLOv8n / Pilihan Arah', active: true },
    { id: 2, label: '2. Firebase', desc: '/commands', active: false },
    { id: 3, label: '3. Backend', desc: 'Validasi & Serial', active: false },
    { id: 4, label: '4. ESP32', desc: 'FSM & 9 GPIO LED', active: false },
    { id: 5, label: '5. Respons', desc: 'ACK / DONE', active: false },
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
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`rounded-lg p-2.5 border text-center transition-all ${
              stage.active
                ? 'border-accent bg-accent/10 shadow-xs'
                : 'border-border-line bg-surface-2 opacity-60'
            }`}
          >
            <div
              className={`text-xs font-bold mb-0.5 ${
                stage.active ? 'text-accent' : 'text-text-main'
              }`}
            >
              {stage.label}
            </div>
            <div className="text-[10px] text-text-muted truncate">
              {stage.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
