/**
 * Mesin Status Lampu Lalu Lintas (FSM - Finite State Machine)
 * Berdasarkan tabel 13 state di docs/firebase-schema.md bagian 3.
 *
 * Spesifikasi:
 * - Siklus normal 66 detik (3 fase x 22 detik).
 * - Tiap fase: MERAH+KUNING 2 s, HIJAU 15 s, KUNING 3 s, SEMUA MERAH 2 s.
 * - STARTUP_ALL_RED 3 s setelah layar pembuka 3 s.
 * - Lampu fisik 3 grup: TLA (TL1+TL2), TLB (TL5+TL6), TLC (TL3+TL4).
 * - Alur prioritas ambulans hanya di mode Simulasi, berlabel "simulasi".
 * - Fungsi murni dan deterministik, dapat diuji unit test.
 */

import {
  FSM_STATES,
  CYCLE_DURATION,
  PHASE_DURATION,
  STARTUP_DURATION,
  TL_HEAD_TO_GROUP,
  DIRECTION_TO_PHASE,
  THRESHOLDS,
} from '../config/constants.js';

/**
 * Mencari state berdasarkan kode string (mis. 'A_GREEN')
 */
export function getStateByCode(code) {
  const found = FSM_STATES.find((s) => s.state === code);
  return found || FSM_STATES[0];
}

/**
 * Mencari state berdasarkan indeks (0..12)
 */
export function getStateByIndex(index) {
  const safeIndex = ((index % FSM_STATES.length) + FSM_STATES.length) % FSM_STATES.length;
  return FSM_STATES[safeIndex];
}

/**
 * Menghitung indeks state berikutnya dalam siklus normal berulang.
 * Urutan: 0 (STARTUP_ALL_RED) -> 1 (A_RED_YELLOW) ... -> 12 (ALL_RED_C_TO_A) -> 1 (A_RED_YELLOW).
 */
export function getNextNormalStateIndex(currentIndex) {
  if (currentIndex === 0) {
    return 1; // Dari STARTUP_ALL_RED masuk ke A_RED_YELLOW
  }
  if (currentIndex >= FSM_STATES.length - 1) {
    return 1; // Dari ALL_RED_C_TO_A (indeks 12) kembali ke A_RED_YELLOW (indeks 1)
  }
  return currentIndex + 1;
}

/**
 * Menghitung kode state berikutnya dalam siklus normal
 */
export function getNextNormalState(currentCode) {
  const index = FSM_STATES.findIndex((s) => s.state === currentCode);
  const nextIdx = getNextNormalStateIndex(index >= 0 ? index : 0);
  return FSM_STATES[nextIdx];
}

/**
 * Menghitung warna lampu untuk grup TLA, TLB, TLC dan tiap kepala TL1-TL6.
 * Aturan:
 * - TL1 dan TL2 mengikuti grup TLA
 * - TL5 dan TL6 mengikuti grup TLB
 * - TL3 dan TL4 mengikuti grup TLC
 */
export function getLampColors(stateCode) {
  const stateObj = typeof stateCode === 'string' ? getStateByCode(stateCode) : stateCode;
  const tla = stateObj.tla || 'R';
  const tlb = stateObj.tlb || 'R';
  const tlc = stateObj.tlc || 'R';

  return {
    TLA: tla,
    TLB: tlb,
    TLC: tlc,
    TL1: tla,
    TL2: tla,
    TL3: tlc,
    TL4: tlc,
    TL5: tlb,
    TL6: tlb,
  };
}

/**
 * Menghitung total durasi siklus normal (tanpa startup)
 */
export function calculateNormalCycleDuration() {
  return FSM_STATES.slice(1).reduce((total, s) => total + s.duration, 0);
}

/**
 * Menghitung durasi per fase normal
 */
export function calculatePhaseDurations() {
  const getPhaseDuration = (groupLetter) =>
    FSM_STATES.filter((s) => s.phaseGroup === groupLetter).reduce(
      (sum, s) => sum + s.duration,
      0
    );

  // Masing-masing fase 22 detik = 2 (RY) + 15 (G) + 3 (Y) + 2 (All-Red)
  return {
    startup: FSM_STATES[0].duration, // 3 s
    A: 2 + 15 + 3 + 2,              // 22 s
    B: 2 + 15 + 3 + 2,              // 22 s
    C: 2 + 15 + 3 + 2,              // 22 s
    cycleTotal: CYCLE_DURATION,      // 66 s
  };
}

/**
 * Membuat state FSM awal murni
 */
export function createInitialFSMState() {
  const initialState = FSM_STATES[0]; // STARTUP_ALL_RED
  return {
    stateIndex: 0,
    stateCode: initialState.state,
    phase: initialState.phase,
    condition: initialState.condition,
    remainingSeconds: initialState.duration,
    elapsedInState: 0,
    cycleElapsed: 0, // 0..66 detik
    mode: 'NORMAL',  // 'NORMAL' | 'PRIORITAS AMBULANS'
    isSimulation: true,
    simulationPriority: null,
  };
}

/**
 * Fungsi murni transisi satu langkah waktu (tick).
 * Deterministic & pure function: menerima state lama dan delta detik, mengembalikan state baru.
 */
export function tickFSM(currentState, deltaSeconds = 1) {
  if (deltaSeconds <= 0) return { ...currentState };

  let state = { ...currentState };
  let remainingDelta = deltaSeconds;

  while (remainingDelta > 0) {
    const timeToStep = Math.min(remainingDelta, state.remainingSeconds);
    state.remainingSeconds -= timeToStep;
    state.elapsedInState += timeToStep;
    remainingDelta -= timeToStep;

    // Perbarui cycleElapsed jika sudah di luar STARTUP
    if (state.stateIndex > 0) {
      state.cycleElapsed = (state.cycleElapsed + timeToStep) % CYCLE_DURATION;
    }

    // Logika prioritas ambulans (hanya di mode Simulasi)
    if (state.simulationPriority && state.simulationPriority.active) {
      const priority = { ...state.simulationPriority };

      // Jika fase tujuan sedang hijau dan dalam status HELD
      if (priority.stage === 'HELD') {
        priority.holdDuration = (priority.holdDuration || 0) + timeToStep;

        // Cek batas keselamatan maksimal (30 detik)
        if (priority.holdDuration >= THRESHOLDS.maxHoldPrioritySeconds) {
          // Batas aman tercapai, paksa rilis
          priority.stage = 'RELEASING';
          state.simulationPriority = priority;
        } else if (!priority.ambulancePassed) {
          // Tahan hitung mundur lampu hijau agar tidak habis selama ambulans belum lewat
          state.remainingSeconds = Math.max(state.remainingSeconds, 5);
          state.simulationPriority = priority;
          continue;
        } else {
          // Ambulans sudah lewat, tunggu tambahan 2 detik lalu rilis
          priority.postClearElapsed = (priority.postClearElapsed || 0) + timeToStep;
          if (priority.postClearElapsed >= THRESHOLDS.postClearHoldSeconds) {
            priority.stage = 'RELEASING';
            state.simulationPriority = priority;
          } else {
            state.remainingSeconds = Math.max(
              state.remainingSeconds,
              THRESHOLDS.postClearHoldSeconds - priority.postClearElapsed
            );
            state.simulationPriority = priority;
            continue;
          }
        }
      }

      // Jika stage RELEASING, kembalikan ke normal
      if (priority.stage === 'RELEASING') {
        state.mode = 'NORMAL';
        state.simulationPriority = {
          ...priority,
          active: false,
          stage: 'DONE',
          doneEmitted: false,
        };
      }
    }

    // Jika waktu di state aktif telah habis, lakukan transisi
    if (state.remainingSeconds <= 0) {
      // Periksa apakah sedang dalam alur transisi prioritas ambulans
      if (
        state.simulationPriority &&
        state.simulationPriority.active &&
        state.simulationPriority.stage === 'TRANSITIONING'
      ) {
        const targetGreen = state.simulationPriority.targetGreenState;

        // Jika baru saja mencapai target hijau
        if (state.stateCode === targetGreen) {
          state.simulationPriority = {
            ...state.simulationPriority,
            stage: 'HELD',
            holdDuration: 0,
            postClearElapsed: 0,
          };
          const nextStateObj = getStateByCode(targetGreen);
          state.remainingSeconds = nextStateObj.duration;
          state.elapsedInState = 0;
          continue;
        }
      }

      // Transisi normal ke state berikutnya
      const nextIndex = getNextNormalStateIndex(state.stateIndex);
      const nextStateObj = getStateByIndex(nextIndex);

      state.stateIndex = nextIndex;
      state.stateCode = nextStateObj.state;
      state.phase = nextStateObj.phase;
      state.condition = nextStateObj.condition;
      state.remainingSeconds = nextStateObj.duration;
      state.elapsedInState = 0;

      // Jika baru mencapai target hijau ambulans saat transisi
      if (
        state.simulationPriority &&
        state.simulationPriority.active &&
        state.stateCode === state.simulationPriority.targetGreenState
      ) {
        state.simulationPriority = {
          ...state.simulationPriority,
          stage: 'HELD',
          holdDuration: 0,
          postClearElapsed: 0,
        };
      }
    }
  }

  return state;
}

/**
 * Memicu alur prioritas ambulans (hanya di mode Simulasi, berlabel "simulasi")
 * Mengikuti aturan PRD 6.1:
 * - Perpindahan fase selalu melewati transisi kuning dan semua-merah.
 * - Jika fase tujuan sudah hijau, tahan hijau.
 */
export function triggerEmergencyPriority(currentState, direction, requestId) {
  const dirInfo = DIRECTION_TO_PHASE[direction];
  if (!dirInfo) return currentState;

  const targetGreen = dirInfo.targetGreenState; // 'A_GREEN' atau 'C_GREEN'
  const isAlreadyTargetGreen = currentState.stateCode === targetGreen;

  const priorityData = {
    isSimulation: true, // Label simulasi
    label: 'simulasi',
    active: true,
    requestId: requestId || `req-${Date.now().toString(36)}`,
    direction,
    targetPhase: dirInfo.targetPhase,
    targetGroup: dirInfo.targetGroup,
    targetGreenState: targetGreen,
    stage: isAlreadyTargetGreen ? 'HELD' : 'TRANSITIONING',
    holdDuration: 0,
    ambulancePassed: false,
    postClearElapsed: 0,
  };

  let updatedState = {
    ...currentState,
    mode: 'PRIORITAS AMBULANS',
    simulationPriority: priorityData,
  };

  if (isAlreadyTargetGreen) {
    // Tahan hijau aktif
    updatedState.remainingSeconds = Math.max(updatedState.remainingSeconds, 15);
  } else {
    // Jika sedang hijau di fase lain, percepat transisi ke kuning (3s) lalu all-red (2s)
    if (
      currentState.condition === 'HIJAU' &&
      currentState.remainingSeconds > 1
    ) {
      // Persingkat hijau yang tidak relevan agar segera kuning
      updatedState.remainingSeconds = 1;
    }
  }

  return updatedState;
}

/**
 * Memberi tahu FSM bahwa ambulans telah melintasi garis persimpangan (simulasi)
 */
export function notifyAmbulancePassed(currentState) {
  if (!currentState.simulationPriority || !currentState.simulationPriority.active) {
    return currentState;
  }

  return {
    ...currentState,
    simulationPriority: {
      ...currentState.simulationPriority,
      ambulancePassed: true,
    },
  };
}

/**
 * Membatalkan panggilan prioritas ambulans (simulasi)
 * Melepas tahanan hijau dan kembali ke siklus normal secara aman.
 */
export function cancelEmergencyPriority(currentState) {
  if (!currentState.simulationPriority) return currentState;

  return {
    ...currentState,
    mode: 'NORMAL',
    simulationPriority: {
      ...currentState.simulationPriority,
      active: false,
      stage: 'CANCELLED',
    },
  };
}

/**
 * Format string JSONL untuk pesan simulasi sesuai serial protocol
 */
export function formatSimulatedJSONL(fsmState, cmd = 'STATUS', requestId = null) {
  const id = requestId || `poll-${Math.random().toString(36).substring(2, 8)}`;
  return JSON.stringify({
    type: 'ACK',
    id,
    cmd,
    state: fsmState.stateCode,
    phase: fsmState.phase,
    condition: fsmState.condition,
    remaining_seconds: Math.ceil(fsmState.remainingSeconds),
    simulation: true,
  });
}

/**
 * Kelas TrafficLightFSM (wrapper OOP untuk state murni)
 */
export class TrafficLightFSM {
  constructor(initialState = null) {
    this.state = initialState ? { ...initialState } : createInitialFSMState();
  }

  tick(deltaSeconds = 1) {
    this.state = tickFSM(this.state, deltaSeconds);
    return this.state;
  }

  triggerPriority(direction, requestId) {
    this.state = triggerEmergencyPriority(this.state, direction, requestId);
    return this.state;
  }

  ambulancePassed() {
    this.state = notifyAmbulancePassed(this.state);
    return this.state;
  }

  cancelPriority() {
    this.state = cancelEmergencyPriority(this.state);
    return this.state;
  }

  getState() {
    return { ...this.state };
  }

  getLampColors() {
    return getLampColors(this.state.stateCode);
  }

  getJSONL(cmd = 'STATUS') {
    return formatSimulatedJSONL(this.state, cmd);
  }
}
