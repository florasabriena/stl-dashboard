import React, { useState, useEffect, useRef, useCallback } from 'react';
import ConnectionBar from './components/ConnectionBar';
import StatusCard from './components/StatusCard';
import LampPanel from './components/LampPanel';
import PipelineBar from './components/PipelineBar';
import IntersectionSim from './components/IntersectionSim';
import MapView from './components/MapView';
import LogPanel from './components/LogPanel';
import Login from './components/Login';
import {
  createInitialFSMState,
  tickFSM,
  triggerEmergencyPriority,
  notifyAmbulancePassed,
  cancelEmergencyPriority,
} from './lib/fsm';
import {
  DIRECTION_TO_PHASE,
  SIMULATION_PARAMS,
  MAP_CONFIG,
} from './config/constants';

function formatTimestamp() {
  const d = new Date();
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${m}:${s}`;
}

const getSimulatedGpsPosition = (ambulance) => {
  if (!ambulance) return null;
  const baseLat = MAP_CONFIG.latitude;
  const baseLng = MAP_CONFIG.longitude;
  const offset = 0.0035; // ~380m
  switch (ambulance.direction) {
    case 'Utara':
      return { lat: baseLat + offset, lng: baseLng, direction: 'Utara' };
    case 'Selatan':
      return { lat: baseLat - offset, lng: baseLng, direction: 'Selatan' };
    case 'Timur':
      return { lat: baseLat, lng: baseLng + offset, direction: 'Timur' };
    case 'Barat':
      return { lat: baseLat, lng: baseLng - offset, direction: 'Barat' };
    default:
      return null;
  }
};

export default function App() {
  // Mode: 'simulasi' | 'terhubung'
  const [mode, setMode] = useState('simulasi');
  const [showLogin, setShowLogin] = useState(false);

  // Status FSM Simulasi
  const [fsmState, setFsmState] = useState(() => createInitialFSMState());
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  // Status Jalur Data & Ambulans
  const [pipelineStep, setPipelineStep] = useState(0);
  const [activeAmbulance, setActiveAmbulance] = useState(null);
  const ambulanceTimersRef = useRef([]);

  // Log sistem
  const [logs, setLogs] = useState(() => [
    {
      time: formatTimestamp(),
      type: 'SYS',
      msg: 'Dashboard Smart Traffic Light Rawamangun dimulai.',
      isSimulation: true,
    },
    {
      time: formatTimestamp(),
      type: 'FSM',
      msg: 'Inisialisasi FSM normal: STARTUP_ALL_RED (3 s). Siklus normal 66 s.',
      isSimulation: true,
    },
  ]);

  const prevStateCodeRef = useRef(fsmState.stateCode);

  const addLog = useCallback((type, msg, isSim = true) => {
    setLogs((prev) => [
      {
        time: formatTimestamp(),
        type,
        msg,
        isSimulation: isSim,
      },
      ...prev.slice(0, 99), // Simpan 100 log terakhir
    ]);
  }, []);

  // Loop Timer Simulasi FSM (60 FPS atau interval 100ms)
  useEffect(() => {
    if (mode !== 'simulasi' || isPaused) return;

    const intervalMs = 100;
    const timer = setInterval(() => {
      setFsmState((prevState) => {
        const deltaSeconds = (intervalMs / 1000) * simSpeed;
        const nextState = tickFSM(prevState, deltaSeconds);

        // Catat perubahan state ke log
        if (nextState.stateCode !== prevStateCodeRef.current) {
          prevStateCodeRef.current = nextState.stateCode;
          addLog(
            'FSM',
            `Transisi state -> ${nextState.stateCode} (${nextState.remainingSeconds} s). ${nextState.phase} [${nextState.condition}]`
          );
        }

        // Cek jika simulasi prioritas ambulans selesai (DONE)
        if (
          prevState.simulationPriority &&
          prevState.simulationPriority.active &&
          nextState.simulationPriority &&
          !nextState.simulationPriority.active &&
          nextState.simulationPriority.stage === 'DONE' &&
          !nextState.simulationPriority.doneEmitted
        ) {
          nextState.simulationPriority.doneEmitted = true;
          addLog(
            'DONE',
            `[SIMULASI] Prioritas selesai. USB-Serial: {"type":"DONE","id":"${nextState.simulationPriority.requestId}"}`
          );
          setPipelineStep(0);
          setActiveAmbulance(null);
        }

        return nextState;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [mode, isPaused, simSpeed, addLog]);

  // Handler Panggil Ambulans (Hanya di mode Simulasi)
  const handleCallAmbulance = useCallback((direction) => {
    if (activeAmbulance) return; // Satu permintaan ambulans dalam satu waktu

    const dirInfo = DIRECTION_TO_PHASE[direction];
    if (!dirInfo) return;

    const reqId = `req-${Date.now().toString(36)}`;
    setActiveAmbulance({
      direction,
      requestId: reqId,
      targetPhase: dirInfo.targetPhase,
    });

    // Jalur data prioritas simulasi (PRD 10)
    // 1. Deteksi (0.6 s)
    const t1 = setTimeout(() => {
      setPipelineStep(1);
      addLog(
        'SYS',
        `[SIMULASI] YOLOv8n mendeteksi ambulans dari arah ${direction} (request_id=${reqId})`
      );
    }, (SIMULATION_PARAMS.latencies.detection * 1000) / simSpeed);

    // 2. Tulis Firebase (0.9 s)
    const t2 = setTimeout(() => {
      setPipelineStep(2);
      addLog(
        'SYS',
        `[SIMULASI] Menulis permintaan prioritas ke Firebase: /commands/${reqId}`
      );
    }, (SIMULATION_PARAMS.latencies.firebaseWrite * 1000) / simSpeed);

    // 3. Validasi backend (1.3 s)
    const t3 = setTimeout(() => {
      setPipelineStep(3);
      addLog(
        'SYS',
        `[SIMULASI] Python Backend memvalidasi: Arah ${direction} -> Fase ${dirInfo.targetPhase} (Grup ${dirInfo.targetGroup})`
      );
    }, (SIMULATION_PARAMS.latencies.backendValidate * 1000) / simSpeed);

    // 4. Kirim Serial (1.6 s)
    const t4 = setTimeout(() => {
      setPipelineStep(4);
      addLog(
        'SET_PHASE',
        `[SIMULASI] USB-Serial: {"cmd":"SET_PHASE","phase":"${dirInfo.targetPhase}","id":"${reqId}"}`
      );
    }, (SIMULATION_PARAMS.latencies.serialSend * 1000) / simSpeed);

    // 5. Terima ACK & Terapkan Prioritas FSM (1.7 s)
    const t5 = setTimeout(() => {
      setPipelineStep(5);
      addLog(
        'ACK',
        `[SIMULASI] ESP32 ACK: {"type":"ACK","id":"${reqId}","cmd":"SET_PHASE","message":"PRIORITY_SET"}`
      );
      setFsmState((prev) => triggerEmergencyPriority(prev, direction, reqId));
    }, (SIMULATION_PARAMS.latencies.ackReceive * 1000) / simSpeed);

    ambulanceTimersRef.current = [t1, t2, t3, t4, t5];
  }, [activeAmbulance, simSpeed, addLog]);

  // Handler Ambulans Melintasi Persimpangan
  const handleAmbulancePassed = useCallback((reqId) => {
    addLog(
      'SYS',
      `[SIMULASI] Ambulans telah melewati pusat persimpangan. Menahan hijau 2 s lalu rilis.`
    );
    setFsmState((prev) => notifyAmbulancePassed(prev));
  }, [addLog]);

  // Handler Pembatalan Panggilan Ambulans
  const handleCancelAmbulance = useCallback(() => {
    ambulanceTimersRef.current.forEach(clearTimeout);
    ambulanceTimersRef.current = [];

    if (activeAmbulance) {
      addLog(
        'SYS',
        `[SIMULASI] Permintaan prioritas ambulans dibatalkan (request_id=${activeAmbulance.requestId})`
      );
    }

    setFsmState((prev) => cancelEmergencyPriority(prev));
    setActiveAmbulance(null);
    setPipelineStep(0);
  }, [activeAmbulance, addLog]);

  // Handler Reset Simulasi
  const handleResetSimulation = useCallback(() => {
    ambulanceTimersRef.current.forEach(clearTimeout);
    ambulanceTimersRef.current = [];
    setActiveAmbulance(null);
    setPipelineStep(0);
    const initial = createInitialFSMState();
    prevStateCodeRef.current = initial.stateCode;
    setFsmState(initial);
    addLog('SYS', '[SIMULASI] Simulasi di-reset ke STARTUP_ALL_RED (3 s).');
  }, [addLog]);

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

          {/* Saklar Mode & Penanda Mode Jelas */}
          <div className="flex items-center gap-3">
            {mode === 'simulasi' ? (
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
                onClick={() => setMode('simulasi')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  mode === 'simulasi'
                    ? 'bg-accent text-surface shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Simulasi
              </button>
              <button
                type="button"
                onClick={() => setMode('terhubung')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  mode === 'terhubung'
                    ? 'bg-accent text-surface shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Terhubung
              </button>
            </div>

            {/* Tombol Auth untuk mode terhubung */}
            {mode === 'terhubung' && (
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
            <IntersectionSim
              fsmState={fsmState}
              simSpeed={simSpeed}
              isPaused={isPaused}
              activeAmbulance={activeAmbulance}
              onCallAmbulance={handleCallAmbulance}
              onCancelAmbulance={handleCancelAmbulance}
              onAmbulancePassed={handleAmbulancePassed}
              onSpeedChange={(spd) => setSimSpeed(spd)}
              onTogglePause={() => setIsPaused((p) => !p)}
              onReset={handleResetSimulation}
            />
            <MapView
              ambulancePosition={getSimulatedGpsPosition(activeAmbulance)}
              activeDirection={activeAmbulance?.direction}
            />
            <LogPanel
              logs={logs}
              mode={mode}
              onClearLogs={() => setLogs([])}
            />
          </div>

          {/* KOLOM KANAN (Status, Lampu, Koneksi, Jalur Data) */}
          <div className="min-[881px]:col-span-5 flex flex-col gap-6">
            <ConnectionBar mode={mode} />
            <StatusCard fsmState={fsmState} mode={mode} />
            <LampPanel fsmState={fsmState} />
            <PipelineBar
              activeStep={pipelineStep}
              isPriorityActive={!!activeAmbulance}
            />
          </div>
        </div>
      </main>

      {/* Modal Login Firebase */}
      <Login isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
