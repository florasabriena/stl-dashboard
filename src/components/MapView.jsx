import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_CONFIG } from '../config/constants.js';

/**
 * Custom divIcon untuk persimpangan dan ambulans.
 * Menggunakan divIcon untuk menghindari masalah bundling asset default Leaflet di Vite.
 */
function createIntersectionIcon() {
  return L.divIcon({
    className: 'custom-intersection-pin',
    html: `
      <div style="
        background: #0E7490;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        cursor: pointer;
      ">
        🚦
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function createAmbulanceIcon(patientType = 'darurat') {
  const isDarurat = patientType === 'darurat';
  const bgColor = isDarurat ? '#EF4444' : '#F59E0B';
  const ringColor = isDarurat ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.35)';
  const shadowColor = isDarurat ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.7)';

  return L.divIcon({
    className: 'custom-ambulance-pin',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: ${ringColor};
          animation: ping ${isDarurat ? '1.2s' : '2.2s'} cubic-bezier(0, 0, 0.2, 1) infinite;
        "></span>
        <div style="
          position: relative;
          background: ${bgColor};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2.5px solid #FFFFFF;
          box-shadow: 0 0 12px ${shadowColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
        ">
          🚑
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

/**
 * MapView
 * Menampilkan peta OpenStreetMap (react-leaflet) untuk kawasan persimpangan Rawamangun
 * beserta marker persimpangan dan marker multi-ambulans.
 *
 * Catatan penting:
 * - Belum ada sumber data GPS nyata: tidak membuat listener Firebase untuk posisi ambulans.
 * - Arah kedatangan tetap dipilih pengguna di UI dan GPS tidak menggantikannya.
 * - Menggunakan divIcon & CircleMarker untuk menghindari masalah resolusi gambar ikon default Leaflet.
 */
export default function MapView({
  ambulancePosition = null,
  activeDirection = null,
  ambulances = [],
}) {
  const center = useMemo(
    () => [MAP_CONFIG.latitude, MAP_CONFIG.longitude],
    []
  );

  const intersectionIcon = useMemo(() => createIntersectionIcon(), []);
  const daruratIcon = useMemo(() => createAmbulanceIcon('darurat'), []);
  const nonDaruratIcon = useMemo(() => createAmbulanceIcon('non-darurat'), []);

  // Normalisasi daftar ambulans dari props
  const normalizedAmbulances = useMemo(() => {
    if (Array.isArray(ambulances) && ambulances.length > 0) {
      return ambulances.filter(
        (a) => typeof a.lat === 'number' && typeof a.lng === 'number'
      );
    }
    if (ambulancePosition) {
      if (Array.isArray(ambulancePosition) && ambulancePosition.length === 2) {
        return [
          {
            requestId: 'single',
            label: 'AMB-1',
            lat: ambulancePosition[0],
            lng: ambulancePosition[1],
            direction: activeDirection,
            patientType: 'darurat',
          },
        ];
      }
      if (
        typeof ambulancePosition.lat === 'number' &&
        typeof ambulancePosition.lng === 'number'
      ) {
        return [
          {
            requestId: 'single',
            label: 'AMB-1',
            lat: ambulancePosition.lat,
            lng: ambulancePosition.lng,
            direction: ambulancePosition.direction || activeDirection,
            patientType: ambulancePosition.patientType || 'darurat',
          },
        ];
      }
    }
    return [];
  }, [ambulances, ambulancePosition, activeDirection]);

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs flex flex-col">
      {/* Header Panel Peta */}
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Peta Geografis Persimpangan & Ambulans
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            {MAP_CONFIG.name} · OpenStreetMap
          </p>
        </div>
        <div className="flex items-center gap-2">
          {normalizedAmbulances.length > 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error text-white animate-pulse">
              {normalizedAmbulances.length} Ambulans Terdeteksi (GPS Pendukung)
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
              GPS Standby
            </span>
          )}
        </div>
      </div>

      {/* Kontainer Peta Leaflet */}
      <div className="w-full h-64 sm:h-72 rounded-lg border border-border-line overflow-hidden relative z-0">
        <MapContainer
          center={center}
          zoom={MAP_CONFIG.zoom || 17}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          {/* Tile Layer OpenStreetMap dengan atribusi wajib */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Lingkaran batas deteksi sekitar persimpangan (CircleMarker) */}
          <CircleMarker
            center={center}
            radius={40}
            pathOptions={{
              color: '#0E7490',
              fillColor: '#22D3EE',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '4, 4',
            }}
          />

          {/* Marker Persimpangan Smart Traffic Light (divIcon) */}
          <Marker position={center} icon={intersectionIcon}>
            <Popup>
              <div className="text-xs p-1 text-slate-800">
                <div className="font-bold text-sm text-cyan-800">
                  {MAP_CONFIG.name}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Smart Traffic Light Kelompok 12
                </div>
                <div className="font-mono text-[10px] text-slate-500 mt-1">
                  Koordinat: {MAP_CONFIG.latitude.toFixed(4)}°, {MAP_CONFIG.longitude.toFixed(4)}°
                </div>
                <div className="text-[10px] text-slate-600 mt-1 border-t border-slate-200 pt-1">
                  6 Kepala TL (TLA, TLB, TLC) · 3 Fase
                </div>
              </div>
            </Popup>
          </Marker>

          {/* Marker Multi-Ambulans dari Props (divIcon) */}
          {normalizedAmbulances.map((amb) => {
            const isDarurat = amb.patientType !== 'non-darurat';
            return (
              <Marker
                key={amb.requestId || `${amb.direction}-${amb.label}`}
                position={[amb.lat, amb.lng]}
                icon={isDarurat ? daruratIcon : nonDaruratIcon}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-800">
                    <div className={`font-bold flex items-center gap-1 ${isDarurat ? 'text-red-600' : 'text-amber-600'}`}>
                      <span>🚑</span> {amb.label || 'Ambulans'} ({isDarurat ? 'DARURAT' : 'NON-DARURAT'})
                    </div>
                    <div className="text-[11px] text-slate-700 mt-0.5">
                      Arah kedatangan:{' '}
                      <strong>{amb.direction || 'Dipilih Pengguna'}</strong>
                    </div>
                    {typeof amb.distanceToStopLine === 'number' && (
                      <div className="text-[11px] text-slate-700">
                        Jarak ke garis henti: <strong>{amb.distanceToStopLine.toFixed(1)} m</strong> (40 km/jam)
                      </div>
                    )}
                    <div className="font-mono text-[10px] text-slate-500 mt-1">
                      Lat: {amb.lat.toFixed(5)}°, Lng: {amb.lng.toFixed(5)}°
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 border-t border-slate-200 pt-1">
                      Catatan: Arah tetap ditentukan oleh pilihan pengguna.
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Catatan Penjelas di bawah Peta */}
      <div className="mt-2.5 pt-2 border-t border-border-line flex flex-wrap items-center justify-between text-[11px] text-text-muted gap-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span>Persimpangan Rawamangun ({MAP_CONFIG.latitude}°, {MAP_CONFIG.longitude}°)</span>
        </span>
        <span className="text-[10px] italic">
          *Posisi GPS ambulans bersifat informasi pendukung; arah prioritas ditentukan oleh pilihan pengguna.
        </span>
      </div>
    </div>
  );
}
