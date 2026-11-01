import { describe, expect, it } from 'vitest';
import { platesPerSide, roundDown, roundUp, sideLabel, type Equipment } from './plates';
import { buildRamp, rampFor } from './ramp';
import { afterAccessory, afterTopSet, applyReset, type LiftState } from './progression';
import { afterLayoff, letterFor, liftsFor, nextTrainingDay, subPhaseFor, tooSoon, weekStart } from './schedule';

const VASA: Equipment = { barLb: 45, platesLb: [45, 35, 25, 10, 5, 2.5] };
const WITH_FRACTIONALS: Equipment = { barLb: 45, platesLb: [45, 35, 25, 10, 5, 2.5, 1.25] };

const fresh = (topSetLb: number, over: Partial<LiftState> = {}): LiftState => ({
  topSetLb,
  missStreak: 0,
  jumpStage: 'early',
  calibrated: true,
  resetCount: 0,
  resetRepRecord: null,
  ...over,
});

describe('plate math', () => {
  it('loads heaviest plates first', () => {
    expect(platesPerSide(185, VASA)).toEqual([45, 25]);
    expect(platesPerSide(215, VASA)).toEqual([45, 35, 5]);
    expect(platesPerSide(135, VASA)).toEqual([45]);
    expect(platesPerSide(50, VASA)).toEqual([2.5]);
  });

  it('shows an empty bar as no plates', () => {
    expect(platesPerSide(45, VASA)).toEqual([]);
    expect(sideLabel([])).toBe('Empty bar');
    expect(sideLabel([45, 25])).toBe('45 + 25');
  });

  it('refuses weights the plates cannot make', () => {
    expect(platesPerSide(47.5, VASA)).toBeNull(); // needs 1.25 per side
    expect(platesPerSide(47.5, WITH_FRACTIONALS)).toEqual([1.25]);
    expect(platesPerSide(40, VASA)).toBeNull(); // lighter than the bar
  });

  it('rounds down to a loadable weight, never below the bar', () => {
    expect(roundDown(111, VASA)).toBe(110);
    expect(roundDown(47.5, VASA)).toBe(45);
    expect(roundDown(30, VASA)).toBe(45);
    expect(roundDown(47.5, WITH_FRACTIONALS)).toBe(47.5);
  });

  it('rounds a 2.5 lb jump up to 5 lb without fractional plates', () => {
    expect(roundUp(102.5, VASA)).toBe(105);
    expect(roundUp(102.5, WITH_FRACTIONALS)).toBe(102.5);
  });
});

describe('ascending sets of five', () => {
  it('builds bar, 60, 70, 80, 90, 100 for squat, all for five', () => {
    const ramp = buildRamp(225, rampFor('squat'), VASA);
    expect(ramp.map((s) => s.lb)).toEqual([45, 135, 155, 180, 200, 225]);
    expect(ramp.every((s) => s.reps === 5)).toBe(true);
    expect(ramp.filter((s) => s.isTop)).toHaveLength(1);
    expect(ramp[5].plates).toEqual([45, 45]);
    expect(ramp[3].plates).toEqual([45, 10, 10, 2.5]); // 180
  });

  it('collapses duplicate light steps instead of listing a weight twice', () => {
    const ramp = buildRamp(75, rampFor('press'), VASA);
    expect(ramp.map((s) => s.lb)).toEqual([45, 50, 60, 65, 75]); // 60% lands on the bar and drops out
    const tiny = buildRamp(55, rampFor('press'), VASA);
    expect(tiny.map((s) => s.lb)).toEqual([45, 55]); // every warm-up rounds down to the bar
    expect(new Set(tiny.map((s) => s.lb)).size).toBe(tiny.length);
  });

  it('gives just the bar when the top set is the bar', () => {
    const ramp = buildRamp(45, rampFor('bench'), VASA);
    expect(ramp).toHaveLength(1);
    expect(ramp[0]).toMatchObject({ lb: 45, isTop: true });
  });

  it('brings deadlift reps down 5, 3, 2, then the top set of 5', () => {
    const ramp = buildRamp(225, rampFor('deadlift'), VASA);
    expect(ramp.map((s) => [s.lb, s.reps])).toEqual([[135, 5], [155, 3], [180, 2], [225, 5]]);
  });

  it('adds the deadlift 90% single once the top set is heavy', () => {
    const ramp = buildRamp(315, rampFor('deadlift'), VASA);
    expect(ramp.map((s) => s.reps)).toEqual([5, 3, 2, 1, 5]);
    expect(ramp[3].lb).toBe(280);
  });

  it('stops a light day at 90% with no top set', () => {
    const ramp = buildRamp(225, rampFor('squat'), VASA, { lightDay: true });
    expect(ramp.map((s) => s.lb)).toEqual([45, 135, 155, 180, 200]);
    expect(ramp.some((s) => s.isAmrap)).toBe(false);
  });

  it('marks the top set as many-reps-as-possible after a reset', () => {
    const ramp = buildRamp(200, rampFor('bench'), VASA, { amrap: true });
    expect(ramp.filter((s) => s.isAmrap).map((s) => s.lb)).toEqual([200]);
  });
});

describe('progression', () => {
  const squat = { earlyLb: 10, laterLb: 5 };
  const bench = { earlyLb: 5, laterLb: 2.5 };

  it('adds the early jump for the first 3 sessions, then switches to the later jump', () => {
    let s = fresh(135);
    s = afterTopSet(s, 5, squat, 1, VASA).state;
    expect(s.topSetLb).toBe(145);
    s = afterTopSet(s, 5, squat, 2, VASA).state;
    s = afterTopSet(s, 5, squat, 3, VASA).state;
    expect(s.topSetLb).toBe(165);
    expect(s.jumpStage).toBe('later');
    s = afterTopSet(s, 5, squat, 4, VASA).state;
    expect(s.topSetLb).toBe(170);
  });

  it('keeps the later jump once Settings switched a lift early', () => {
    const out = afterTopSet(fresh(135, { jumpStage: 'later' }), 5, squat, 1, VASA);
    expect(out.state.topSetLb).toBe(140);
  });

  it('uses 5 lb for bench and press until the 1.25 plates are added', () => {
    const later = fresh(100, { jumpStage: 'later' });
    expect(afterTopSet(later, 5, bench, 5, VASA).state.topSetLb).toBe(105);
    expect(afterTopSet(later, 5, bench, 5, WITH_FRACTIONALS).state.topSetLb).toBe(102.5);
  });

  it('repeats the weight after one miss', () => {
    const out = afterTopSet(fresh(185), 4, squat, 5, VASA);
    expect(out.event).toBe('repeat');
    expect(out.state).toMatchObject({ topSetLb: 185, missStreak: 1 });
  });

  it('clears the miss streak when the repeat is made', () => {
    const out = afterTopSet(fresh(185, { missStreak: 1 }), 5, squat, 5, VASA);
    expect(out.event).toBe('up');
    expect(out.state.missStreak).toBe(0);
  });

  it('resets 10% after two misses in a row (Horn: miss, miss, reset on the third workout)', () => {
    const out = afterTopSet(fresh(225, { missStreak: 1, jumpStage: 'later' }), 4, bench, 10, VASA);
    expect(out.event).toBe('reset');
    expect(out.state).toMatchObject({ topSetLb: 200, missStreak: 0, resetCount: 1 });
  });

  it('after a reset, keeps adding weight as long as the top set gets 3 reps', () => {
    const reset = fresh(200, { resetCount: 1, jumpStage: 'later' });
    const out = afterTopSet(reset, 3, bench, 12, VASA);
    expect(out.event).toBe('up');
    expect(out.state.topSetLb).toBe(205);
  });

  it('remembers the best reps after a reset as the record to beat', () => {
    let s = fresh(200, { resetCount: 1, jumpStage: 'later' });
    s = afterTopSet(s, 8, bench, 12, VASA).state;
    s = afterTopSet(s, 6, bench, 13, VASA).state;
    expect(s.resetRepRecord).toBe(8);
  });

  it('flags a reset lift that drops under 3 reps twice, for Cecil to decide', () => {
    const s = fresh(215, { resetCount: 1, missStreak: 1, jumpStage: 'later' });
    const out = afterTopSet(s, 2, bench, 20, VASA);
    expect(out.event).toBe('reset-stalled');
    expect(out.state.topSetLb).toBe(215);
  });

  it('applies a second reset of 15%', () => {
    const s = applyReset(fresh(215, { resetCount: 1 }), 15, VASA);
    expect(s).toMatchObject({ topSetLb: 180, resetCount: 2 });
  });

  it('moves chin-ups and pulldowns up when the first set hits 10', () => {
    expect(afterAccessory('firstSet', 0, [10, 7, 6], 5)).toEqual({ weightLb: 5, addedWeight: true });
    expect(afterAccessory('firstSet', 0, [9, 9, 9], 5).addedWeight).toBe(false);
  });

  it('moves curls and triceps extensions up only when every set hits 12', () => {
    expect(afterAccessory('allSets', 50, [12, 12, 12], 5).weightLb).toBe(55);
    expect(afterAccessory('allSets', 50, [12, 12, 11], 5).weightLb).toBe(50);
  });
});

describe('rotation and schedule', () => {
  const picks = { lastUpper: null, pull: 'chinup' as const, curls: true };

  it('puts workouts 1-12 in 1a, 13-24 in 1b, 25 on in 1c', () => {
    expect([1, 12, 13, 24, 25, 80].map(subPhaseFor)).toEqual(['1a', '1a', '1b', '1b', '1c', '1c']);
  });

  it('alternates A and B in 1a and 1b, whatever the day', () => {
    expect([1, 2, 3, 4, 13, 14].map((n) => letterFor(n, 0))).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  });

  it('runs 1c as A, B, A each week', () => {
    expect([0, 1, 2].map((i) => letterFor(30, i))).toEqual(['A', 'B', 'A']);
  });

  it('builds 1a: squat every time, bench and press alternating, deadlift every time', () => {
    expect(liftsFor('1a', 'A', picks)).toEqual(['squat', 'bench', 'deadlift']);
    expect(liftsFor('1a', 'B', picks)).toEqual(['squat', 'press', 'deadlift']);
  });

  it('builds 1b: chin-ups or pulldowns replace the deadlift on B', () => {
    expect(liftsFor('1b', 'B', picks)).toEqual(['squat', 'press', 'chinup']);
    expect(liftsFor('1b', 'B', { ...picks, pull: 'pulldown' })).toEqual(['squat', 'press', 'pulldown']);
  });

  it('builds 1c: squat on A, deadlift on B, upper lift alternating every session, arm work added', () => {
    expect(liftsFor('1c', 'A', { ...picks, lastUpper: 'press' })).toEqual(['squat', 'bench', 'curl']);
    expect(liftsFor('1c', 'B', { ...picks, lastUpper: 'bench' })).toEqual(['deadlift', 'press', 'chinup', 'lte']);
    expect(liftsFor('1c', 'A', { ...picks, lastUpper: 'press', curls: false })).toEqual(['squat', 'bench']);
  });

  it('finds the next Monday, Wednesday or Saturday', () => {
    const tue = new Date(2026, 10, 3); // Tue Nov 3, 2026
    expect(nextTrainingDay(tue).getDay()).toBe(3); // Wednesday
    const sun = new Date(2026, 10, 8);
    expect(nextTrainingDay(sun).getDate()).toBe(9); // Monday the 9th
    const mon = new Date(2026, 10, 2);
    expect(nextTrainingDay(mon).getDate()).toBe(2); // today counts
  });

  it('starts training weeks on Monday', () => {
    expect(weekStart(new Date(2026, 10, 7)).getDate()).toBe(2); // Sat the 7th -> Mon the 2nd
    expect(weekStart(new Date(2026, 10, 8)).getDate()).toBe(2); // Sun the 8th -> same week
  });

  it('warns when the last workout was under 40 hours ago', () => {
    const sat = new Date(2026, 10, 7, 13);
    expect(tooSoon(sat, new Date(2026, 10, 9, 7))).toBe(false); // Sat 1pm to Mon 7am = 42 h
    expect(tooSoon(sat, new Date(2026, 10, 8, 13))).toBe(true); // Sunday, 24 h
    expect(tooSoon(null, sat)).toBe(false);
  });

  it('handles layoffs: over 7 days repeats, over 14 drops 10%', () => {
    expect(afterLayoff(5, 190, 185, VASA)).toBe(190);
    expect(afterLayoff(9, 190, 185, VASA)).toBe(185);
    expect(afterLayoff(15, 190, 185, VASA)).toBe(165);
  });
});
