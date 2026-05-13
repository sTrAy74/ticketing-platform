/**
 * Affine mapping between wall clock and a developer-controlled “demo timeline”.
 * Lets humans fast-forward time-based pricing without waiting on real hours.
 */
export type SimClockPublicState = {
  enabled: boolean;
  rate: number;
  simulatedNowMs: number;
  simulatedNowIso: string;
  /** How to think about the control in one line (surfaced in UI). */
  caption: string;
};

let globalEnabled = process.env.ENABLE_TIME_SIMULATION === "true";

/** Internal anchor state - `rate === 0` freezes at `anchorSimMs`. */
type Anchor = {
  anchorRealMs: number;
  anchorSimMs: number;
  rate: number;
};

const state: Anchor = {
  anchorRealMs: Date.now(),
  anchorSimMs: Date.now(),
  rate: 1,
};

function clampRate(raw: number): number {
  if (Number.isNaN(raw) || !Number.isFinite(raw)) return 1;
  /** Cap so runaway values cannot DoS integer paths. */
  return Math.min(Math.max(raw, 0), 1000);
}

function currentSimFromAnchor(s: Anchor): number {
  if (s.rate === 0) return s.anchorSimMs;
  const elapsed = Date.now() - s.anchorRealMs;
  return s.anchorSimMs + elapsed * s.rate;
}

function rebaseToNow(s: Anchor): Anchor {
  const sim = currentSimFromAnchor(s);
  return {
    anchorRealMs: Date.now(),
    anchorSimMs: sim,
    rate: s.rate,
  };
}

export const simClock = {
  setGloballyEnabled(enabled: boolean) {
    globalEnabled = enabled;
  },

  isEnabled(): boolean {
    return globalEnabled;
  },

  nowMs(): number {
    if (!globalEnabled) return Date.now();
    return currentSimFromAnchor(state);
  },

  snapshot(): SimClockPublicState {
    const enabled = globalEnabled;
    const simulatedNowMs = enabled ? currentSimFromAnchor(state) : Date.now();
    const rate = enabled ? state.rate : 1;
    return {
      enabled,
      rate,
      simulatedNowMs,
      simulatedNowIso: new Date(simulatedNowMs).toISOString(),
      caption: enabled
        ? `Demo time runs at ${rate === 0 ? "pause" : `${rate}×`} real speed. Demand window uses the same clock.`
        : "Demo time controls are disabled (set ENABLE_TIME_SIMULATION=true on the API).",
    };
  },

  setRate(next: number) {
    const target = clampRate(next);
    const updated = rebaseToNow(state);
    state.anchorRealMs = updated.anchorRealMs;
    state.anchorSimMs = updated.anchorSimMs;
    state.rate = target;
  },

  shiftByMs(deltaMs: number) {
    const updated = rebaseToNow(state);
    state.anchorRealMs = updated.anchorRealMs;
    state.anchorSimMs = updated.anchorSimMs + deltaMs;
    state.rate = updated.rate;
  },

  setNowMs(targetNowMs: number) {
    const safe = Number.isFinite(targetNowMs) ? targetNowMs : Date.now();
    state.anchorRealMs = Date.now();
    state.anchorSimMs = safe;
  },

  reset() {
    const n = Date.now();
    state.anchorRealMs = n;
    state.anchorSimMs = n;
    state.rate = 1;
  },
};
