// Builds today's workout from the history, and works out what changes when it's finished.
import program from '../program/program.json';
import type { Equipment } from './plates';
import { buildRamp, rampFor } from './ramp';
import { afterAccessory, afterTopSet, isInReset, type LiftState, type Outcome } from './progression';
import { afterLayoff, letterFor, liftsFor, subPhaseFor, weekStart, type Letter, type Pull, type SubPhase, type Upper } from './schedule';

export type LiftInfo = { id: string; slug: string; name: string; kind: 'main' | 'accessory'; earlyJumpLb: number; laterJumpLb: number };

export type PastSession = { startedAt: Date; finishedAt: Date; upper: Upper | null };

export type PlannedSet = { setOrder: number; pct: number; lb: number; reps: number; isTop: boolean; isAmrap: boolean };

export type PlannedLift = { lift: LiftInfo; needsStart: boolean; sets: PlannedSet[] };

export type WorkoutPlan = { workoutNumber: number; subPhase: SubPhase; letter: Letter; daysOff: number | null; lifts: PlannedLift[] };

// A lift's state before its start weight is set has no top set yet.
export type MaybeStarted = Omit<LiftState, 'topSetLb'> & { topSetLb: number | null };

export type PlanInput = {
  now: Date;
  past: PastSession[]; // finished workouts, oldest first
  lifts: LiftInfo[];
  states: Record<string, MaybeStarted>; // by slug
  lastTopDone: Record<string, number>; // by slug: the top set actually lifted last time
  picks: { pull: Pull; curls: boolean };
  eq: Equipment;
};

const ACC = program.accessories;

export function planWorkout(input: PlanInput): WorkoutPlan {
  const { now, past, eq } = input;
  const workoutNumber = past.length + 1;
  const thisWeek = weekStart(now).getTime();
  const earlierThisWeek = past.filter((p) => p.startedAt.getTime() >= thisWeek).length;
  const letter = letterFor(workoutNumber, earlierThisWeek);
  const subPhase = subPhaseFor(workoutNumber);
  const last = past[past.length - 1];
  const lastUpper = [...past].reverse().find((p) => p.upper)?.upper ?? null;
  const daysOff = last ? Math.floor((now.getTime() - last.finishedAt.getTime()) / 86_400_000) : null;

  const slugs = liftsFor(subPhase, letter, { lastUpper, ...input.picks });
  const lifts = slugs
    .map((slug) => input.lifts.find((l) => l.slug === slug))
    .filter((l): l is LiftInfo => !!l)
    .map((lift): PlannedLift => {
      const state = input.states[lift.slug];
      const top = state?.topSetLb ?? null;
      if (top === null) return { lift, needsStart: true, sets: [] };

      if (lift.kind === 'accessory') {
        const rule = (program.lifts.find((l) => l.slug === lift.slug)?.rule ?? 'allSets') as 'firstSet' | 'allSets';
        const reps = ACC[rule].repRange[0];
        return {
          lift,
          needsStart: false,
          sets: Array.from({ length: ACC.sets }, (_, i) => ({ setOrder: i + 1, pct: 100, lb: top, reps, isTop: false, isAmrap: false })),
        };
      }

      const lastDone = input.lastTopDone[lift.slug];
      const topToday = daysOff !== null && lastDone !== undefined ? afterLayoff(daysOff, top, lastDone, eq) : top;
      const ramp = buildRamp(topToday, rampFor(lift.slug), eq, { amrap: isInReset(state) });
      return {
        lift,
        needsStart: false,
        sets: ramp.map((s, i) => ({ setOrder: i + 1, pct: s.pct, lb: s.lb, reps: s.reps, isTop: s.isTop, isAmrap: s.isAmrap })),
      };
    });

  return { workoutNumber, subPhase, letter, daysOff, lifts };
}

export type LoggedSet = { isTop: boolean; lb: number; repsDone: number | null };

export type LiftResult =
  | (Outcome & { kind: 'main' })
  | { kind: 'accessory'; state: LiftState; event: 'up' | 'repeat' }
  | { kind: 'skipped' };

// What happens to one lift when the workout is finished.
// sessionNumber: this lift's sessions since its start weight was set, counting this one.
export function resultFor(lift: LiftInfo, state: LiftState, sets: LoggedSet[], sessionNumber: number, eq: Equipment): LiftResult {
  if (lift.kind === 'accessory') {
    const reps = sets.filter((s) => s.repsDone !== null).map((s) => s.repsDone as number);
    if (!reps.length) return { kind: 'skipped' };
    const rule = (program.lifts.find((l) => l.slug === lift.slug)?.rule ?? 'allSets') as 'firstSet' | 'allSets';
    const out = afterAccessory(rule, state.topSetLb, reps, lift.laterJumpLb);
    return { kind: 'accessory', event: out.addedWeight ? 'up' : 'repeat', state: { ...state, topSetLb: out.weightLb } };
  }
  const top = sets.find((s) => s.isTop);
  if (!top || top.repsDone === null) return { kind: 'skipped' };
  // Progress from the weight actually lifted today (a layoff may have lowered it).
  const lifted = { ...state, topSetLb: top.lb };
  return { kind: 'main', ...afterTopSet(lifted, top.repsDone, { earlyLb: lift.earlyJumpLb, laterLb: lift.laterJumpLb }, sessionNumber, eq) };
}
