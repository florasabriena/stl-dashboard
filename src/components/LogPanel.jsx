import React from 'react';
import { escapeText } from '../lib/liveData.js';

/**
 * LogPanel
 * - Mode Simulasi: Menampilkan log FSM, pesan JSONL, SET_PHASE, ACK, dan DONE
 * - Mode Terhubung: Menyusun baris dari /commands dan /responses (ACK, NAK, TIMEOUT)
 *   dengan waktu WIB; TIDAK menampilkan SET_PHASE atau DONE.
 * - Pesan TIMEOUT berupa kalimat penjelas, bukan kode.
 * - Semua teks dari Firebase di-escape untuk keamanan XSS.
 */
export default function LogPanel({
  logs = [],
  mode = 'simulasi',
  connectedLogs = [],
  onClearLogs,
}) {
  const isConnectedMode = mode === 'terhubung';
  const displayedLogs = isConnectedMode ? connectedLogs : logs;

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Log Komunikasi Sistem
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
            {isConnectedMode ? 'Firebase RTDB (/commands & /responses)' : 'Mode Simulasi (Lokal)'}
          </span>
        </div>
        {!isConnectedMode && onClearLogs && (
          <button
            type="button"
            onClick={onClearLogs}
            className="text-[11px] text-text-muted hover:text-text-main transition-colors px-2 py-0.5 rounded-md hover:bg-surface-2"
          >
            Bersihkan
          </button>
        )}
      </div>

      {/* Container Log Monospace 11.5px */}
      <div className="h-56 overflow-y-auto rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed border border-border-line flex flex-col gap-1.5 scrollbar-thin">
        {displayedLogs.length === 0 ? (
          <div className="text-text-muted text-center py-8">
            {isConnectedMode
              ? 'Belum ada log dari /commands atau /responses di Firebase.'
              : 'Belum ada log tercatat.'}
          </div>
        ) : (
          displayedLogs.map((log, index) => {
            let badgeClass = 'bg-surface text-text-muted';
            if (log.type === 'ACK') badgeClass = 'bg-success/20 text-success font-bold';
            else if (log.type === 'CMD') badgeClass = 'bg-cyan-500/20 text-cyan-400 font-bold';
            else if (log.type === 'TIMEOUT') badgeClass = 'bg-error/20 text-error font-bold';
            else if (log.type === 'NAK') badgeClass = 'bg-amber-500/20 text-amber-500 font-bold';
            else if (log.type === 'SET_PHASE') badgeClass = 'bg-amber-500/20 text-amber-500 font-bold';
            else if (log.type === 'DONE') badgeClass = 'bg-blue-500/20 text-blue-400 font-bold';
            else if (log.type === 'FSM') badgeClass = 'bg-accent/20 text-accent';
            else if (log.type === 'SYS') badgeClass = 'bg-text-muted/20 text-text-main';

            return (
              <div key={log.id || index} className="flex items-start gap-2 text-text-muted">
                <span className="text-text-muted/70 shrink-0 font-medium">
                  {log.time}
                </span>
                <span className={`px-1 rounded text-[10px] shrink-0 ${badgeClass}`}>
                  {log.type}
                </span>
                <span className="text-text-main break-all">
                  {escapeText(log.msg)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 text-[10px] text-text-muted flex justify-between items-center">
        <span>Stempel waktu WIB (Asia/Jakarta, UTC+7)</span>
        <span>
          {isConnectedMode
            ? 'Hanya /commands & /responses (ACK/NAK/TIMEOUT)'
            : 'SET_PHASE & DONE aktif (simulasi)'}
        </span>
      </div>
    </div>
  );
}
