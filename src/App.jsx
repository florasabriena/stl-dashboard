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
  AMBULANCE_SPEED_KMH,
  AMBULANCE_SPAWN_DISTANCE_METERS,
  getQueueDensityInfo,
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

const getSimulatedGpsPositions = (ambulances) => {
  if (!Array.isArray(ambulances) || ambulances.length === 0) return [];
  const baseLat = MAP_CONFIG.latitude;
  const baseLng = MAP_CONFIG.longitude;
  const maxOffset = 0.0035; // ~380m max

  return ambulances.map((amb) => {
    const ratio = Math.max(
      0.05,
      Math.min(1, (amb.distanceToStopLine ?? 150) / AMBULANCE_SPAWN_DISTANCE_METERS)
    );
    const offset = maxOffset * ratio;
    let lat = baseLat;
    let lng = baseLng;
    switch (amb.direction) {
      case 'Utara':
        lat = baseLat + offset;
        break;
      case 'Selatan':
        lat = baseLat - offset;
        break;
      case 'Timur':
        lng = baseLng + offset;
        break;
      case 'Barat':
        lng = baseLng - offset;
        break;
      default:
        break;
    }
    return {
      requestId: amb.requestId,
      label: amb.label,
      lat,
      lng,
      direction: amb.direction,
      patientType: amb.patientType,
      distanceToStopLine: amb.distanceToStopLine,
    };
  });
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

  // Status Jalur Data & Multi-Ambulans (Simulasi)
  const [pipelineStep, setPipelineStep] = useState(0);
  const [activeAmbulances, setActiveAmbulances] = useState([]);
  const [prioritizedAmbulanceId, setPrioritizedAmbulanceId] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [queueOverride, setQueueOverride] = useState('auto'); // 'auto' | 'rendah' | 'sedang' | 'tinggi'
  const [movementLogs, setMovementLogs] = useState([]);
  const ambulanceTimersRef = useRef([]);
  const ambCounterRef = useRef(0);
  const triggeringReqIdRef = useRef(null);

  // Hitung antrean efektif & jarak trigger lampu hijau (50m / 100m / 150m)
  const effectiveQueueCount = useMemo(() => {
    if (queueOverride === 'rendah') return 3;
    if (queueOverride === 'sedang') return 10;
    if (queueOverride === 'tinggi') return 18;
    return queueCount;
  }, [queueCount, queueOverride]);

  const queueDensityInfo = useMemo(
    () => getQueueDensityInfo(effectiveQueueCount),
    [effectiveQueueCount]
  );

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
          setPrioritizedAmbulanceId(null);
          triggeringReqIdRef.current = null;
        }

        return nextState;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [mode, isPaused, simSpeed, addLog]);

  // Jalankan pipeline prioritas FSM untuk ambulans pemenang
  const activatePriorityForAmbulance = useCallback(
    (amb, isPreemption = false) => {
      if (!amb || mode !== 'simulasi') return;
      const dirInfo = DIRECTION_TO_PHASE[amb.direction];
      if (!dirInfo) return;

      ambulanceTimersRef.current.forEach(clearTimeout);
      ambulanceTimersRef.current = [];
      triggeringReqIdRef.current = amb.requestId;
      setPrioritizedAmbulanceId(amb.requestId);

      const patientLabel = amb.patientType === 'darurat' ? 'DARURAT' : 'NON-DARURAT';

      const t1 = setTimeout(() => {
        setPipelineStep(1);
        addLog(
          'SYS',
          `[SIMULASI] ${isPreemption ? 'PREEMPSI: ' : ''}YOLOv8n mendeteksi ${amb.label} (${patientLabel}) dari arah ${amb.direction} di jarak ≤${queueDensityInfo.triggerDistanceMeters}m (request_id=${amb.requestId})`
        );
      }, (SIMULATION_PARAMS.latencies.detection * 1000) / simSpeed);

      const t2 = setTimeout(() => {
        setPipelineStep(2);
        addLog(
          'SYS',
          `[SIMULASI] Menulis permintaan prioritas ke Firebase: /commands/${amb.requestId}`
        );
      }, (SIMULATION_PARAMS.latencies.firebaseWrite * 1000) / simSpeed);

      const t3 = setTimeout(() => {
        setPipelineStep(3);
        addLog(
          'SYS',
          `[SIMULASI] Python Backend memvalidasi: ${amb.label} (${patientLabel}) Arah ${amb.direction} -> Fase ${dirInfo.targetPhase} (Grup ${dirInfo.targetGroup})`
        );
      }, (SIMULATION_PARAMS.latencies.backendValidate * 1000) / simSpeed);

      const t4 = setTimeout(() => {
        setPipelineStep(4);
        addLog(
          'SET_PHASE',
          `[SIMULASI] USB-Serial: {"cmd":"SET_PHASE","phase":"${dirInfo.targetPhase}","id":"${amb.requestId}"}`
        );
      }, (SIMULATION_PARAMS.latencies.serialSend * 1000) / simSpeed);

      const t5 = setTimeout(() => {
        setPipelineStep(5);
        addLog(
          'ACK',
          `[SIMULASI] ESP32 ACK: {"type":"ACK","id":"${amb.requestId}","cmd":"SET_PHASE","message":"PRIORITY_SET"}`
        );
        setFsmState((prev) => triggerEmergencyPriority(prev, amb.direction, amb.requestId));
      }, (SIMULATION_PARAMS.latencies.ackReceive * 1000) / simSpeed);

      ambulanceTimersRef.current = [t1, t2, t3, t4, t5];
    },
    [mode, simSpeed, addLog, queueDensityInfo.triggerDistanceMeters]
  );

  // Arbitrase Multi-Ambulans: Darurat selalu didahulukan di atas Non-Darurat, memicu hijau saat jarak <= threshold antrean
  useEffect(() => {
    if (mode !== 'simulasi' || isPaused) return;

    const triggerMeters = queueDensityInfo.triggerDistanceMeters;
    const eligible = activeAmbulances
      .filter((a) => !a.passed && a.distanceToStopLine <= triggerMeters)
      .sort((a, b) => {
        if (a.priorityLevel !== b.priorityLevel) {
          return a.priorityLevel - b.priorityLevel; // 1 (Darurat) < 2 (Non-Darurat)
        }
        if (Math.abs(a.distanceToStopLine - b.distanceToStopLine) > 2) {
          return a.distanceToStopLine - b.distanceToStopLine;
        }
        return a.createdAt - b.createdAt;
      });

    if (eligible.length === 0) return;

    const winner = eligible[0];
    const currentId = prioritizedAmbulanceId || triggeringReqIdRef.current;

    if (!currentId) {
      activatePriorityForAmbulance(winner, false);
      return;
    }

    if (currentId !== winner.requestId) {
      const currentAmb = activeAmbulances.find((a) => a.requestId === currentId);
      // Preempsi jika ambulans aktif adalah Non-Darurat sementara ada ambulans Darurat masuk zona trigger di fase berbeda
      if (
        currentAmb &&
        !currentAmb.passed &&
        currentAmb.priorityLevel === 2 &&
        winner.priorityLevel === 1 &&
        winner.targetPhase !== currentAmb.targetPhase
      ) {
        addLog(
          'SYS',
          `[SIMULASI] Prioritas dialihkan ke ${winner.label} (DARURAT, ${winner.direction}) mendahului ${currentAmb.label} (NON-DARURAT, ${currentAmb.direction}).`
        );
        activatePriorityForAmbulance(winner, true);
      }
    }
  }, [
    mode,
    isPaused,
    activeAmbulances,
    prioritizedAmbulanceId,
    queueDensityInfo.triggerDistanceMeters,
    activatePriorityForAmbulance,
    addLog,
  ]);

  // Handler Panggil Ambulans (Mendukung Multi-Ambulans & Jenis Pasien)
  const handleCallAmbulance = useCallback(
    (direction, patientType = 'darurat') => {
      if (mode !== 'simulasi') return;
      const alreadyInDirection = activeAmbulances.some(
        (a) => a.direction === direction && !a.passed
      );
      if (alreadyInDirection) return;

      const dirInfo = DIRECTION_TO_PHASE[direction];
      if (!dirInfo) return;

      ambCounterRef.current += 1;
      const label = `AMB-${ambCounterRef.current}`;
      const reqId = `req-${Date.now().toString(36)}-${ambCounterRef.current}`;
      const priorityLevel = patientType === 'darurat' ? 1 : 2;
      const patientLabel = patientType === 'darurat' ? 'DARURAT' : 'NON-DARURAT';

      const newAmb = {
        requestId: reqId,
        label,
        direction,
        patientType,
        priorityLevel,
        targetPhase: dirInfo.targetPhase,
        distanceToStopLine: AMBULANCE_SPAWN_DISTANCE_METERS,
        distanceTraveled: 0,
        currentSpeedKmh: AMBULANCE_SPEED_KMH,
        passed: false,
        createdAt: Date.now(),
      };

      setActiveAmbulances((prev) => [...prev, newAmb]);
      addLog(
        'SYS',
        `[SIMULASI] ${label} (${patientLabel}) meluncur dari arah ${direction} (${AMBULANCE_SPEED_KMH} km/jam, jarak awal ${AMBULANCE_SPAWN_DISTANCE_METERS} m, trigger hijau: ${queueDensityInfo.triggerDistanceMeters} m).`
      );
    },
    [mode, activeAmbulances, addLog, queueDensityInfo.triggerDistanceMeters]
  );

  // Skenario cepat Multi-Ambulans (3 arah sekaligus: Darurat & Non-Darurat)
  const handleSpawnMultiScenario = useCallback(() => {
    if (mode !== 'simulasi') return;
    const scenarioList = [
      { direction: 'Timur', patientType: 'non-darurat' },
      { direction: 'Utara', patientType: 'darurat' },
      { direction: 'Barat', patientType: 'non-darurat' },
    ];

    const toAdd = [];
    scenarioList.forEach((item) => {
      const exists = activeAmbulances.some(
        (a) => a.direction === item.direction && !a.passed
      );
      if (!exists) {
        const dirInfo = DIRECTION_TO_PHASE[item.direction];
        ambCounterRef.current += 1;
        const label = `AMB-${ambCounterRef.current}`;
        const reqId = `req-${Date.now().toString(36)}-${ambCounterRef.current}`;
        toAdd.push({
          requestId: reqId,
          label,
          direction: item.direction,
          patientType: item.patientType,
          priorityLevel: item.patientType === 'darurat' ? 1 : 2,
          targetPhase: dirInfo.targetPhase,
          distanceToStopLine: AMBULANCE_SPAWN_DISTANCE_METERS,
          distanceTraveled: 0,
          currentSpeedKmh: AMBULANCE_SPEED_KMH,
          passed: false,
          createdAt: Date.now() + ambCounterRef.current,
        });
      }
    });

    if (toAdd.length > 0) {
      setActiveAmbulances((prev) => [...prev, ...toAdd]);
      addLog(
        'SYS',
        `[SIMULASI] Skenario Multi-Ambulans aktif (${toAdd.length} unit: ${toAdd
          .map((a) => `${a.label} ${a.direction} [${a.patientType === 'darurat' ? 'DARURAT' : 'NON-DARURAT'}]`)
          .join(', ')}).`
      );
    }
  }, [mode, activeAmbulances, addLog]);

  const handleAmbulancePassed = useCallback(
    (reqId) => {
      let passedAmb = null;
      let hasAnotherSamePhase = false;

      setActiveAmbulances((prev) => {
        passedAmb = prev.find((a) => a.requestId === reqId);
        const updated = prev.map((a) =>
          a.requestId === reqId ? { ...a, passed: true } : a
        );
        if (passedAmb) {
          hasAnotherSamePhase = updated.some(
            (a) =>
              !a.passed &&
              a.requestId !== reqId &&
              a.targetPhase === passedAmb.targetPhase &&
              a.distanceToStopLine <= queueDensityInfo.triggerDistanceMeters
          );
        }
        return updated;
      });

      if (reqId === (prioritizedAmbulanceId || triggeringReqIdRef.current)) {
        if (!hasAnotherSamePhase) {
          addLog(
            'SYS',
            `[SIMULASI] Ambulans prioritas telah melewati pusat persimpangan. Menahan hijau 2 s lalu rilis.`
          );
          setFsmState((prev) => notifyAmbulancePassed(prev));
        }
      }
    },
    [addLog, prioritizedAmbulanceId, queueDensityInfo.triggerDistanceMeters]
  );

  const handleAmbulanceTelemetry = useCallback((telemetryList) => {
    setActiveAmbulances((prev) =>
      prev.map((amb) => {
        const t = telemetryList.find((item) => item.requestId === amb.requestId);
        if (!t) return amb;
        return {
          ...amb,
          distanceToStopLine: t.distanceToStopLine,
          distanceTraveled: t.distanceTraveled,
          currentSpeedKmh: t.currentSpeedKmh,
          passed: t.passed,
        };
      })
    );
  }, []);

  const handleFiveMeterCheckpoint = useCallback((record) => {
    setMovementLogs((prev) => [record, ...prev.slice(0, 199)]);
  }, []);

  const handleAmbulanceExited = useCallback((reqId) => {
    setActiveAmbulances((prev) => prev.filter((a) => a.requestId !== reqId));
  }, []);

  const handleCancelAmbulance = useCallback(
    (reqId = null) => {
      if (reqId) {
        const target = activeAmbulances.find((a) => a.requestId === reqId);
        setActiveAmbulances((prev) => prev.filter((a) => a.requestId !== reqId));
        if (target) {
          addLog(
            'SYS',
            `[SIMULASI] ${target.label} (${target.direction}) dibatalkan (request_id=${reqId}).`
          );
        }
        if (reqId === (prioritizedAmbulanceId || triggeringReqIdRef.current)) {
          ambulanceTimersRef.current.forEach(clearTimeout);
          ambulanceTimersRef.current = [];
          triggeringReqIdRef.current = null;
          setPrioritizedAmbulanceId(null);
          setFsmState((prev) => cancelEmergencyPriority(prev));
          setPipelineStep(0);
        }
        return;
      }

      // Batalkan semua ambulans
      ambulanceTimersRef.current.forEach(clearTimeout);
      ambulanceTimersRef.current = [];
      triggeringReqIdRef.current = null;

      if (activeAmbulances.length > 0) {
        addLog(
          'SYS',
          `[SIMULASI] Semua panggilan ambulans (${activeAmbulances.length} unit) dibatalkan.`
        );
      }

      setFsmState((prev) => cancelEmergencyPriority(prev));
      setActiveAmbulances([]);
      setPrioritizedAmbulanceId(null);
      setPipelineStep(0);
    },
    [activeAmbulances, prioritizedAmbulanceId, addLog]
  );

  const handleResetSimulation = useCallback(() => {
    ambulanceTimersRef.current.forEach(clearTimeout);
    ambulanceTimersRef.current = [];
    triggeringReqIdRef.current = null;
    setActiveAmbulances([]);
    setPrioritizedAmbulanceId(null);
    setPipelineStep(0);
    setMovementLogs([]);
    setQueueCount(0);
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
                activeAmbulances={mode === 'simulasi' ? activeAmbulances : []}
                prioritizedAmbulanceId={mode === 'simulasi' ? prioritizedAmbulanceId : null}
                queueCount={effectiveQueueCount}
                rawQueueCount={queueCount}
                queueDensityInfo={queueDensityInfo}
                queueOverride={queueOverride}
                onQueueOverrideChange={setQueueOverride}
                onQueueCountChange={setQueueCount}
                onCallAmbulance={handleCallAmbulance}
                onSpawnMultiScenario={handleSpawnMultiScenario}
                onCancelAmbulance={handleCancelAmbulance}
                onAmbulancePassed={handleAmbulancePassed}
                onAmbulanceTelemetry={handleAmbulanceTelemetry}
                onFiveMeterCheckpoint={handleFiveMeterCheckpoint}
                onAmbulanceExited={handleAmbulanceExited}
                movementLogs={movementLogs}
                onClearMovementLogs={() => setMovementLogs([])}
                onSpeedChange={(spd) => setSimSpeed(spd)}
                onTogglePause={() => setIsPaused((p) => !p)}
                onReset={handleResetSimulation}
              />
              <MapView
                ambulances={mode === 'simulasi' ? getSimulatedGpsPositions(activeAmbulances) : []}
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
                isPriorityActive={mode === 'simulasi' && activeAmbulances.length > 0 && !!prioritizedAmbulanceId}
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
