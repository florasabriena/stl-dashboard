import React from 'react';

/**
 * LogPanel
 * Menampilkan log peristiwa sistem:
 * - Font monospace 11.5px (PRD 9.4)
 * - Mode simulasi: pesan JSONL, SET_PHASE, ACK, DONE
 * - Mode terhubung: perintah dari /commands dan respons ACK/NAK/TIMEOUT dari /responses
 * - Teks log di-escape agar aman dari injeksi
 */
export default function LogPanel({ mode = 'simulasi' }) {
  const isSim = mode === 'simulasi';

  // Contoh log data awal placeholder
  const placeholderLogs = isSim
    ? [
        { time: '00:01', type: 'SYS', msg: 'Sistem dimulai. Inisialisasi layar pembuka 3 s.' },
        { time: '00:04', type: 'FSM', msg: 'Transisi state -> STARTUP_ALL_RED (3 s).' },
        { time: '00:07', type: 'FSM', msg: 'Transisi state -> A_RED_YELLOW (2 s).' },
        { time: '00:09', type: 'FSM', msg: 'Transisi state -> A_GREEN (15 s). Fase A aktif.' },
        { time: '00:15', type: 'INFO', msg: 'Simulasi lalu lintas 60 FPS berjalan normal.' },
      ]
    : [
        { time: '10:24', type: 'ACK', msg: '{"type":"ACK","id":"poll-001","cmd":"STATUS","state":"A_GREEN","remaining_seconds":15}' },
        { time: '10:27', type: 'ACK', msg: '{"type":"ACK","id":"ping-101","cmd":"PING","message":"PONG"}' },
        { time: '10:30', type: 'SYS', msg: 'Heartbeat backend diterima (last_seen: 2026-11-20T03:30:00Z).' },
      ];

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Log Komunikasi Sistem
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
            {isSim ? 'Simulasi' : 'Firebase JSONL'}
          </span>
        </div>
        <button
          type="button"
          className="text-[11px] text-text-muted hover:text-text-main transition-colors"
        >
          Bersihkan
        </button>
      </div>

      {/* Log Feed Container with Monospace Font 11.5px */}
      <div className="h-44 overflow-y-auto rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed border border-border-line flex flex-col gap-1.5">
        {placeholderLogs.map((log, index) => (
          <div key={index} className="flex items-start gap-2 text-text-muted">
            <span className="text-text-muted/70 shrink-0 font-medium">{log.time}</span>
            <span
              className={`px-1 rounded text-[10px] font-bold shrink-0 ${
                log.type === 'ACK'
                  ? 'bg-success/20 text-success'
                  : log.type === 'FSM'
                  ? 'bg-accent/20 text-accent'
                  : log.type === 'SYS'
                  ? 'bg-text-muted/20 text-text-main'
                  : 'bg-surface text-text-muted'
              }`}
            >
              {log.type}
            </span>
            <span className="text-text-main break-all">{log.msg}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] text-text-muted flex justify-between items-center">
        <span>Stempel waktu WIB (Asia/Jakarta)</span>
        <span>{isSim ? 'SET_PHASE & DONE aktif' : 'Hanya /commands & /responses'}</span>
      </div>
    </div>
  );
}
