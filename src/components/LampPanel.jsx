import React from 'react';

/**
 * LampPanel
 * Menampilkan tabel grup lampu fisik (TLA, TLB, TLC) dan pemetaan GPIO ESP32.
 * Aturan proyek:
 * - Lampu fisik hanya 3 grup: TLA (TL1+TL2), TLB (TL5+TL6), TLC (TL3+TL4).
 * - Total 3 modul LED (9 GPIO) dan LCD 16x2 I2C.
 */
export default function LampPanel() {
  const groups = [
    {
      group: 'TLA',
      lanes: 'TL1 + TL2',
      direction: 'Utara & Selatan (Lurus)',
      gpio: { r: 4, y: 13, g: 14 },
      activeColor: 'G', // R, Y, G, RY
    },
    {
      group: 'TLB',
      lanes: 'TL5 + TL6',
      direction: 'Utara & Selatan (Belok Kanan)',
      gpio: { r: 26, y: 27, g: 32 },
      activeColor: 'R',
    },
    {
      group: 'TLC',
      lanes: 'TL3 + TL4',
      direction: 'Timur & Barat',
      gpio: { r: 18, y: 19, g: 23 },
      activeColor: 'R',
    },
  ];

  return (
    <div className="rounded-xl border border-border-line bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Grup Lampu & Pemetaan GPIO ESP32
        </h3>
        <span className="text-[11px] text-text-muted">3 Modul LED (9 GPIO)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-line text-text-muted">
              <th className="py-2 px-2 font-medium">Grup</th>
              <th className="py-2 px-2 font-medium">Kepala TL</th>
              <th className="py-2 px-2 font-medium">Arah Jalur</th>
              <th className="py-2 px-2 font-medium font-mono text-center">GPIO (R/Y/G)</th>
              <th className="py-2 px-2 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-line text-text-main">
            {groups.map((item) => (
              <tr key={item.group} className="hover:bg-surface-2/50 transition-colors">
                <td className="py-3 px-2 font-bold text-accent">{item.group}</td>
                <td className="py-3 px-2 font-mono font-medium">{item.lanes}</td>
                <td className="py-3 px-2 text-text-muted">{item.direction}</td>
                <td className="py-3 px-2 font-mono text-center text-text-muted">
                  {item.gpio.r} / {item.gpio.y} / {item.gpio.g}
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center justify-center gap-1.5">
                    {/* Merah */}
                    <span
                      className={`w-3.5 h-3.5 rounded-full border border-border-line transition-all ${
                        item.activeColor === 'R' || item.activeColor === 'RY'
                          ? 'bg-tl-red shadow-xs shadow-tl-red'
                          : 'bg-surface-2 opacity-30'
                      }`}
                      title="Merah"
                    />
                    {/* Kuning */}
                    <span
                      className={`w-3.5 h-3.5 rounded-full border border-border-line transition-all ${
                        item.activeColor === 'Y' || item.activeColor === 'RY'
                          ? 'bg-tl-yellow shadow-xs shadow-tl-yellow'
                          : 'bg-surface-2 opacity-30'
                      }`}
                      title="Kuning"
                    />
                    {/* Hijau */}
                    <span
                      className={`w-3.5 h-3.5 rounded-full border border-border-line transition-all ${
                        item.activeColor === 'G'
                          ? 'bg-tl-green shadow-xs shadow-tl-green'
                          : 'bg-surface-2 opacity-30'
                      }`}
                      title="Hijau"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-2 border-t border-border-line flex flex-wrap justify-between items-center text-[11px] text-text-muted">
        <span>LCD 16x2 I2C: SDA (GPIO 21), SCL (GPIO 22) - Alamat 0x27</span>
        <span className="font-mono">Fase normal: A → B → C</span>
      </div>
    </div>
  );
}
