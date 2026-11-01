import { describe, expect, it } from 'vitest';
import program from '../program/program.json';
import type { Equipment } from './plates';
import type { LiftState } from './progression';
import { planWorkout, resultFor, type LiftInfo, type MaybeStarted, type PlanInput } from './workout';

const VASA: Equipment = { barLb: 45, platesLb: [45, 35, 25, 10, 5, 2.5] };

const LIFTS: LiftInfo[] = program.lifts.map((l) => ({
  id: `id-${l.slug}`,
  slug: l.slug,
  name: l.name,
  kind: l.kind as 'main' | 'accessory',
  earlyJumpLb: l.earlyJumpLb,
  laterJumpLb: l.laterJumpLb,
}));
const lift = (slug: string) => LIFTS.find((l) => l.slug === slug)!;

const state = <T extends number | null>(topSetLb: T, over: Partial<LiftState> = {}) => ({
  topSetLb,
  missStreak: 0,
  jumpStage: 'early' as const,
  calibrated: true,
  resetCount: 0,
  resetRepRecord: null,
  ...over,
}) as T extends number ? LiftState : MaybeStarted;

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: new Date(2026, 10, 2, 7), // Mon Nov 2, 7am
  past: [],
  lifts: LIFTS,
  states: { squat: state(135), bench: state(95), press: state(65), deadlift: state(185), chinup: state(0), curl: state(40), lte: state(40) },
  lastTopDone: {},
  picks: { pull: 'chinup', curls: true },
  eq: VASA,
  ...over,
});

const day = (d: number, h = 8) => ({ startedAt: new Date(2026, 9, d, h), finishedAt: new Date(2026, 9, d, h + 1), upper: null });

describe('planning today', () => {
  it('starts on workout 1, A: squat, bench, deadlift with full ramps', () => {
    const plan = planWorkout(base());
    expect(plan).toMatchObject({ workoutNumber: 1, subPhase: '1a', letter: 'A', daysOff: null });
    expect(plan.lifts.map((l) => l.lift.slug)).toEqual(['squat', 'bench', 'deadlift']);
    expect(plan.lifts[0].sets.at(-1)).toMatchObject({ lb: 135, reps: 5, isTop: true });
    expect(plan.lifts[2].sets.map((s) => s.reps)).toEqual([5, 3, 2, 5]);
  });

  it('asks for a start weight when a lift has none', () => {
    const plan = planWorkout(base({ states: { ...base().states, bench: state(null) } }));
    expect(plan.lifts[1]).toMatchObject({ needsStart: true, sets: [] });
  });

  it('marks the top set as many-as-you-can once a lift has been reset', () => {
    const plan = planWorkout(base({ states: { ...base().states, squat: state(200, { resetCount: 1 }) } }));
    expect(plan.lifts[0].sets.at(-1)).toMatchObject({ isTop: true, isAmrap: true });
  });

  it('runs workout 14 as 1b B with chin-ups for 3 sets of 8', () => {
    const past = Array.from({ length: 13 }, (_, i) => day(i + 1));
    const plan = planWorkout(base({ past, now: new Date(2026, 9, 15, 7) }));
    expect(plan).toMatchObject({ workoutNumber: 14, subPhase: '1b', letter: 'B' });
    expect(plan.lifts.map((l) => l.lift.slug)).toEqual(['squat', 'press', 'chinup']);
    expect(plan.lifts[2].sets.map((s) => [s.lb, s.reps])).toEqual([[0, 8], [0, 8], [0, 8]]);
  });

  it('repeats last weights after more than 7 days off', () => {
    const plan = planWorkout(base({ past: [day(20)], lastTopDone: { squat: 130 }, now: new Date(2026, 9, 30, 7) }));
    expect(plan.daysOff).toBe(9);
    expect(plan.lifts[0].sets.at(-1)?.lb).toBe(130);
  });
});

describe('finishing a lift', () => {
  it('moves a made top set up by the early jump', () => {
    const out = resultFor(lift('squat'), state(135), [{ isTop: true, lb: 135, repsDone: 5 }], 1, VASA);
    expect(out).toMatchObject({ kind: 'main', event: 'up', state: { topSetLb: 145 } });
  });

  it('counts a missed top set', () => {
    const out = resultFor(lift('bench'), state(95), [{ isTop: true, lb: 95, repsDone: 3 }], 4, VASA);
    expect(out).toMatchObject({ event: 'repeat', state: { topSetLb: 95, missStreak: 1 } });
  });

  it('leaves a lift alone when its top set was never logged', () => {
    const out = resultFor(lift('squat'), state(135), [{ isTop: true, lb: 135, repsDone: null }], 1, VASA);
    expect(out.kind).toBe('skipped');
  });

  it('progresses from the weight actually lifted after a layoff', () => {
    const out = resultFor(lift('squat'), state(150, { jumpStage: 'later' }), [{ isTop: true, lb: 135, repsDone: 5 }], 6, VASA);
    expect(out).toMatchObject({ state: { topSetLb: 140 } });
  });

  it('moves curls up when all three sets hit 12', () => {
    const sets = [12, 12, 12].map((r) => ({ isTop: false, lb: 40, repsDone: r }));
    expect(resultFor(lift('curl'), state(40), sets, 1, VASA)).toMatchObject({ kind: 'accessory', event: 'up', state: { topSetLb: 45 } });
  });
});
