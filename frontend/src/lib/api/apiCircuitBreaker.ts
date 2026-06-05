/**
 * API Circuit Breaker
 *
 * Implements the Circuit Breaker pattern to protect the backend from request storms
 * when it is degraded or unreachable. Tracks consecutive failures per API group
 * and enforces an exponential backoff before allowing new requests.
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface GroupState {
  failures: number;
  state: CircuitState;
  nextAttemptAt: number;
}

const MAX_FAILURES = 3;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 60000;

class ApiCircuitBreaker {
  private groups: Map<string, GroupState> = new Map();
  private listeners: Set<(group: string, state: CircuitState) => void> = new Set();

  private getGroup(group: string): GroupState {
    if (!this.groups.has(group)) {
      this.groups.set(group, {
        failures: 0,
        state: "CLOSED",
        nextAttemptAt: 0,
      });
    }
    return this.groups.get(group)!;
  }

  private notifyListeners(group: string, state: CircuitState): void {
    this.listeners.forEach((listener) => listener(group, state));
  }

  public subscribe(listener: (group: string, state: CircuitState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Checks if a request should be blocked.
   * Returns true if the circuit is OPEN (meaning requests should NOT be sent).
   */
  public isOpen(group: string): boolean {
    const state = this.getGroup(group);

    if (state.state === "CLOSED") {
      return false;
    }

    const now = Date.now();

    if (state.state === "OPEN") {
      if (now >= state.nextAttemptAt) {
        state.state = "HALF_OPEN";
        this.notifyListeners(group, "HALF_OPEN");
        return false; // Allow one test request
      }
      return true; // Still open, block request
    }

    // HALF_OPEN
    return true; // Another request is already testing the circuit
  }

  /**
   * Records a successful API call. Resets the circuit for the group.
   */
  public recordSuccess(group: string): void {
    const state = this.getGroup(group);
    if (state.failures > 0 || state.state !== "CLOSED") {
      state.failures = 0;
      state.state = "CLOSED";
      state.nextAttemptAt = 0;
      this.notifyListeners(group, "CLOSED");
    }
  }

  /**
   * Records a failed API call (network error, 500s). Tripps the circuit if threshold met.
   */
  public recordFailure(group: string): void {
    const state = this.getGroup(group);
    state.failures += 1;

    if (state.state === "HALF_OPEN" || state.failures >= MAX_FAILURES) {
      state.state = "OPEN";

      // Exponential backoff: 5s, 10s, 20s, up to max
      const backoffMultiplier = Math.pow(2, Math.max(0, state.failures - MAX_FAILURES));
      const backoffMs = Math.min(BASE_BACKOFF_MS * backoffMultiplier, MAX_BACKOFF_MS);

      state.nextAttemptAt = Date.now() + backoffMs;

      console.warn(`[CircuitBreaker] Group '${group}' OPEN. Next attempt in ${backoffMs}ms`);
      this.notifyListeners(group, "OPEN");
    }
  }

  /**
   * Exposes current state for UI indicators
   */
  public getState(group: string): CircuitState {
    // Evaluate time-based transitions silently
    const state = this.getGroup(group);
    if (state.state === "OPEN" && Date.now() >= state.nextAttemptAt) {
      return "HALF_OPEN";
    }
    return state.state;
  }

  /**
   * Forcefully unblocks a group (resets the circuit).
   * Useful when we know the connection is restored from a low-level event.
   */
  public unblockGroup(group: string): void {
    const state = this.getGroup(group);
    state.failures = 0;
    state.state = "CLOSED";
    state.nextAttemptAt = 0;
    this.notifyListeners(group, "CLOSED");
  }
}

export const circuitBreaker = new ApiCircuitBreaker();
