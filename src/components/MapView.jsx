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

function createAmbulanceIcon(direction) {
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
          background: rgba(239, 68, 68, 0.4);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></span>
        <div style="
          position: relative;
          background: #EF4444;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2.5px solid #FFFFFF;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
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
 * beserta marker persimpangan dan marker ambulans.
 *
 * Catatan penting:
 * - Belum ada sumber data GPS nyata: tidak membuat listener Firebase untuk posisi ambulans.
 * - Arah kedatangan tetap dipilih pengguna di UI dan GPS tidak menggantikannya.
 * - Menggunakan divIcon & CircleMarker untuk menghindari masalah resolusi gambar ikon default Leaflet.
 */
export default function MapView({
  ambulancePosition = null,
  activeDirection = null,
}) {
  const center = useMemo(
    () => [MAP_CONFIG.latitude, MAP_CONFIG.longitude],
    []
  );

  const intersectionIcon = useMemo(() => createIntersectionIcon(), []);
  const ambulanceIcon = useMemo(
    () => createAmbulanceIcon(ambulancePosition?.direction || activeDirection),
    [ambulancePosition, activeDirection]
  );

  // Normalisasi posisi ambulans dari props (array [lat, lng] atau objek { lat, lng })
  const ambCoords = useMemo(() => {
    if (!ambulancePosition) return null;
    if (Array.isArray(ambulancePosition) && ambulancePosition.length === 2) {
      return ambulancePosition;
    }
    if (
      typeof ambulancePosition.lat === 'number' &&
      typeof ambulancePosition.lng === 'number'
    ) {
      return [ambulancePosition.lat, ambulancePosition.lng];
    }
    return null;
  }, [ambulancePosition]);

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
          {ambCoords ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error text-white animate-pulse">
              Ambulans Terdeteksi (GPS Pendukung)
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

          {/* Marker Ambulans dari Props (divIcon) */}
          {ambCoords && (
            <Marker position={ambCoords} icon={ambulanceIcon}>
              <Popup>
                <div className="text-xs p-1 text-slate-800">
                  <div className="font-bold text-red-600 flex items-center gap-1">
                    <span>🚑</span> Posisi Ambulans (GPS Pendukung)
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5">
                    Arah kedatangan:{' '}
                    <strong>{ambulancePosition?.direction || activeDirection || 'Dipilih Pengguna'}</strong>
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-1">
                    Lat: {ambCoords[0].toFixed(5)}°, Lng: {ambCoords[1].toFixed(5)}°
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 border-t border-slate-200 pt-1">
                    Catatan: Arah tetap ditentukan oleh pilihan pengguna.
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
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
