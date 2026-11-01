// What happens to a lift's weight after its top set (Horn's novice rules).
import program from '../program/program.json';
import { roundDown, roundUp, type Equipment } from './plates';

const P = program.progression;

// Mirrors str_lift_state.
export type LiftState = {
  topSetLb: number;
  missStreak: number;
  jumpStage: 'early' | 'later';
  calibrated: boolean;
  resetCount: number; // once a lift has been reset, its top set is as-many-reps-as-possible with a 3-rep floor
  resetRepRecord: number | null;
};

export type Jumps = { earlyLb: number; laterLb: number };

export type Outcome = {
  state: LiftState;
  event: 'up' | 'repeat' | 'reset' | 'reset-stalled';
};

export const isInReset = (s: Pick<LiftState, 'resetCount'>) => s.resetCount > 0;

// sessionNumber: this lift's sessions since day-one calibration, counting this one (1, 2, 3...).
export function afterTopSet(
  state: LiftState,
  repsDone: number,
  jumps: Jumps,
  sessionNumber: number,
  eq: Equipment,
): Outcome {
  const inReset = isInReset(state);
  const target = inReset ? P.repFloorAfterReset : P.topSetReps;
  const record = inReset ? Math.max(state.resetRepRecord ?? 0, repsDone) : state.resetRepRecord;

  // Early jumps for the first sessions after calibration, then the lift settles on its later jump.
  const early = state.jumpStage === 'early' && sessionNumber <= P.earlyJumpSessions;
  const jumpStage = state.jumpStage === 'later' || sessionNumber >= P.earlyJumpSessions ? 'later' : 'early';

  if (repsDone >= target) {
    const jump = early ? jumps.earlyLb : jumps.laterLb;
    return {
      event: 'up',
      state: { ...state, topSetLb: roundUp(state.topSetLb + jump, eq), missStreak: 0, jumpStage, resetRepRecord: record },
    };
  }

  const missStreak = state.missStreak + 1;
  // One bad day changes nothing. A second miss in a row means something has to change.
  if (missStreak < P.missesBeforeReset) {
    return { event: 'repeat', state: { ...state, missStreak, jumpStage, resetRepRecord: record } };
  }
  if (!inReset) {
    return { event: 'reset', state: applyReset({ ...state, jumpStage }, P.resetPct, eq) };
  }
  // Already reset and now under 3 reps twice: Cecil decides between a second reset and moving on.
  return { event: 'reset-stalled', state: { ...state, missStreak, jumpStage, resetRepRecord: record } };
}

// Take pct off the top set and start the rep-record chase. Also used for the second reset (15%).
export function applyReset(state: LiftState, pct: number, eq: Equipment): LiftState {
  return {
    ...state,
    topSetLb: roundDown(state.topSetLb * (1 - pct / 100), eq),
    missStreak: 0,
    resetCount: state.resetCount + 1,
  };
}

// Accessories: chin-ups and pulldowns move up when the first set hits 10;
// curls and triceps extensions when every set hits 12.
export function afterAccessory(rule: 'firstSet' | 'allSets', weightLb: number, repsBySet: number[], jumpLb: number) {
  const goal = program.accessories[rule].addWeightAtReps;
  const ready = rule === 'firstSet' ? (repsBySet[0] ?? 0) >= goal : repsBySet.length > 0 && repsBySet.every((r) => r >= goal);
  return { weightLb: ready ? weightLb + jumpLb : weightLb, addedWeight: ready };
}
