import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FSM_STATES,
  CYCLE_DURATION,
  PHASE_DURATION,
  STARTUP_DURATION,
  LAMP_GROUPS,
  TL_HEAD_TO_GROUP,
  DIRECTION_TO_PHASE,
} from '../src/config/constants.js';

import {
  TrafficLightFSM,
  getStateByCode,
  getStateByIndex,
  getNextNormalStateIndex,
  getLampColors,
  calculateNormalCycleDuration,
  calculatePhaseDurations,
  createInitialFSMState,
  tickFSM,
  triggerEmergencyPriority,
  cancelEmergencyPriority,
} from '../src/lib/fsm.js';

describe('Smart Traffic Light Rawamangun - FSM & Konfigurasi 13 State', () => {
  it('harus memiliki tepat 13 state dengan nama yang persis dari docs/firebase-schema.md bagian 3', () => {
    assert.equal(FSM_STATES.length, 13, 'Jumlah state harus tepat 13');

    const expectedStateCodes = [
      'STARTUP_ALL_RED',
      'A_RED_YELLOW',
      'A_GREEN',
      'A_YELLOW',
      'ALL_RED_A_TO_B',
      'B_RED_YELLOW',
      'B_GREEN',
      'B_YELLOW',
      'ALL_RED_B_TO_C',
      'C_RED_YELLOW',
      'C_GREEN',
      'C_YELLOW',
      'ALL_RED_C_TO_A',
    ];

    const actualStateCodes = FSM_STATES.map((s) => s.state);
    assert.deepEqual(actualStateCodes, expectedStateCodes);
  });

  it('durasi STARTUP_ALL_RED harus tepat 3 detik', () => {
    const startupState = FSM_STATES[0];
    assert.equal(startupState.state, 'STARTUP_ALL_RED');
    assert.equal(startupState.duration, 3);
    assert.equal(STARTUP_DURATION, 3);
  });

  it('durasi tiap fase harus 2/15/3/2 detik (total 22 detik per fase)', () => {
    // Fase A
    const aRY = getStateByCode('A_RED_YELLOW');
    const aG = getStateByCode('A_GREEN');
    const aY = getStateByCode('A_YELLOW');
    const aAllRed = getStateByCode('ALL_RED_A_TO_B');

    assert.equal(aRY.duration, 2, 'A_RED_YELLOW harus 2 detik');
    assert.equal(aG.duration, 15, 'A_GREEN harus 15 detik');
    assert.equal(aY.duration, 3, 'A_YELLOW harus 3 detik');
    assert.equal(aAllRed.duration, 2, 'ALL_RED_A_TO_B harus 2 detik');
    assert.equal(
      aRY.duration + aG.duration + aY.duration + aAllRed.duration,
      22,
      'Total Fase A harus 22 detik'
    );

    // Fase B
    const bRY = getStateByCode('B_RED_YELLOW');
    const bG = getStateByCode('B_GREEN');
    const bY = getStateByCode('B_YELLOW');
    const bAllRed = getStateByCode('ALL_RED_B_TO_C');

    assert.equal(bRY.duration, 2, 'B_RED_YELLOW harus 2 detik');
    assert.equal(bG.duration, 15, 'B_GREEN harus 15 detik');
    assert.equal(bY.duration, 3, 'B_YELLOW harus 3 detik');
    assert.equal(bAllRed.duration, 2, 'ALL_RED_B_TO_C harus 2 detik');
    assert.equal(
      bRY.duration + bG.duration + bY.duration + bAllRed.duration,
      22,
      'Total Fase B harus 22 detik'
    );

    // Fase C
    const cRY = getStateByCode('C_RED_YELLOW');
    const cG = getStateByCode('C_GREEN');
    const cY = getStateByCode('C_YELLOW');
    const cAllRed = getStateByCode('ALL_RED_C_TO_A');

    assert.equal(cRY.duration, 2, 'C_RED_YELLOW harus 2 detik');
    assert.equal(cG.duration, 15, 'C_GREEN harus 15 detik');
    assert.equal(cY.duration, 3, 'C_YELLOW harus 3 detik');
    assert.equal(cAllRed.duration, 2, 'ALL_RED_C_TO_A harus 2 detik');
    assert.equal(
      cRY.duration + cG.duration + cY.duration + cAllRed.duration,
      22,
      'Total Fase C harus 22 detik'
    );

    assert.equal(PHASE_DURATION, 22);
  });

  it('total siklus normal (3 fase x 22 s) harus tepat 66 detik, bukan siklus 60 detik prototipe lama', () => {
    const cycleDur = calculateNormalCycleDuration();
    assert.equal(cycleDur, 66);
    assert.equal(CYCLE_DURATION, 66);

    const phaseDurs = calculatePhaseDurations();
    assert.equal(phaseDurs.A + phaseDurs.B + phaseDurs.C, 66);
  });

  it('urutan transisi siklus normal harus berputar dari ALL_RED_C_TO_A kembali ke A_RED_YELLOW', () => {
    // STARTUP_ALL_RED (index 0) -> A_RED_YELLOW (index 1)
    assert.equal(getNextNormalStateIndex(0), 1);

    // Iterasi siklus normal
    for (let i = 1; i < 12; i++) {
      assert.equal(getNextNormalStateIndex(i), i + 1);
    }

    // Dari ALL_RED_C_TO_A (index 12) harus kembali ke A_RED_YELLOW (index 1), BUKAN index 0 (STARTUP)
    assert.equal(getNextNormalStateIndex(12), 1);
  });

  it('simulasi FSM harus bertransisi otomatis dan akurat sesuai waktu delta', () => {
    const fsm = new TrafficLightFSM();
    assert.equal(fsm.getState().stateCode, 'STARTUP_ALL_RED');
    assert.equal(fsm.getState().remainingSeconds, 3);

    // Setelah 3 detik startup, harus masuk ke A_RED_YELLOW (2 s)
    fsm.tick(3);
    assert.equal(fsm.getState().stateCode, 'A_RED_YELLOW');
    assert.equal(fsm.getState().remainingSeconds, 2);

    // Setelah 2 detik, masuk ke A_GREEN (15 s)
    fsm.tick(2);
    assert.equal(fsm.getState().stateCode, 'A_GREEN');
    assert.equal(fsm.getState().remainingSeconds, 15);

    // Setelah 15 detik, masuk ke A_YELLOW (3 s)
    fsm.tick(15);
    assert.equal(fsm.getState().stateCode, 'A_YELLOW');
    assert.equal(fsm.getState().remainingSeconds, 3);

    // Setelah 3 detik, masuk ke ALL_RED_A_TO_B (2 s)
    fsm.tick(3);
    assert.equal(fsm.getState().stateCode, 'ALL_RED_A_TO_B');
    assert.equal(fsm.getState().remainingSeconds, 2);

    // Setelah 2 detik, masuk ke B_RED_YELLOW (2 s)
    fsm.tick(2);
    assert.equal(fsm.getState().stateCode, 'B_RED_YELLOW');
  });

  it('warna kepala lampu TL1-TL6 harus persis mengikuti grupnya masing-masing', () => {
    // TL1 & TL2 ikuti TLA; TL5 & TL6 ikuti TLB; TL3 & TL4 ikuti TLC
    assert.equal(TL_HEAD_TO_GROUP.TL1, 'TLA');
    assert.equal(TL_HEAD_TO_GROUP.TL2, 'TLA');
    assert.equal(TL_HEAD_TO_GROUP.TL5, 'TLB');
    assert.equal(TL_HEAD_TO_GROUP.TL6, 'TLB');
    assert.equal(TL_HEAD_TO_GROUP.TL3, 'TLC');
    assert.equal(TL_HEAD_TO_GROUP.TL4, 'TLC');

    // Pada saat A_GREEN: TLA=G, TLB=R, TLC=R
    const colorsAGreen = getLampColors('A_GREEN');
    assert.equal(colorsAGreen.TLA, 'G');
    assert.equal(colorsAGreen.TL1, 'G');
    assert.equal(colorsAGreen.TL2, 'G');
    assert.equal(colorsAGreen.TLB, 'R');
    assert.equal(colorsAGreen.TL5, 'R');
    assert.equal(colorsAGreen.TL6, 'R');
    assert.equal(colorsAGreen.TLC, 'R');
    assert.equal(colorsAGreen.TL3, 'R');
    assert.equal(colorsAGreen.TL4, 'R');

    // Pada saat C_RED_YELLOW: TLA=R, TLB=R, TLC=RY
    const colorsCRY = getLampColors('C_RED_YELLOW');
    assert.equal(colorsCRY.TLA, 'R');
    assert.equal(colorsCRY.TLB, 'R');
    assert.equal(colorsCRY.TLC, 'RY');
    assert.equal(colorsCRY.TL3, 'RY');
    assert.equal(colorsCRY.TL4, 'RY');
  });

  it('pemetaan GPIO grup lampu harus sesuai firmware aktual', () => {
    // TLA: 4 / 13 / 14
    assert.deepEqual(LAMP_GROUPS.TLA.gpio, { r: 4, y: 13, g: 14 });
    // TLB: 26 / 27 / 32
    assert.deepEqual(LAMP_GROUPS.TLB.gpio, { r: 26, y: 27, g: 32 });
    // TLC: 18 / 19 / 23
    assert.deepEqual(LAMP_GROUPS.TLC.gpio, { r: 18, y: 19, g: 23 });
  });

  it('alur prioritas ambulans harus berlabel simulasi dan memetakan arah ke fase yang benar', () => {
    // Utara -> Fase A
    assert.equal(DIRECTION_TO_PHASE.Utara.targetPhase, 'A');
    assert.equal(DIRECTION_TO_PHASE.Utara.targetGreenState, 'A_GREEN');

    // Timur -> Fase C
    assert.equal(DIRECTION_TO_PHASE.Timur.targetPhase, 'C');
    assert.equal(DIRECTION_TO_PHASE.Timur.targetGreenState, 'C_GREEN');

    let state = createInitialFSMState();
    state = tickFSM(state, 3); // Ke A_RED_YELLOW
    state = tickFSM(state, 2); // Ke A_GREEN

    // Pemicu prioritas dari arah Utara (target A_GREEN)
    const priorityState = triggerEmergencyPriority(state, 'Utara', 'req-test-1');
    assert.equal(priorityState.mode, 'PRIORITAS AMBULANS');
    assert.ok(priorityState.simulationPriority);
    assert.equal(priorityState.simulationPriority.isSimulation, true);
    assert.equal(priorityState.simulationPriority.label, 'simulasi');
    assert.equal(priorityState.simulationPriority.targetPhase, 'A');
    assert.equal(priorityState.simulationPriority.stage, 'HELD');

    // Pembatalan prioritas
    const cancelledState = cancelEmergencyPriority(priorityState);
    assert.equal(cancelledState.mode, 'NORMAL');
    assert.equal(cancelledState.simulationPriority.active, false);
  });
});

