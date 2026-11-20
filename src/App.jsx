import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
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
import {
  subscribeToFirebaseConnection,
  subscribeToEsp32Status,
  subscribeToBackendStatus,
  subscribeToCommands,
  subscribeToResponses,
  buildConnectedLogList,
} from './lib/liveData';

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
  const [currentUser, setCurrentUser] = useState(null);

  // Status FSM Simulasi
  const [fsmState, setFsmState] = useState(() => createInitialFSMState());
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  // Status Jalur Data & Ambulans (Simulasi)
  const [pipelineStep, setPipelineStep] = useState(0);
  const [activeAmbulance, setActiveAmbulance] = useState(null);
  const ambulanceTimersRef = useRef([]);

  // Log simulasi
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

  // Status Live Firebase Realtime Database (Hanya-Baca)
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [liveEsp32Status, setLiveEsp32Status] = useState(null);
  const [liveBackendStatus, setLiveBackendStatus] = useState(null);
  const [liveCommands, setLiveCommands] = useState([]);
  const [liveResponses, setLiveResponses] = useState([]);

  // Hitung mundur lokal dan umur data
  const [localCountdown, setLocalCountdown] = useState(null);
  const [esp32Age, setEsp32Age] = useState(0);
  const [backendAge, setBackendAge] = useState(0);

  const rawRemainingSecondsRef = useRef(null);
  const esp32ReceivedAtRef = useRef(null);
  const lastEsp32UpdatedAtRef = useRef(null);
  const lastEsp32ChangeTimeRef = useRef(null);

  const lastBackendSeenRef = useRef(null);
  const lastBackendChangeTimeRef = useRef(null);

  const prevStateCodeRef = useRef(fsmState.stateCode);

  const addLog = useCallback((type, msg, isSim = true) => {
    setLogs((prev) => [
      {
        time: formatTimestamp(),
        type,
        msg,
        isSimulation: isSim,
      },
      ...prev.slice(0, 99),
    ]);
  }, []);

  // 1. Pantau Status Autentikasi Firebase
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        addLog('SYS', `[AUTH] Berhasil masuk sebagai: ${user.email}`, false);
      }
    });
    return () => unsubAuth();
  }, [addLog]);

  // Handler ganti mode (Mode Terhubung wajib login)
  const handleModeChange = (newMode) => {
    if (newMode === 'terhubung' && !currentUser) {
      setShowLogin(true);
      return;
    }
    setMode(newMode);
  };

  // Handler keluar (Sign Out)
  const handleLogout = async () => {
    try {
      const email = currentUser?.email;
      await signOut(auth);
      addLog('SYS', `[AUTH] Pengguna ${email || ''} telah keluar.`, false);
      // Kembali ke mode simulasi jika sedang di mode terhubung
      if (mode === 'terhubung') {
        setMode('simulasi');
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // 2. Pasang Listener HANYA-BACA ke Firebase RTDB
  useEffect(() => {
    const unsubConn = subscribeToFirebaseConnection((conn) => {
      setFirebaseConnected(conn);
    });

    const unsubEsp32 = subscribeToEsp32Status((data) => {
      setLiveEsp32Status(data);
      if (data) {
        if (data.updated_at !== lastEsp32UpdatedAtRef.current) {
          lastEsp32UpdatedAtRef.current = data.updated_at;
          lastEsp32ChangeTimeRef.current = Date.now();
        }
        rawRemainingSecondsRef.current = data.remaining_seconds;
        esp32ReceivedAtRef.current = data.receivedAt;
      }
    });

    const unsubBackend = subscribeToBackendStatus((data) => {
      setLiveBackendStatus(data);
      if (data) {
        if (data.last_seen !== lastBackendSeenRef.current) {
          lastBackendSeenRef.current = data.last_seen;
          lastBackendChangeTimeRef.current = Date.now();
        }
      }
    });

    const unsubCmds = subscribeToCommands((cmds) => {
      setLiveCommands(cmds);
    });

    const unsubRes = subscribeToResponses((resps) => {
      setLiveResponses(resps);
    });

    return () => {
      unsubConn();
      unsubEsp32();
      unsubBackend();
      unsubCmds();
      unsubRes();
    };
  }, []);

  // 3. Interval 1 Detik untuk Hitung Mundur Lokal & Umur Data
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      if (rawRemainingSecondsRef.current != null && esp32ReceivedAtRef.current) {
        const elapsedSec = Math.floor((now - esp32ReceivedAtRef.current) / 1000);
        setLocalCountdown(Math.max(0, rawRemainingSecondsRef.current - elapsedSec));
      } else {
        setLocalCountdown(null);
      }

      if (lastEsp32ChangeTimeRef.current) {
        const age = Math.floor((now - lastEsp32ChangeTimeRef.current) / 1000);
        setEsp32Age(age);
      } else {
        setEsp32Age(0);
      }

      if (lastBackendChangeTimeRef.current) {
        const age = Math.floor((now - lastBackendChangeTimeRef.current) / 1000);
        setBackendAge(age);
      } else {
        setBackendAge(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 4. Log Tersusun untuk Mode Terhubung (/commands dan /responses)
  const connectedLogs = useMemo(() => {
    return buildConnectedLogList(liveCommands, liveResponses);
  }, [liveCommands, liveResponses]);

  // 5. Loop Timer Simulasi FSM Lokal (Mode Simulasi)
  useEffect(() => {
    if (mode !== 'simulasi' || isPaused) return;

    const intervalMs = 100;
    const timer = setInterval(() => {
      setFsmState((prevState) => {
        const deltaSeconds = (intervalMs / 1000) * simSpeed;
        const nextState = tickFSM(prevState, deltaSeconds);

        if (nextState.stateCode !== prevStateCodeRef.current) {
          prevStateCodeRef.current = nextState.stateCode;
          addLog(
            'FSM',
            `Transisi state -> ${nextState.stateCode} (${nextState.remainingSeconds} s). ${nextState.phase} [${nextState.condition}]`
          );
        }

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
    if (activeAmbulance || mode !== 'simulasi') return;

    const dirInfo = DIRECTION_TO_PHASE[direction];
    if (!dirInfo) return;

    const reqId = `req-${Date.now().toString(36)}`;
    setActiveAmbulance({
      direction,
      requestId: reqId,
      targetPhase: dirInfo.targetPhase,
    });

    const t1 = setTimeout(() => {
      setPipelineStep(1);
      addLog(
        'SYS',
        `[SIMULASI] YOLOv8n mendeteksi ambulans dari arah ${direction} (request_id=${reqId})`
      );
    }, (SIMULATION_PARAMS.latencies.detection * 1000) / simSpeed);

    const t2 = setTimeout(() => {
      setPipelineStep(2);
      addLog(
        'SYS',
        `[SIMULASI] Menulis permintaan prioritas ke Firebase: /commands/${reqId}`
      );
    }, (SIMULATION_PARAMS.latencies.firebaseWrite * 1000) / simSpeed);

    const t3 = setTimeout(() => {
      setPipelineStep(3);
      addLog(
        'SYS',
        `[SIMULASI] Python Backend memvalidasi: Arah ${direction} -> Fase ${dirInfo.targetPhase} (Grup ${dirInfo.targetGroup})`
      );
    }, (SIMULATION_PARAMS.latencies.backendValidate * 1000) / simSpeed);

    const t4 = setTimeout(() => {
      setPipelineStep(4);
      addLog(
        'SET_PHASE',
        `[SIMULASI] USB-Serial: {"cmd":"SET_PHASE","phase":"${dirInfo.targetPhase}","id":"${reqId}"}`
      );
    }, (SIMULATION_PARAMS.latencies.serialSend * 1000) / simSpeed);

    const t5 = setTimeout(() => {
      setPipelineStep(5);
      addLog(
        'ACK',
        `[SIMULASI] ESP32 ACK: {"type":"ACK","id":"${reqId}","cmd":"SET_PHASE","message":"PRIORITY_SET"}`
      );
      setFsmState((prev) => triggerEmergencyPriority(prev, direction, reqId));
    }, (SIMULATION_PARAMS.latencies.ackReceive * 1000) / simSpeed);

    ambulanceTimersRef.current = [t1, t2, t3, t4, t5];
  }, [activeAmbulance, mode, simSpeed, addLog]);

  const handleAmbulancePassed = useCallback((reqId) => {
    addLog(
      'SYS',
      `[SIMULASI] Ambulans telah melewati pusat persimpangan. Menahan hijau 2 s lalu rilis.`
    );
    setFsmState((prev) => notifyAmbulancePassed(prev));
  }, [addLog]);

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

          {/* Saklar Mode, Penanda Mode, dan Tombol Akun */}
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
                onClick={() => handleModeChange('simulasi')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  mode === 'simulasi'
                    ? 'bg-accent text-surface shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Simulasi
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('terhubung')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  mode === 'terhubung'
                    ? 'bg-accent text-surface shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Terhubung
              </button>
            </div>

            {/* Tombol Profil / Keluar / Login */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-border-line">
                <span
                  className="text-xs text-text-muted px-2 py-1 rounded-md bg-surface-2 border border-border-line max-w-[150px] truncate"
                  title={currentUser.email}
                >
                  👤 {currentUser.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-border-line bg-surface-2 hover:bg-error/15 hover:text-error hover:border-error/40 text-text-muted transition-colors cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border-line bg-surface-2 hover:bg-surface-2/80 text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Gate Perlindungan: Mode Terhubung hanya bisa dibuka setelah Login */}
        {mode === 'terhubung' && !currentUser ? (
          <div className="max-w-md mx-auto my-12 p-8 rounded-xl border border-border-line bg-surface text-center shadow-xl">
            <div className="w-14 h-14 rounded-full bg-accent/15 text-accent flex items-center justify-center mx-auto mb-3 text-2xl border border-accent/30">
              🔒
            </div>
            <h2 className="text-base font-bold text-text-main mb-1.5">
              Akses Mode Terhubung Dibatasi
            </h2>
            <p className="text-xs text-text-muted mb-6 leading-relaxed">
              Mode Terhubung hanya bisa dibuka setelah login dengan akun Firebase resmi. Mode Simulasi tetap terbuka tanpa login.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="px-4 py-2.5 rounded-lg bg-accent text-surface text-xs font-bold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
              >
                Masuk Sekarang
              </button>
              <button
                type="button"
                onClick={() => setMode('simulasi')}
                className="px-4 py-2.5 rounded-lg bg-surface-2 text-text-muted hover:text-text-main text-xs font-semibold transition-colors border border-border-line cursor-pointer"
              >
                Tetap di Mode Simulasi
              </button>
            </div>
          </div>
        ) : (
          /* TATA LETAK DUA KOLOM (SATU KOLOM DI HP) */
          <div className="grid grid-cols-1 min-[881px]:grid-cols-12 gap-6 items-start">
            {/* KOLOM KIRI (Canvas Persimpangan, MapView, Log) */}
            <div className="min-[881px]:col-span-7 flex flex-col gap-6">
              <IntersectionSim
                fsmState={fsmState}
                mode={mode}
                liveEsp32Status={liveEsp32Status}
                simSpeed={simSpeed}
                isPaused={isPaused}
                activeAmbulance={mode === 'simulasi' ? activeAmbulance : null}
                onCallAmbulance={handleCallAmbulance}
                onCancelAmbulance={handleCancelAmbulance}
                onAmbulancePassed={handleAmbulancePassed}
                onSpeedChange={(spd) => setSimSpeed(spd)}
                onTogglePause={() => setIsPaused((p) => !p)}
                onReset={handleResetSimulation}
              />
              <MapView
                ambulancePosition={mode === 'simulasi' ? getSimulatedGpsPosition(activeAmbulance) : null}
                activeDirection={mode === 'simulasi' ? activeAmbulance?.direction : null}
              />
              <LogPanel
                logs={logs}
                mode={mode}
                connectedLogs={connectedLogs}
                onClearLogs={() => setLogs([])}
              />
            </div>

            {/* KOLOM KANAN (Status, Lampu, Koneksi, Jalur Data) */}
            <div className="min-[881px]:col-span-5 flex flex-col gap-6">
              <ConnectionBar
                mode={mode}
                firebaseConnected={firebaseConnected}
                backendData={liveBackendStatus}
                esp32Data={liveEsp32Status}
                esp32Age={esp32Age}
                backendAge={backendAge}
              />
              <StatusCard
                fsmState={fsmState}
                mode={mode}
                liveEsp32Status={liveEsp32Status}
                localCountdown={localCountdown}
              />
              <LampPanel
                fsmState={fsmState}
                mode={mode}
                liveEsp32Status={liveEsp32Status}
              />
              <PipelineBar
                activeStep={pipelineStep}
                isPriorityActive={mode === 'simulasi' && !!activeAmbulance}
                mode={mode}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modal Login Firebase */}
      <Login
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => {
          setShowLogin(false);
          setMode('terhubung');
        }}
        onSwitchToSimulation={() => {
          setShowLogin(false);
          setMode('simulasi');
        }}
      />
    </div>
  );
}
