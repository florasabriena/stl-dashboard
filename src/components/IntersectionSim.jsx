import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  LAMP_GROUPS,
  TL_HEAD_TO_GROUP,
  DIRECTION_TO_PHASE,
  SIMULATION_PARAMS,
  AMBULANCE_SPEED_KMH,
  PIXELS_PER_METER,
  AMBULANCE_SPAWN_DISTANCE_METERS,
  QUEUE_DENSITY_LEVELS,
  getQueueDensityInfo,
} from '../config/constants.js';
import { getLampColors } from '../lib/fsm.js';

/**
 * IntersectionSim
 * Simulasi grafis persimpangan jalan Rawamangun menggunakan Canvas 2D (rasio 1:1).
 * Karakteristik persimpangan (PRD 6, 8.2, 10):
 * - Utara & Selatan: 2 lajur per arah (lurus dan belok kanan)
 * - Timur & Barat: 1 lajur per arah
 * - Lalu lintas lajur kiri (kiri jalan di Indonesia)
 * - 6 Kepala lampu:
 *     TL1 & TL2 -> Grup TLA
 *     TL5 & TL6 -> Grup TLB
 *     TL3 & TL4 -> Grup TLC
 * - Animasi kendaraan berhenti pada merah/kuning, jalan pada hijau
 * - Panggilan ambulans dengan lampu darurat merah/biru berkedip dan lingkaran berdenyut
 */
export default function IntersectionSim({
  fsmState,
  mode = 'simulasi',
  liveEsp32Status = null,
  simSpeed = 1,
  isPaused = false,
  activeAmbulances = [],
  prioritizedAmbulanceId = null,
  queueCount = 0,
  rawQueueCount = 0,
  queueDensityInfo = QUEUE_DENSITY_LEVELS.RENDAH,
  queueOverride = 'auto',
  onQueueOverrideChange,
  onQueueCountChange,
  onCallAmbulance,
  onSpawnMultiScenario,
  onCancelAmbulance,
  onAmbulancePassed,
  onAmbulanceTelemetry,
  onFiveMeterCheckpoint,
  onAmbulanceExited,
  movementLogs = [],
  onClearMovementLogs,
  onVehiclePassed,
  onSpeedChange,
  onTogglePause,
  onReset,
}) {
  const canvasRef = useRef(null);

  // Status internal kendaraan & multi-ambulans
  const vehiclesRef = useRef([]);
  const lastSpawnTimeRef = useRef(0);
  const ambulancesRef = useRef([]);
  const lastTelemetrySyncRef = useRef(0);
  const lastReportedQueueRef = useRef(-1);
  const [trafficScenario, setTrafficScenario] = useState('Baseline');
  const [selectedPatientType, setSelectedPatientType] = useState('darurat');

  // Sinkronisasi daftar multi-ambulans dari props
  useEffect(() => {
    const activeIds = new Set(activeAmbulances.map((a) => a.requestId));

    // Hapus ambulans yang dibatalkan dari canvas
    ambulancesRef.current = ambulancesRef.current.filter((a) =>
      activeIds.has(a.requestId)
    );

    // Tambahkan ambulans baru yang belum ada di canvas
    const spawnOffsetPx = AMBULANCE_SPAWN_DISTANCE_METERS * PIXELS_PER_METER; // 155m = 232.5px
    for (const ambProp of activeAmbulances) {
      const exists = ambulancesRef.current.some(
        (a) => a.requestId === ambProp.requestId
      );
      if (exists) continue;

      const dir = ambProp.direction;
      let startX = 0, startY = 0, vx = 0, vy = 0, angle = 0, laneId = '';

      if (dir === 'Utara') {
        startX = 310;
        startY = 230 - spawnOffsetPx;
        vx = 0;
        vy = SIMULATION_PARAMS.ambulanceSpeed;
        angle = Math.PI / 2;
        laneId = 'N1';
      } else if (dir === 'Selatan') {
        startX = 390;
        startY = 470 + spawnOffsetPx;
        vx = 0;
        vy = -SIMULATION_PARAMS.ambulanceSpeed;
        angle = -Math.PI / 2;
        laneId = 'S1';
      } else if (dir === 'Timur') {
        startX = 455 + spawnOffsetPx;
        startY = 310;
        vx = -SIMULATION_PARAMS.ambulanceSpeed;
        vy = 0;
        angle = Math.PI;
        laneId = 'E1';
      } else if (dir === 'Barat') {
        startX = 245 - spawnOffsetPx;
        startY = 390;
        vx = SIMULATION_PARAMS.ambulanceSpeed;
        vy = 0;
        angle = 0;
        laneId = 'W1';
      }

      ambulancesRef.current.push({
        id: ambProp.requestId,
        requestId: ambProp.requestId,
        label: ambProp.label || 'AMB',
        direction: dir,
        patientType: ambProp.patientType || 'darurat',
        priorityLevel: ambProp.priorityLevel || 1,
        laneId,
        x: startX,
        y: startY,
        vx,
        vy,
        angle,
        length: 40,
        width: 20,
        inIntersection: false,
        passed: false,
        flashTimer: 0,
        distanceTraveled: 0,
        lastLoggedMeters: 0,
        elapsedSimSeconds: 0,
        lastCheckpointTime: 0,
        currentSpeedKmh: AMBULANCE_SPEED_KMH,
        distanceToStopLine: AMBULANCE_SPAWN_DISTANCE_METERS,
      });
    }
  }, [activeAmbulances]);

  // Handle reset
  const handleReset = useCallback(() => {
    vehiclesRef.current = [];
    ambulancesRef.current = [];
    lastReportedQueueRef.current = -1;
    if (onReset) onReset();
  }, [onReset]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastTimestamp = performance.now();

    const render = (now) => {
      const dt = Math.min((now - lastTimestamp) / 1000, 0.1) * (isPaused ? 0 : simSpeed);
      lastTimestamp = now;

      // Update simulasi kendaraan jika tidak pause
      if (!isPaused && dt > 0) {
        updateSimulation(dt, now);
      }

      // Gambar keseluruhan canvas
      drawScene(ctx);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [fsmState, isPaused, simSpeed, trafficScenario, queueDensityInfo, prioritizedAmbulanceId]);

  // Helper hitung jarak ke garis henti (meter)
  const computeDistanceToStopLineMeters = (amb) => {
    let px = 0;
    if (amb.direction === 'Utara') px = 230 - amb.y;
    else if (amb.direction === 'Selatan') px = amb.y - 470;
    else if (amb.direction === 'Timur') px = amb.x - 455;
    else if (amb.direction === 'Barat') px = 245 - amb.x;
    return Math.max(0, px / PIXELS_PER_METER);
  };

  // Update posisi kendaraan & multi-ambulans
  const updateSimulation = (dt, nowMs = performance.now()) => {
    const currentStateCode =
      mode === 'terhubung'
        ? liveEsp32Status?.state || 'UNKNOWN'
        : fsmState
          ? fsmState.stateCode
          : 'STARTUP_ALL_RED';
    const lampColors = getLampColors(currentStateCode);
    const spawnRate = SIMULATION_PARAMS.spawnRates[trafficScenario] || 0.07;

    // Spawn kendaraan acak
    lastSpawnTimeRef.current += dt;
    if (lastSpawnTimeRef.current >= 1 / spawnRate) {
      lastSpawnTimeRef.current = 0;
      trySpawnVehicle();
    }

    // Update multi-ambulans (kecepatan 40 km/jam = ~16.67 px/s)
    const remainingAmbs = [];
    const exitedIds = [];

    for (const amb of ambulancesRef.current) {
      const flashSpeed = amb.patientType === 'darurat' ? 7 : 3;
      amb.flashTimer = (amb.flashTimer || 0) + dt * flashSpeed;
      amb.elapsedSimSeconds += dt;

      const canAmbMove = checkCanMove(amb, lampColors, true);
      if (canAmbMove) {
        amb.x += amb.vx * dt;
        amb.y += amb.vy * dt;
        const stepPx = SIMULATION_PARAMS.ambulanceSpeed * dt;
        const stepMeters = stepPx / PIXELS_PER_METER;
        amb.distanceTraveled += stepMeters;
        amb.currentSpeedKmh = AMBULANCE_SPEED_KMH;

        // Catat perpindahan waktu setiap 5 meter
        while (amb.distanceTraveled - amb.lastLoggedMeters >= 5) {
          const segStart = amb.lastLoggedMeters;
          const segEnd = segStart + 5;
          const deltaSec = amb.elapsedSimSeconds - amb.lastCheckpointTime;
          amb.lastLoggedMeters = segEnd;
          amb.lastCheckpointTime = amb.elapsedSimSeconds;
          if (onFiveMeterCheckpoint) {
            onFiveMeterCheckpoint({
              id: `${amb.requestId}-${segEnd}`,
              ambulanceLabel: amb.label,
              direction: amb.direction,
              patientType: amb.patientType,
              segmentLabel: `${segStart}–${segEnd} m`,
              distanceFromStopLine: Math.max(
                0,
                Number((AMBULANCE_SPAWN_DISTANCE_METERS - segEnd).toFixed(1))
              ),
              deltaSeconds: Number(deltaSec.toFixed(2)),
              cumulativeSeconds: Number(amb.elapsedSimSeconds.toFixed(2)),
              speedKmh: AMBULANCE_SPEED_KMH,
            });
          }
        }
      } else {
        amb.currentSpeedKmh = 0;
      }

      if (!amb.inIntersection) {
        if (amb.x > 245 && amb.x < 455 && amb.y > 245 && amb.y < 455) {
          amb.inIntersection = true;
        }
      }

      amb.distanceToStopLine = computeDistanceToStopLineMeters(amb);

      // Deteksi saat ambulans melintasi persimpangan
      if (!amb.passed) {
        const hasPassedCenter =
          (amb.direction === 'Utara' && amb.y > 420) ||
          (amb.direction === 'Selatan' && amb.y < 280) ||
          (amb.direction === 'Timur' && amb.x < 280) ||
          (amb.direction === 'Barat' && amb.x > 420);

        if (hasPassedCenter) {
          amb.passed = true;
          if (onAmbulancePassed) {
            onAmbulancePassed(amb.requestId);
          }
        }
      }

      // Despawn ambulans jika keluar batas canvas
      if (amb.x < -80 || amb.x > 780 || amb.y < -80 || amb.y > 780) {
        exitedIds.push(amb.requestId);
      } else {
        remainingAmbs.push(amb);
      }
    }
    ambulancesRef.current = remainingAmbs;

    if (exitedIds.length > 0 && onAmbulanceExited) {
      exitedIds.forEach((id) => onAmbulanceExited(id));
    }

    // Update kendaraan umum
    const updatedVehicles = [];
    const TURN_RADIUS = 42;
    const TURN_RATE = SIMULATION_PARAMS.vehicleSpeed / TURN_RADIUS; // rad/s

    for (const v of vehiclesRef.current) {
      const canMove = checkCanMove(v, lampColors, false);
      if (canMove) {
        if (v.isTurningRight) {
          if (v.turnState === 'approaching') {
            if (v.laneId === 'N2') {
              const dist = v.speed * dt;
              v.y += dist;
              if (v.y >= 268) {
                const excess = v.y - 268;
                v.turnState = 'turning';
                v.turnProgress = excess / TURN_RADIUS;
                v.angle = Math.PI / 2 + v.turnProgress;
                v.x = 226 + TURN_RADIUS * Math.cos(v.turnProgress);
                v.y = 268 + TURN_RADIUS * Math.sin(v.turnProgress);
              }
            } else if (v.laneId === 'S2') {
              const dist = v.speed * dt;
              v.y -= dist;
              if (v.y <= 432) {
                const excess = 432 - v.y;
                v.turnState = 'turning';
                v.turnProgress = excess / TURN_RADIUS;
                v.angle = -Math.PI / 2 + v.turnProgress;
                v.x = 474 - TURN_RADIUS * Math.cos(v.turnProgress);
                v.y = 432 - TURN_RADIUS * Math.sin(v.turnProgress);
              }
            }
          } else if (v.turnState === 'turning') {
            v.turnProgress += TURN_RATE * dt;
            if (v.turnProgress >= Math.PI / 2) {
              const excessAngle = v.turnProgress - Math.PI / 2;
              const excessDist = excessAngle * TURN_RADIUS;
              v.turnProgress = Math.PI / 2;
              v.turnState = 'completed';
              v.isTurningRight = false;
              if (v.laneId === 'N2') {
                v.y = 310;
                v.angle = Math.PI;
                v.x = 226 - excessDist;
              } else if (v.laneId === 'S2') {
                v.y = 390;
                v.angle = 0;
                v.x = 474 + excessDist;
              }
            } else {
              if (v.laneId === 'N2') {
                v.angle = Math.PI / 2 + v.turnProgress;
                v.x = 226 + TURN_RADIUS * Math.cos(v.turnProgress);
                v.y = 268 + TURN_RADIUS * Math.sin(v.turnProgress);
              } else if (v.laneId === 'S2') {
                v.angle = -Math.PI / 2 + v.turnProgress;
                v.x = 474 - TURN_RADIUS * Math.cos(v.turnProgress);
                v.y = 432 - TURN_RADIUS * Math.sin(v.turnProgress);
              }
            }
          }
        } else {
          // Gerakan lurus (termasuk kendaraan lajur belok yang sudah 'completed')
          v.x += Math.cos(v.angle) * v.speed * dt;
          v.y += Math.sin(v.angle) * v.speed * dt;
        }
      }

      // Cek apakah baru masuk intersection
      if (!v.inIntersection) {
        if (v.x > 245 && v.x < 455 && v.y > 245 && v.y < 455) {
          v.inIntersection = true;
          if (onVehiclePassed) onVehiclePassed();
        }
      }

      // Pertahankan kendaraan yang belum keluar layar
      if (v.x >= -60 && v.x <= 760 && v.y >= -60 && v.y <= 760) {
        updatedVehicles.push(v);
      }
    }
    vehiclesRef.current = updatedVehicles;

    // Laporkan jumlah antrean & telemetri multi-ambulans ke dashboard setiap ~150 ms
    if (nowMs - lastTelemetrySyncRef.current >= 150) {
      lastTelemetrySyncRef.current = nowMs;

      const queuedCount = vehiclesRef.current.filter((v) => !v.inIntersection).length;
      if (queuedCount !== lastReportedQueueRef.current) {
        lastReportedQueueRef.current = queuedCount;
        if (onQueueCountChange) onQueueCountChange(queuedCount);
      }

      if (onAmbulanceTelemetry && ambulancesRef.current.length > 0) {
        onAmbulanceTelemetry(
          ambulancesRef.current.map((a) => ({
            requestId: a.requestId,
            distanceToStopLine: Number(a.distanceToStopLine.toFixed(1)),
            distanceTraveled: Number(a.distanceTraveled.toFixed(1)),
            currentSpeedKmh: a.currentSpeedKmh,
            passed: a.passed,
          }))
        );
      }
    }
  };

  // Cek apakah kendaraan / ambulans boleh melaju
  const checkCanMove = (v, lampColors, isAmb) => {
    const stopDistance = 14;

    // 1. Cek batas garis henti lampu merah / kuning
    let isStopSignaled = false;

    if (v.laneId === 'N1') {
      // TL2 (Grup TLA) - Utara lurus
      const col = lampColors.TL2;
      isStopSignaled = (col === 'R' || col === 'Y' || col === 'RY') && v.y < 230 && v.y >= 230 - stopDistance;
    } else if (v.laneId === 'N2') {
      // TL6 (Grup TLB) - Utara belok kanan
      const col = lampColors.TL6;
      isStopSignaled = (col === 'R' || col === 'Y' || col === 'RY') && v.y < 230 && v.y >= 230 - stopDistance;
    } else if (v.laneId === 'S1') {
      // TL1 (Grup TLA) - Selatan lurus
      const col = lampColors.TL1;
      isStopSignaled = (col === 'R' || col === 'Y' || col === 'RY') && v.y > 470 && v.y <= 470 + stopDistance;
    } else if (v.laneId === 'S2') {
      // TL5 (Grup TLB) - Selatan belok kanan
      const col = lampColors.TL5;
      isStopSignaled = (col === 'R' || col === 'Y' || col === 'RY') && v.y > 470 && v.y <= 470 + stopDistance;
    } else if (v.laneId === 'E1') {
      // TL3 (Grup TLC) - Timur
      const col = lampColors.TL3;
      isStopSignaled = (col === 'R' || col === 'Y' || col === 'RY') && v.x > 470 && v.x <= 470 + stopDistance;
    } else if (v.laneId === 'W1') {
      // TL4 (Grup TLC) - Barat
      const col = lampColors.TL4;
      isStopSignaled = (col === 'R' || col === 'Y' || col === 'RY') && v.x < 230 && v.x >= 230 - stopDistance;
    }

    if (isStopSignaled && !v.inIntersection) {
      return false;
    }

    // 2. Cek jarak aman dengan kendaraan di depan
    const minSafeGap = 36;
    const TURN_RADIUS = 42;
    for (const other of vehiclesRef.current) {
      if (other === v) continue;

      // Kasus A: Lajur lurus standar N1, S1, E1, W1
      if (v.laneId === other.laneId) {
        if (v.laneId === 'N1') {
          if (other.y > v.y && other.y - v.y < minSafeGap) return false;
        } else if (v.laneId === 'S1') {
          if (other.y < v.y && v.y - other.y < minSafeGap) return false;
        } else if (v.laneId === 'E1') {
          if (other.x < v.x && v.x - other.x < minSafeGap) return false;
        } else if (v.laneId === 'W1') {
          if (other.x > v.x && other.x - v.x < minSafeGap) return false;
        }
      }

      // Kasus B: Lajur N2 (Utara belok kanan -> ke Barat)
      if (v.laneId === 'N2') {
        if (v.turnState === 'approaching') {
          if (other.laneId === 'N2') {
            if (other.turnState === 'approaching') {
              if (other.y > v.y && other.y - v.y < minSafeGap) return false;
            } else if (other.turnState === 'turning') {
              if (other.y > v.y && other.y - v.y < minSafeGap) return false;
            }
          }
        } else if (v.turnState === 'turning') {
          if (other.laneId === 'N2' && other.turnState === 'turning') {
            if (other.turnProgress > v.turnProgress && (other.turnProgress - v.turnProgress) * TURN_RADIUS < minSafeGap) {
              return false;
            }
          } else if (other.turnState === 'completed' && other.laneId === 'N2') {
            if (other.x < v.x && (v.x - other.x) < minSafeGap) return false;
          }
        } else if (v.turnState === 'completed') {
          // Bergerak lurus ke Barat di y=310 (bisa di belakang sesama N2 atau E1)
          if (Math.abs(other.y - v.y) < 15 && other.x < v.x && (v.x - other.x) < minSafeGap) {
            return false;
          }
        }
      }

      // Kasus C: Lajur S2 (Selatan belok kanan -> ke Timur)
      if (v.laneId === 'S2') {
        if (v.turnState === 'approaching') {
          if (other.laneId === 'S2') {
            if (other.turnState === 'approaching') {
              if (other.y < v.y && v.y - other.y < minSafeGap) return false;
            } else if (other.turnState === 'turning') {
              if (other.y < v.y && v.y - other.y < minSafeGap) return false;
            }
          }
        } else if (v.turnState === 'turning') {
          if (other.laneId === 'S2' && other.turnState === 'turning') {
            if (other.turnProgress > v.turnProgress && (other.turnProgress - v.turnProgress) * TURN_RADIUS < minSafeGap) {
              return false;
            }
          } else if (other.turnState === 'completed' && other.laneId === 'S2') {
            if (other.x > v.x && (other.x - v.x) < minSafeGap) return false;
          }
        } else if (v.turnState === 'completed') {
          // Bergerak lurus ke Timur di y=390 (bisa di belakang sesama S2 atau W1)
          if (Math.abs(other.y - v.y) < 15 && other.x > v.x && (other.x - v.x) < minSafeGap) {
            return false;
          }
        }
      }

      // Kasus D: E1 dan W1 yang mendeteksi mobil belok yang sudah lurus di lajur mereka
      if (v.laneId === 'E1' && other.laneId === 'N2' && other.turnState === 'completed') {
        if (Math.abs(other.y - v.y) < 15 && other.x < v.x && (v.x - other.x) < minSafeGap) {
          return false;
        }
      } else if (v.laneId === 'W1' && other.laneId === 'S2' && other.turnState === 'completed') {
        if (Math.abs(other.y - v.y) < 15 && other.x > v.x && (other.x - v.x) < minSafeGap) {
          return false;
        }
      }
    }

    // Jika kendaraan atau ambulans lain ada di depan pada lajur yang sama
    for (const amb of ambulancesRef.current) {
      if (amb === v || amb.laneId !== v.laneId) continue;
      if (v.laneId === 'N1' || v.laneId === 'N2') {
        if (amb.y > v.y && amb.y - v.y < minSafeGap) return false;
      } else if (v.laneId === 'S1' || v.laneId === 'S2') {
        if (amb.y < v.y && v.y - amb.y < minSafeGap) return false;
      } else if (v.laneId === 'E1') {
        if (amb.x < v.x && v.x - amb.x < minSafeGap) return false;
      } else if (v.laneId === 'W1') {
        if (amb.x > v.x && amb.x - v.x < minSafeGap) return false;
      }
    }

    return true;
  };

  // Spawn kendaraan
  const trySpawnVehicle = () => {
    const lanes = ['N1', 'N2', 'S1', 'S2', 'E1', 'W1'];
    const chosenLane = lanes[Math.floor(Math.random() * lanes.length)];

    // Jangan spawn menumpuk kendaraan yang baru muncul
    for (const v of vehiclesRef.current) {
      if (v.laneId === chosenLane) {
        if (chosenLane === 'N1' || chosenLane === 'N2') {
          if (v.y < 30) return;
        } else if (chosenLane === 'S1' || chosenLane === 'S2') {
          if (v.y > 670) return;
        } else if (chosenLane === 'E1') {
          if (v.x > 670) return;
        } else if (chosenLane === 'W1') {
          if (v.x < 30) return;
        }
      }
    }

    let x = 0, y = 0, angle = 0, isTurningRight = false, turnState = 'none';
    const colors = ['#38BDF8', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#CBD5E1'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    if (chosenLane === 'N1') {
      x = 310; y = -30; angle = Math.PI / 2;
    } else if (chosenLane === 'N2') {
      x = 268; y = -30; angle = Math.PI / 2;
      isTurningRight = true;
      turnState = 'approaching';
    } else if (chosenLane === 'S1') {
      x = 390; y = 730; angle = -Math.PI / 2;
    } else if (chosenLane === 'S2') {
      x = 432; y = 730; angle = -Math.PI / 2;
      isTurningRight = true;
      turnState = 'approaching';
    } else if (chosenLane === 'E1') {
      x = 730; y = 310; angle = Math.PI;
    } else if (chosenLane === 'W1') {
      x = -30; y = 390; angle = 0;
    }

    vehiclesRef.current.push({
      id: Math.random().toString(36).substring(2, 7),
      laneId: chosenLane,
      x,
      y,
      angle,
      speed: SIMULATION_PARAMS.vehicleSpeed,
      color,
      length: 28,
      width: 16,
      inIntersection: false,
      isTurningRight,
      turnState,
      turnProgress: 0,
    });
  };

  // Render Scene Utama pada Canvas
  const drawScene = (ctx) => {
    const W = 700;
    const H = 700;
    ctx.clearRect(0, 0, W, H);

    // 1. Latar Belakang (Tanah/Trotoar)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, W, H);

    // 2. Garis Jalan Aspal
    ctx.fillStyle = '#1E293B';
    // Jalan Vertikal (Utara-Selatan: 2 lajur U-S = 4 lajur total ~ 180px)
    ctx.fillRect(245, 0, 210, H);
    // Jalan Horizontal (Timur-Barat: 1 lajur T-B = 2 lajur total ~ 110px)
    ctx.fillRect(0, 260, W, 180);

    // 3. Marka Jalan
    drawRoadMarkings(ctx, W, H);

    // 4. Zebra Cross (Pedestrian Crossings)
    drawZebraCrossings(ctx);

    // 4b. Penanda Zona Jarak Trigger Ambulans (50m, 100m, 150m)
    drawDistanceMarkers(ctx);

    // 5. Kepala Lampu TL1 - TL6
    const currentStateCode =
      mode === 'terhubung'
        ? liveEsp32Status?.state || 'UNKNOWN'
        : fsmState
          ? fsmState.stateCode
          : 'STARTUP_ALL_RED';
    const lampColors = getLampColors(currentStateCode);
    drawTrafficLights(ctx, lampColors);

    // 6. Gambar Kendaraan Umum
    for (const v of vehiclesRef.current) {
      drawCar(ctx, v);
    }

    // 7. Gambar Multi-Ambulans (jika aktif)
    for (const amb of ambulancesRef.current) {
      drawAmbulance(ctx, amb);
    }
  };

  // Gambar Garis Zona Jarak Trigger Lampu Hijau Ambulans (50m, 100m, 150m)
  const drawDistanceMarkers = (ctx) => {
    const activeMeters = queueDensityInfo?.triggerDistanceMeters || 50;
    const markers = [
      { meters: 50, color: '#22C55E' },
      { meters: 100, color: '#F59E0B' },
      { meters: 150, color: '#EF4444' },
    ];

    ctx.save();
    ctx.font = 'bold 9px monospace';

    for (const m of markers) {
      const offset = m.meters * PIXELS_PER_METER;
      const isActive = m.meters === activeMeters;
      ctx.strokeStyle = isActive ? m.color : 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.setLineDash(isActive ? [6, 4] : [3, 5]);

      // Utara (y = 230 - offset)
      const yN = 230 - offset;
      if (yN > 2) {
        ctx.beginPath();
        ctx.moveTo(245, yN);
        ctx.lineTo(348, yN);
        ctx.stroke();
        ctx.fillStyle = isActive ? m.color : 'rgba(148, 163, 184, 0.55)';
        ctx.textAlign = 'right';
        ctx.fillText(`${m.meters}m${isActive ? ' ★' : ''}`, 240, yN + 3);
      }

      // Selatan (y = 470 + offset)
      const yS = 470 + offset;
      if (yS < 698) {
        ctx.beginPath();
        ctx.moveTo(352, yS);
        ctx.lineTo(455, yS);
        ctx.stroke();
        ctx.fillStyle = isActive ? m.color : 'rgba(148, 163, 184, 0.55)';
        ctx.textAlign = 'left';
        ctx.fillText(`${m.meters}m${isActive ? ' ★' : ''}`, 460, yS + 3);
      }

      // Barat (x = 245 - offset)
      const xW = 245 - offset;
      if (xW > 2) {
        ctx.beginPath();
        ctx.moveTo(xW, 352);
        ctx.lineTo(xW, 440);
        ctx.stroke();
        ctx.fillStyle = isActive ? m.color : 'rgba(148, 163, 184, 0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(`${m.meters}m`, xW, 453);
      }

      // Timur (x = 455 + offset)
      const xE = 455 + offset;
      if (xE < 698) {
        ctx.beginPath();
        ctx.moveTo(xE, 260);
        ctx.lineTo(xE, 348);
        ctx.stroke();
        ctx.fillStyle = isActive ? m.color : 'rgba(148, 163, 184, 0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(`${m.meters}m`, xE, 254);
      }
    }

    ctx.restore();
  };

  // Gambar Marka Jalan
  const drawRoadMarkings = (ctx, W, H) => {
    ctx.save();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);

    // Garis putus-putus pembagi lajur vertikal (N1 vs N2, S1 vs S2)
    ctx.beginPath();
    // Utara: pembagi lajur lurus & belok kanan (x=297)
    ctx.moveTo(297, 0); ctx.lineTo(297, 230);
    // Selatan: pembagi lajur lurus & belok kanan (x=402)
    ctx.moveTo(402, 470); ctx.lineTo(402, H);
    ctx.stroke();

    // Garis tengah kuning ganda (pemisah arus berlawanan)
    ctx.setLineDash([]);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;

    // Utara-Selatan pemisah tengah (x=350)
    ctx.beginPath();
    ctx.moveTo(348, 0); ctx.lineTo(348, 230);
    ctx.moveTo(352, 0); ctx.lineTo(352, 230);
    ctx.moveTo(348, 470); ctx.lineTo(348, H);
    ctx.moveTo(352, 470); ctx.lineTo(352, H);
    // Timur-Barat pemisah tengah (y=350)
    ctx.moveTo(0, 348); ctx.lineTo(245, 348);
    ctx.moveTo(0, 352); ctx.lineTo(245, 352);
    ctx.moveTo(455, 348); ctx.lineTo(W, 348);
    ctx.moveTo(455, 352); ctx.lineTo(W, 352);
    ctx.stroke();

    // Garis henti putih solid (Stop Lines)
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Utara stop line (y=230, x=245..348)
    ctx.moveTo(245, 230); ctx.lineTo(348, 230);
    // Selatan stop line (y=470, x=352..455)
    ctx.moveTo(352, 470); ctx.lineTo(455, 470);
    // Barat stop line (x=245, y=352..440)
    ctx.moveTo(245, 352); ctx.lineTo(245, 440);
    // Timur stop line (x=455, y=260..348)
    ctx.moveTo(455, 260); ctx.lineTo(455, 348);
    ctx.stroke();

    ctx.restore();
  };

  // Zebra Cross
  const drawZebraCrossings = (ctx) => {
    ctx.save();
    ctx.fillStyle = '#CBD5E1';
    // Utara zebra
    for (let x = 250; x < 450; x += 16) {
      ctx.fillRect(x, 234, 10, 18);
    }
    // Selatan zebra
    for (let x = 250; x < 450; x += 16) {
      ctx.fillRect(x, 448, 10, 18);
    }
    // Barat zebra
    for (let y = 265; y < 435; y += 16) {
      ctx.fillRect(223, y, 18, 10);
    }
    // Timur zebra
    for (let y = 265; y < 435; y += 16) {
      ctx.fillRect(459, y, 18, 10);
    }
    ctx.restore();
  };

  // Gambar 6 Kepala Lampu TL1 - TL6
  const drawTrafficLights = (ctx, lampColors) => {
    // TL1: Selatan lurus (Grup TLA)
    drawSingleLightPost(ctx, 460, 485, 'TL1 [A]', lampColors.TL1);
    // TL2: Utara lurus (Grup TLA)
    drawSingleLightPost(ctx, 235, 215, 'TL2 [A]', lampColors.TL2);
    // TL3: Timur (Grup TLC)
    drawSingleLightPost(ctx, 470, 245, 'TL3 [C]', lampColors.TL3);
    // TL4: Barat (Grup TLC)
    drawSingleLightPost(ctx, 225, 455, 'TL4 [C]', lampColors.TL4);
    // TL5: Selatan belok kanan (Grup TLB)
    drawSingleLightPost(ctx, 460, 520, 'TL5 [B]', lampColors.TL5);
    // TL6: Utara belok kanan (Grup TLB)
    drawSingleLightPost(ctx, 235, 180, 'TL6 [B]', lampColors.TL6);
  };

  // Gambar satu tiang lampu lalu lintas dengan lensa R, Y, G
  const drawSingleLightPost = (ctx, x, y, label, colorCode) => {
    ctx.save();
    // Kotak fisik lampu
    ctx.fillStyle = '#090D16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fillRect(x - 9, y - 18, 18, 36);
    ctx.strokeRect(x - 9, y - 18, 18, 36);

    const isRed = colorCode === 'R' || colorCode === 'RY';
    const isYellow = colorCode === 'Y' || colorCode === 'RY';
    const isGreen = colorCode === 'G';

    // Merah (atas)
    drawLens(ctx, x, y - 11, isRed ? '#EF4444' : '#450a0a', isRed);
    // Kuning (tengah)
    drawLens(ctx, x, y, isYellow ? '#FBBF24' : '#451a03', isYellow);
    // Hijau (bawah)
    drawLens(ctx, x, y + 11, isGreen ? '#22C55E' : '#052e16', isGreen);

    // Label teks
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 27);
    ctx.restore();
  };

  const drawLens = (ctx, x, y, fill, glow) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    if (glow) {
      ctx.shadowColor = fill;
      ctx.shadowBlur = 8;
    }
    ctx.fill();
    ctx.restore();
  };

  // Gambar Mobil Biasa
  const drawCar = (ctx, car) => {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Body
    ctx.fillStyle = car.color;
    ctx.fillRect(-car.length / 2, -car.width / 2, car.length, car.width);

    // Windshield
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-car.length / 4, -car.width / 2 + 2, 7, car.width - 4);
    ctx.fillRect(car.length / 8, -car.width / 2 + 2, 4, car.width - 4);

    // Headlights
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(car.length / 2 - 2, -car.width / 2 + 1, 2, 3);
    ctx.fillRect(car.length / 2 - 2, car.width / 2 - 4, 2, 3);

    // Taillights
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-car.length / 2, -car.width / 2 + 1, 2, 3);
    ctx.fillRect(-car.length / 2, car.width / 2 - 4, 2, 3);

    ctx.restore();
  };

  // Gambar Ambulans (membedakan pasien Darurat vs Non-Darurat)
  const drawAmbulance = (ctx, amb) => {
    const isDarurat = amb.patientType !== 'non-darurat';
    const isPrioritized = amb.requestId === prioritizedAmbulanceId;

    ctx.save();
    ctx.translate(amb.x, amb.y);
    ctx.rotate(amb.angle);

    // Lingkaran Peringatan Berdenyut
    const pulseRadius = (isDarurat ? 30 : 24) + (Math.sin(amb.flashTimer * 2) + 1) * 5;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isDarurat
      ? isPrioritized
        ? 'rgba(239, 68, 68, 0.65)'
        : 'rgba(239, 68, 68, 0.35)'
      : 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = isPrioritized ? 2.5 : 1.5;
    ctx.stroke();

    // Body Putih Ambulans
    ctx.fillStyle = isDarurat ? '#FFFFFF' : '#FEF3C7';
    ctx.strokeStyle = isDarurat ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-amb.length / 2, -amb.width / 2, amb.length, amb.width);
    ctx.strokeRect(-amb.length / 2, -amb.width / 2, amb.length, amb.width);

    // Palang Medis di Atap
    ctx.fillStyle = isDarurat ? '#EF4444' : '#D97706';
    ctx.fillRect(-3, -6, 6, 12);
    ctx.fillRect(-6, -3, 12, 6);

    // Kaca Depan & Belakang
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(amb.length / 2 - 9, -amb.width / 2 + 2, 5, amb.width - 4);
    ctx.fillRect(-amb.length / 2 + 2, -amb.width / 2 + 2, 3, amb.width - 4);

    // Lampu Bar Darurat
    const isRedFlash = Math.floor(amb.flashTimer) % 2 === 0;
    if (isDarurat) {
      ctx.fillStyle = isRedFlash ? '#EF4444' : '#3B82F6';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(-1, -amb.width / 2 - 2, 4, 3);
      ctx.fillStyle = !isRedFlash ? '#EF4444' : '#3B82F6';
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(-1, amb.width / 2 - 1, 4, 3);
    } else {
      ctx.fillStyle = isRedFlash ? '#F59E0B' : '#94A3B8';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 6;
      ctx.fillRect(-1, -amb.width / 2 - 2, 4, 3);
      ctx.fillRect(-1, amb.width / 2 - 1, 4, 3);
    }

    ctx.restore();

    // Label Ambulans Floating
    ctx.save();
    ctx.fillStyle = isDarurat ? '#EF4444' : '#F59E0B';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    const distText = amb.passed ? 'LEWAT' : `${Math.round(amb.distanceToStopLine)}m`;
    ctx.fillText(
      `🚑 ${amb.label} (${isDarurat ? 'DARURAT' : 'NON-DARURAT'}) · ${distText}`,
      amb.x,
      amb.y - 26
    );
    ctx.restore();
  };

  return (
    <div className="rounded-xl border border-border-line bg-surface p-4 shadow-xs flex flex-col">
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-3 border-b border-border-line pb-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Simulasi Canvas Persimpangan Rawamangun
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Lalu lintas lajur kiri · 6 Kepala TL (TLA, TLB, TLC) · 60 FPS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeAmbulances.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error text-white animate-pulse">
              {activeAmbulances.length} AMBULANS AKTIF (simulasi)
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-surface-2 text-text-muted">
            {AMBULANCE_SPEED_KMH} km/jam · 700×700 px
          </span>
        </div>
      </div>

      {/* Canvas Element 1:1 Aspect Ratio */}
      <div className="relative w-full aspect-square max-w-[700px] mx-auto rounded-lg bg-surface-2 border border-border-line overflow-hidden shadow-inner flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={700}
          height={700}
          className="w-full h-full block"
        />
      </div>

      {/* Kontrol Simulasi & Tombol Arah Ambulans */}
      <div className="mt-4 pt-3 border-t border-border-line flex flex-col gap-3">
        {/* Kontrol Kecepatan, Jeda, Skenario */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[11px] font-medium">Kecepatan:</span>
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpeedChange && onSpeedChange(spd)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${simSpeed === spd
                    ? 'bg-accent text-surface shadow-xs'
                    : 'bg-surface-2 text-text-muted hover:text-text-main'
                  }`}
              >
                {spd}×
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-text-muted text-[11px]">Beban:</label>
            <select
              value={trafficScenario}
              onChange={(e) => setTrafficScenario(e.target.value)}
              className="text-xs rounded-md bg-surface-2 border border-border-line px-2 py-1 text-text-main outline-hidden"
            >
              <option value="Baseline">Baseline</option>
              <option value="Pagi">Pagi (Padat)</option>
              <option value="Siang">Siang</option>
              <option value="Sore">Sore (Padat)</option>
            </select>
            <button
              type="button"
              onClick={onTogglePause}
              className="px-3 py-1 rounded-lg bg-surface-2 text-text-main text-xs font-semibold hover:bg-surface-2/80 transition-colors"
            >
              {isPaused ? '▶ Lanjut' : '⏸ Jeda'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1 rounded-lg bg-surface-2 text-text-muted text-xs font-semibold hover:text-text-main transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Panel Status Antrean & Jarak Trigger Lampu Hijau (50m / 100m / 150m) */}
        {mode === 'simulasi' && (
          <div className="rounded-lg bg-surface-2 p-3 border border-border-line flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-text-main">
                  Kepadatan Antrean:
                </span>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full text-slate-950"
                  style={{ backgroundColor: queueDensityInfo.color }}
                >
                  {queueDensityInfo.label.toUpperCase()} ({queueCount} kend.)
                </span>
                <span className="text-[11px] font-mono font-bold text-accent">
                  → Lampu Hijau di {queueDensityInfo.triggerDistanceMeters} m
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <label className="text-text-muted">Deteksi Antrean:</label>
                <select
                  value={queueOverride}
                  onChange={(e) => onQueueOverrideChange && onQueueOverrideChange(e.target.value)}
                  className="text-[11px] rounded-md bg-surface border border-border-line px-2 py-0.5 text-text-main outline-hidden"
                >
                  <option value="auto">Otomatis ({rawQueueCount} di canvas)</option>
                  <option value="rendah">Simulasi Rendah (≤ 5 · 50 m)</option>
                  <option value="sedang">Simulasi Sedang (≤ 15 · 100 m)</option>
                  <option value="tinggi">Simulasi Tinggi (&gt; 15 · 150 m)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {[
                { key: 'rendah', label: 'Rendah (≤ 5)', dist: '50 m', color: 'border-success/50 text-success bg-success/10' },
                { key: 'sedang', label: 'Sedang (≤ 15)', dist: '100 m', color: 'border-warning/50 text-warning bg-warning/10' },
                { key: 'tinggi', label: 'Tinggi (> 15)', dist: '150 m', color: 'border-error/50 text-error bg-error/10' },
              ].map((tier) => {
                const isActive = queueDensityInfo.id === tier.key;
                return (
                  <div
                    key={tier.key}
                    className={`px-2 py-1 rounded border text-center font-medium transition-all ${
                      isActive ? `${tier.color} font-bold ring-1 ring-current` : 'border-border-line bg-surface text-text-muted opacity-70'
                    }`}
                  >
                    {tier.label} → Hijau {tier.dist}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel Multi-Ambulans & Prioritas Pasien (Hanya Mode Simulasi) */}
        {mode === 'simulasi' && (
          <div className="rounded-lg bg-surface-2 p-3 border border-border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <span>🚑</span> Skenario Multi-Ambulans (simulasi · {AMBULANCE_SPEED_KMH} km/jam)
              </span>
              <button
                type="button"
                onClick={onSpawnMultiScenario}
                className="px-2.5 py-1 rounded-md bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 text-[11px] font-bold transition-colors cursor-pointer"
              >
                ⚡ Simulasi Multi-Ambulans (3 Arah)
              </button>
            </div>

            {/* Pilihan Jenis Pasien */}
            <div className="flex flex-wrap items-center gap-2 mb-2.5 text-xs">
              <span className="text-[11px] text-text-muted font-medium">Jenis Pasien:</span>
              <button
                type="button"
                onClick={() => setSelectedPatientType('darurat')}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                  selectedPatientType === 'darurat'
                    ? 'bg-error text-white border-error shadow-xs'
                    : 'bg-surface border-border-line text-text-muted hover:text-text-main'
                }`}
              >
                🚨 Darurat (Prioritas Utama)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPatientType('non-darurat')}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                  selectedPatientType === 'non-darurat'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                    : 'bg-surface border-border-line text-text-muted hover:text-text-main'
                }`}
              >
                🏥 Non-Darurat (Sekunder)
              </button>
            </div>

            {/* Tombol Arah Kedatangan (Bisa panggil > 1 ambulans dari arah berbeda) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {['Utara', 'Selatan', 'Timur', 'Barat'].map((dir) => {
                const info = DIRECTION_TO_PHASE[dir];
                const activeInDir = activeAmbulances.find(
                  (a) => a.direction === dir && !a.passed
                );

                return (
                  <button
                    key={dir}
                    type="button"
                    disabled={!!activeInDir}
                    onClick={() =>
                      onCallAmbulance && onCallAmbulance(dir, selectedPatientType)
                    }
                    className={`p-2 rounded-lg border text-center transition-all ${
                      activeInDir
                        ? activeInDir.patientType === 'darurat'
                          ? 'border-error bg-error/20 text-error font-bold cursor-not-allowed'
                          : 'border-amber-500 bg-amber-500/20 text-amber-400 font-bold cursor-not-allowed'
                        : 'border-border-line bg-surface hover:border-accent hover:text-accent font-medium cursor-pointer'
                    }`}
                  >
                    <div className="font-bold">{dir}</div>
                    <div className="text-[10px] text-text-muted truncate">
                      {activeInDir
                        ? `${activeInDir.label} (${activeInDir.patientType === 'darurat' ? 'Darurat' : 'Non-Darurat'})`
                        : `${info.lane} → Fase ${info.targetPhase}`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Daftar Ambulans Aktif & Status Prioritas */}
            {activeAmbulances.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-border-line flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="font-bold text-text-main">
                    Ambulans Aktif ({activeAmbulances.length} unit)
                  </span>
                  <button
                    type="button"
                    onClick={() => onCancelAmbulance && onCancelAmbulance(null)}
                    className="px-2 py-0.5 rounded bg-error/10 border border-error/40 text-error hover:bg-error/20 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Batalkan Semua
                  </button>
                </div>

                {activeAmbulances.map((amb) => {
                  const isDarurat = amb.patientType === 'darurat';
                  const isPrioritized = amb.requestId === prioritizedAmbulanceId;
                  return (
                    <div
                      key={amb.requestId}
                      className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-[11px] ${
                        isPrioritized
                          ? 'border-error/60 bg-error/10'
                          : 'border-border-line bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-text-main">
                          {amb.label}
                        </span>
                        <span className="text-text-muted">· {amb.direction}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isDarurat
                              ? 'bg-error text-white'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}
                        >
                          {isDarurat ? 'DARURAT' : 'NON-DARURAT'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            amb.passed
                              ? 'bg-success/20 text-success'
                              : isPrioritized
                                ? 'bg-accent/20 text-accent animate-pulse'
                                : 'bg-surface-2 text-text-muted'
                          }`}
                        >
                          {amb.passed
                            ? 'MELINTAS'
                            : isPrioritized
                              ? 'DIPRIORITASKAN'
                              : 'MENUNGGU'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-text-muted">
                          Sisa: <strong className="text-text-main">{amb.distanceToStopLine.toFixed(1)} m</strong>
                        </span>
                        <span className="text-text-muted">
                          <strong className="text-accent">{amb.currentSpeedKmh} km/jam</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => onCancelAmbulance && onCancelAmbulance(amb.requestId)}
                          className="text-error hover:underline font-sans font-semibold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tabel Catatan Pergerakan Ambulans per 5 Meter (40 km/jam) */}
        {mode === 'simulasi' && (
          <div className="rounded-lg bg-surface-2 p-3 border border-border-line">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-text-main">
                  ⏱️ Catatan Waktu Perpindahan Ambulans (per 5 Meter)
                </span>
                <p className="text-[10px] text-text-muted">
                  Kecepatan target {AMBULANCE_SPEED_KMH} km/jam (11,11 m/s · ideal 0,45 dtk per 5 m)
                </p>
              </div>
              {movementLogs.length > 0 && onClearMovementLogs && (
                <button
                  type="button"
                  onClick={onClearMovementLogs}
                  className="text-[10px] text-text-muted hover:text-text-main px-2 py-0.5 rounded bg-surface border border-border-line cursor-pointer"
                >
                  Bersihkan
                </button>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto rounded border border-border-line bg-surface">
              {movementLogs.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-4">
                  Belum ada catatan pergerakan. Panggil ambulans untuk merekam waktu perpindahan tiap 5 meter.
                </div>
              ) : (
                <table className="w-full text-left font-mono text-[10.5px] border-collapse">
                  <thead className="sticky top-0 bg-surface-2 text-text-muted border-b border-border-line">
                    <tr>
                      <th className="py-1.5 px-2">Unit</th>
                      <th className="py-1.5 px-2">Segmen</th>
                      <th className="py-1.5 px-2">Sisa Garis Henti</th>
                      <th className="py-1.5 px-2">Waktu / 5m</th>
                      <th className="py-1.5 px-2">Kumulatif</th>
                      <th className="py-1.5 px-2">Kecepatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementLogs.map((row) => (
                      <tr key={row.id} className="border-b border-border-line/50 last:border-0">
                        <td className="py-1 px-2 font-bold text-text-main">
                          {row.ambulanceLabel} ({row.direction[0]} ·{' '}
                          <span className={row.patientType === 'darurat' ? 'text-error' : 'text-amber-400'}>
                            {row.patientType === 'darurat' ? 'DRT' : 'NON'}
                          </span>
                          )
                        </td>
                        <td className="py-1 px-2 text-accent">{row.segmentLabel}</td>
                        <td className="py-1 px-2 text-text-muted">{row.distanceFromStopLine} m</td>
                        <td className="py-1 px-2 font-bold text-success">{row.deltaSeconds.toFixed(2)} dtk</td>
                        <td className="py-1 px-2 text-text-muted">{row.cumulativeSeconds.toFixed(2)} dtk</td>
                        <td className="py-1 px-2 text-text-main">{row.speedKmh} km/jam</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
