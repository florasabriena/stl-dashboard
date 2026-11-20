import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  LAMP_GROUPS,
  TL_HEAD_TO_GROUP,
  DIRECTION_TO_PHASE,
  SIMULATION_PARAMS,
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
  simSpeed = 1,
  isPaused = false,
  activeAmbulance = null,
  onCallAmbulance,
  onCancelAmbulance,
  onAmbulancePassed,
  onVehiclePassed,
  onSpeedChange,
  onTogglePause,
  onReset,
}) {
  const canvasRef = useRef(null);

  // Status internal kendaraan
  const vehiclesRef = useRef([]);
  const lastSpawnTimeRef = useRef(0);
  const ambulanceRef = useRef(null);
  const [trafficScenario, setTrafficScenario] = useState('Baseline');

  // Sinkronisasi ambulans dari props
  useEffect(() => {
    if (activeAmbulance && !ambulanceRef.current) {
      // Buat objek ambulans baru di awal lajur arah kedatangan
      const dir = activeAmbulance.direction;
      let startX = 0, startY = 0, vx = 0, vy = 0, angle = 0, laneId = '';

      if (dir === 'Utara') {
        // TL2 (lurus)
        startX = 310;
        startY = -40;
        vx = 0;
        vy = SIMULATION_PARAMS.ambulanceSpeed;
        angle = Math.PI / 2;
        laneId = 'N1';
      } else if (dir === 'Selatan') {
        // TL1 (lurus)
        startX = 390;
        startY = 740;
        vx = 0;
        vy = -SIMULATION_PARAMS.ambulanceSpeed;
        angle = -Math.PI / 2;
        laneId = 'S1';
      } else if (dir === 'Timur') {
        // TL3
        startX = 740;
        startY = 310;
        vx = -SIMULATION_PARAMS.ambulanceSpeed;
        vy = 0;
        angle = Math.PI;
        laneId = 'E1';
      } else if (dir === 'Barat') {
        // TL4
        startX = -40;
        startY = 390;
        vx = SIMULATION_PARAMS.ambulanceSpeed;
        vy = 0;
        angle = 0;
        laneId = 'W1';
      }

      ambulanceRef.current = {
        id: 'ambulance',
        direction: dir,
        laneId,
        x: startX,
        y: startY,
        vx,
        vy,
        angle,
        length: 44,
        width: 22,
        passed: false,
        flashTimer: 0,
        requestId: activeAmbulance.requestId,
      };
    } else if (!activeAmbulance && ambulanceRef.current) {
      ambulanceRef.current = null;
    }
  }, [activeAmbulance]);

  // Handle reset
  const handleReset = useCallback(() => {
    vehiclesRef.current = [];
    ambulanceRef.current = null;
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
        updateSimulation(dt);
      }

      // Gambar keseluruhan canvas
      drawScene(ctx);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [fsmState, isPaused, simSpeed, trafficScenario]);

  // Update posisi kendaraan & ambulans
  const updateSimulation = (dt) => {
    const lampColors = getLampColors(fsmState ? fsmState.stateCode : 'STARTUP_ALL_RED');
    const spawnRate = SIMULATION_PARAMS.spawnRates[trafficScenario] || 0.07;

    // Spawn kendaraan acak
    lastSpawnTimeRef.current += dt;
    if (lastSpawnTimeRef.current >= 1 / spawnRate) {
      lastSpawnTimeRef.current = 0;
      trySpawnVehicle();
    }

    // Update ambulans
    const amb = ambulanceRef.current;
    if (amb) {
      amb.flashTimer = (amb.flashTimer || 0) + dt * 6; // Frekuensi kedip lampu darurat

      // Cek apakah ambulans bisa jalan melewati lampu
      // Ambulans diprioritaskan: jika mendekati stop line, lampu hijau ditahan oleh FSM
      const canAmbMove = checkCanMove(amb, lampColors, true);
      if (canAmbMove) {
        amb.x += amb.vx * dt;
        amb.y += amb.vy * dt;
      }

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
        ambulanceRef.current = null;
      }
    }

    // Update kendaraan umum
    const updatedVehicles = [];
    for (const v of vehiclesRef.current) {
      const canMove = checkCanMove(v, lampColors, false);
      if (canMove) {
        // Gerakan belok atau lurus
        if (v.isTurningRight && v.inIntersection) {
          v.angle += v.turnSpeed * dt;
          v.x += Math.cos(v.angle) * v.speed * dt;
          v.y += Math.sin(v.angle) * v.speed * dt;
        } else {
          v.x += Math.cos(v.angle) * v.speed * dt;
          v.y += Math.sin(v.angle) * v.speed * dt;
        }
      }

      // Cek apakah baru masuk intersection
      if (!v.inIntersection) {
        if (v.x > 250 && v.x < 450 && v.y > 250 && v.y < 450) {
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

    // 2. Cek jarak aman dengan kendaraan di depan pada lajur yang sama
    const minSafeGap = 36;
    for (const other of vehiclesRef.current) {
      if (other === v || other.laneId !== v.laneId) continue;

      if (v.laneId === 'N1' || v.laneId === 'N2') {
        if (other.y > v.y && other.y - v.y < minSafeGap) return false;
      } else if (v.laneId === 'S1' || v.laneId === 'S2') {
        if (other.y < v.y && v.y - other.y < minSafeGap) return false;
      } else if (v.laneId === 'E1') {
        if (other.x < v.x && v.x - other.x < minSafeGap) return false;
      } else if (v.laneId === 'W1') {
        if (other.x > v.x && other.x - v.x < minSafeGap) return false;
      }
    }

    // Jika kendaraan ada di belakang ambulans
    const amb = ambulanceRef.current;
    if (!isAmb && amb && amb.laneId === v.laneId) {
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

    let x = 0, y = 0, angle = 0, isTurningRight = false, turnSpeed = 0;
    const colors = ['#38BDF8', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#CBD5E1'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    if (chosenLane === 'N1') {
      x = 310; y = -30; angle = Math.PI / 2;
    } else if (chosenLane === 'N2') {
      x = 268; y = -30; angle = Math.PI / 2; isTurningRight = true; turnSpeed = 1.2;
    } else if (chosenLane === 'S1') {
      x = 390; y = 730; angle = -Math.PI / 2;
    } else if (chosenLane === 'S2') {
      x = 432; y = 730; angle = -Math.PI / 2; isTurningRight = true; turnSpeed = 1.2;
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
      turnSpeed,
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

    // 5. Kepala Lampu TL1 - TL6
    const lampColors = getLampColors(fsmState ? fsmState.stateCode : 'STARTUP_ALL_RED');
    drawTrafficLights(ctx, lampColors);

    // 6. Gambar Kendaraan Umum
    for (const v of vehiclesRef.current) {
      drawCar(ctx, v);
    }

    // 7. Gambar Ambulans (jika aktif)
    if (ambulanceRef.current) {
      drawAmbulance(ctx, ambulanceRef.current);
    }
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

  // Gambar Ambulans
  const drawAmbulance = (ctx, amb) => {
    ctx.save();
    ctx.translate(amb.x, amb.y);
    ctx.rotate(amb.angle);

    // Lingkaran Peringatan Berdenyut (Simulasi Prioritas)
    const pulseRadius = 32 + (Math.sin(amb.flashTimer * 2) + 1) * 6;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Body Putih Ambulans
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.fillRect(-amb.length / 2, -amb.width / 2, amb.length, amb.width);
    ctx.strokeRect(-amb.length / 2, -amb.width / 2, amb.length, amb.width);

    // Palang Merah di Atap
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-3, -7, 6, 14);
    ctx.fillRect(-7, -3, 14, 6);

    // Kaca Depan & Belakang
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(amb.length / 2 - 10, -amb.width / 2 + 2, 6, amb.width - 4);
    ctx.fillRect(-amb.length / 2 + 2, -amb.width / 2 + 2, 3, amb.width - 4);

    // Lampu Bar Darurat (Merah & Biru bergantian kedip)
    const isRedFlash = Math.floor(amb.flashTimer) % 2 === 0;
    ctx.fillStyle = isRedFlash ? '#EF4444' : '#3B82F6';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(-1, -amb.width / 2 - 2, 4, 3);
    ctx.fillStyle = !isRedFlash ? '#EF4444' : '#3B82F6';
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(-1, amb.width / 2 - 1, 4, 3);

    ctx.restore();

    // Label Ambulans Floating
    ctx.save();
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚑 AMBULANS (simulasi)', amb.x, amb.y - 28);
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
          {activeAmbulance && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error text-white animate-pulse">
              PRIORITAS AKTIF (simulasi)
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-surface-2 text-text-muted">
            700×700 px
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
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  simSpeed === spd
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

        {/* Tombol Panggil Ambulans dari 4 Arah (Hanya Mode Simulasi) */}
        <div className="rounded-lg bg-surface-2 p-3 border border-border-line">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <span>🚑</span> Panggil Ambulans (simulasi)
            </span>
            <span className="text-[10px] text-text-muted">
              Pilih ARAH kedatangan ambulans
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {['Utara', 'Selatan', 'Timur', 'Barat'].map((dir) => {
              const info = DIRECTION_TO_PHASE[dir];
              const isCurrentActive = activeAmbulance && activeAmbulance.direction === dir;

              return (
                <button
                  key={dir}
                  type="button"
                  disabled={!!activeAmbulance}
                  onClick={() => onCallAmbulance && onCallAmbulance(dir)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isCurrentActive
                      ? 'border-error bg-error text-white font-bold'
                      : activeAmbulance
                      ? 'border-border-line bg-surface opacity-50 cursor-not-allowed text-text-muted'
                      : 'border-border-line bg-surface hover:border-accent hover:text-accent font-medium'
                  }`}
                >
                  <div className="font-bold">{dir}</div>
                  <div className="text-[10px] text-text-muted truncate">
                    {info.lane} → Fase {info.targetPhase}
                  </div>
                </button>
              );
            })}
          </div>

          {activeAmbulance && (
            <div className="mt-2.5 pt-2 border-t border-border-line flex items-center justify-between">
              <span className="text-xs text-error font-medium">
                Ambulans aktif dari arah {activeAmbulance.direction} (Fase {DIRECTION_TO_PHASE[activeAmbulance.direction]?.targetPhase})
              </span>
              <button
                type="button"
                onClick={onCancelAmbulance}
                className="px-3 py-1 rounded-md bg-error/10 border border-error/40 text-error hover:bg-error/20 text-xs font-bold transition-colors"
              >
                Batalkan Panggilan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
