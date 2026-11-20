import React from 'react';

/**
 * LogPanel
 * Menampilkan log komunikasi sistem:
 * - Font monospace 11.5px (PRD 9.4)
 * - Mode simulasi: pesan JSONL, SET_PHASE, ACK, DONE dengan label simulasi
 * - Mode terhubung: perintah dari /commands dan respons ACK/NAK/TIMEOUT dari /responses
 * - Teks log di-escape agar aman dari injeksi HTML
 */
export default function LogPanel({ logs = [], mode = 'simulasi', onClearLogs }) {
  const isSim = mode === 'simulasi';

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Log Komunikasi Sistem
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
            {isSim ? 'Mode Simulasi' : 'Firebase RTDB'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClearLogs}
          className="text-[11px] text-text-muted hover:text-text-main transition-colors px-2 py-0.5 rounded-md hover:bg-surface-2"
        >
          Bersihkan
        </button>
      </div>

      {/* Log Feed Container dengan Font Monospace 11.5px */}
      <div className="h-56 overflow-y-auto rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed border border-border-line flex flex-col gap-1.5 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="text-text-muted text-center py-8">
            Belum ada log tercatat.
          </div>
        ) : (
          logs.map((log, index) => {
            let badgeClass = 'bg-surface text-text-muted';
            if (log.type === 'ACK') badgeClass = 'bg-success/20 text-success';
            else if (log.type === 'SET_PHASE') badgeClass = 'bg-amber-500/20 text-amber-500 font-bold';
            else if (log.type === 'DONE') badgeClass = 'bg-blue-500/20 text-blue-400 font-bold';
            else if (log.type === 'FSM') badgeClass = 'bg-accent/20 text-accent';
            else if (log.type === 'SYS') badgeClass = 'bg-text-muted/20 text-text-main';
            else if (log.type === 'NAK' || log.type === 'TIMEOUT') badgeClass = 'bg-error/20 text-error';

            return (
              <div key={index} className="flex items-start gap-2 text-text-muted">
                <span className="text-text-muted/70 shrink-0 font-medium">
                  {log.time}
                </span>
                <span className={`px-1 rounded text-[10px] shrink-0 font-bold ${badgeClass}`}>
                  {log.type}
                </span>
                <span className="text-text-main break-all">
                  {log.msg}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 text-[10px] text-text-muted flex justify-between items-center">
        <span>Stempel waktu WIB (Asia/Jakarta)</span>
        <span>
          {isSim
            ? 'SET_PHASE & DONE aktif (simulasi)'
            : 'Hanya /commands & /responses'}
        </span>
      </div>
    </div>
  );
}
