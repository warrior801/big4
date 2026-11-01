// Day-one calibration: work up in sets of five until the bar slows, then call it.
import program from '../program/program.json';
import { roundDown, roundUp, type Equipment } from './plates';

const C = program.calibration;

// Where the work-up starts: the empty bar, except the deadlift (135, for pulling height).
export function firstWeight(slug: string, eq: Equipment): number {
  const start = (C.startLb as Record<string, number>)[slug];
  return start ? roundUp(start, eq) : eq.barLb;
}

// The suggested next weight after a good set.
export function nextWeight(slug: string, currentLb: number, eq: Equipment): number {
  const jump = (C.jumpLb as Record<string, number>)[slug] ?? 5;
  return roundUp(currentLb + jump, eq);
}

// After a missed set or slipped form: the heaviest good set is the start.
// null = no good set yet, so a lighter weight has to be picked.
export function startAfterMiss(goodLbs: number[]): number | null {
  return goodLbs.length ? Math.max(...goodLbs) : null;
}

// A lighter weight to offer when the very first set was missed.
export function lighterWeight(slug: string, currentLb: number, eq: Equipment): number {
  const jump = (C.jumpLb as Record<string, number>)[slug] ?? 5;
  return roundDown(currentLb - jump, eq);
}

export const CALIBRATION_REPS = C.reps;
