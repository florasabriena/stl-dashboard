/**
 * Mesin Status Lampu Lalu Lintas (FSM - Finite State Machine)
 * Fungsi murni, deterministik, dan dapat diuji unit test
 */

export class TrafficLightFSM {
  constructor(initialState) {
    this.state = initialState;
  }

  transition(event) {
    // Logika transisi state
    return this.state;
  }

  getState() {
    return this.state;
  }
}

