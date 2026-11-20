import React from 'react';
import { LAMP_GROUPS, HARDWARE_CONFIG } from '../config/constants.js';
import { getLampColors } from '../lib/fsm.js';

/**
 * LampPanel
 * Menampilkan grup lampu fisik TLA, TLB, TLC dan pemetaan GPIO ESP32.
 * Warna lampu TLA/TLB/TLC diwarnai dari state memakai tabel di constants.js.
 * Tangani kondisi "UNKNOWN".
 */
export default function LampPanel({ fsmState, mode = 'simulasi', liveEsp32Status = null }) {
  const isConnectedMode = mode === 'terhubung';
  const currentStateCode = isConnectedMode
    ? liveEsp32Status?.state || 'UNKNOWN'
    : fsmState?.stateCode || 'STARTUP_ALL_RED';

  // Ambil warna lampu dari tabel konstanta
  const lampColors = getLampColors(currentStateCode);

  const groups = [
    {
      group: 'TLA',
      lanes: LAMP_GROUPS.TLA.lanes,
      heads: 'TL1 + TL2',
      direction: LAMP_GROUPS.TLA.direction,
      gpio: LAMP_GROUPS.TLA.gpio,
      colorCode: lampColors.TLA,
    },
    {
      group: 'TLB',
      lanes: LAMP_GROUPS.TLB.lanes,
      heads: 'TL5 + TL6',
      direction: LAMP_GROUPS.TLB.direction,
      gpio: LAMP_GROUPS.TLB.gpio,
      colorCode: lampColors.TLB,
    },
    {
      group: 'TLC',
      lanes: LAMP_GROUPS.TLC.lanes,
      heads: 'TL3 + TL4',
      direction: LAMP_GROUPS.TLC.direction,
      gpio: LAMP_GROUPS.TLC.gpio,
      colorCode: lampColors.TLC,
    },
  ];

  return (
    <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Grup Lampu & Pemetaan GPIO ESP32
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            3 Grup Fisik · 9 GPIO LED · LCD 16×2 I2C
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
          {isConnectedMode ? `State: ${currentStateCode}` : 'Firmware ESP32'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-line text-text-muted">
              <th className="py-2 px-2 font-medium">Grup</th>
              <th className="py-2 px-2 font-medium">Kepala TL</th>
              <th className="py-2 px-2 font-medium">Arah Jalur</th>
              <th className="py-2 px-2 font-medium font-mono text-center">GPIO (R / Y / G)</th>
              <th className="py-2 px-2 font-medium text-center">Indikator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-line text-text-main">
            {groups.map((item) => {
              const isRed = item.colorCode === 'R' || item.colorCode === 'RY';
              const isYellow = item.colorCode === 'Y' || item.colorCode === 'RY';
              const isGreen = item.colorCode === 'G';

              return (
                <tr key={item.group} className="hover:bg-surface-2/50 transition-colors">
                  <td className="py-3 px-2 font-bold text-accent">{item.group}</td>
                  <td className="py-3 px-2 font-mono font-medium">{item.heads}</td>
                  <td className="py-3 px-2 text-text-muted">{item.direction}</td>
                  <td className="py-3 px-2 font-mono text-center text-text-muted">
                    <span className="text-tl-red font-semibold">{item.gpio.r}</span> /{' '}
                    <span className="text-tl-yellow font-semibold">{item.gpio.y}</span> /{' '}
                    <span className="text-tl-green font-semibold">{item.gpio.g}</span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Merah */}
                      <span
                        className={`w-3.5 h-3.5 rounded-full border border-border-line transition-all ${
                          isRed
                            ? 'bg-tl-red shadow-xs shadow-tl-red scale-110'
                            : 'bg-surface-2 opacity-25'
                        }`}
                        title="Merah"
                      />
                      {/* Kuning */}
                      <span
                        className={`w-3.5 h-3.5 rounded-full border border-border-line transition-all ${
                          isYellow
                            ? 'bg-tl-yellow shadow-xs shadow-tl-yellow scale-110'
                            : 'bg-surface-2 opacity-25'
                        }`}
                        title="Kuning"
                      />
                      {/* Hijau */}
                      <span
                        className={`w-3.5 h-3.5 rounded-full border border-border-line transition-all ${
                          isGreen
                            ? 'bg-tl-green shadow-xs shadow-tl-green scale-110'
                            : 'bg-surface-2 opacity-25'
                        }`}
                        title="Hijau"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-2 border-t border-border-line flex flex-wrap justify-between items-center text-[11px] text-text-muted gap-2">
        <span>
          LCD 16x2 I2C: SDA (GPIO {HARDWARE_CONFIG.lcdI2C.sda}), SCL (GPIO {HARDWARE_CONFIG.lcdI2C.scl}) · Alamat {HARDWARE_CONFIG.lcdI2C.address}
        </span>
        <span className="font-mono text-text-muted">Urutan normal: A → B → C</span>
      </div>
    </div>
  );
}
