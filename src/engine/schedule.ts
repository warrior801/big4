// Which workout is next, which lifts are in it, and when to train.
import program from '../program/program.json';
import { roundDown, type Equipment } from './plates';

export type SubPhase = '1a' | '1b' | '1c';
export type Letter = 'A' | 'B';
export type Upper = 'bench' | 'press';
export type Pull = 'chinup' | 'pulldown';
export type Day = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const DAYS: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const S = program.schedule;

// workoutNumber counts every finished workout plus this one: 1, 2, 3...
export function subPhaseFor(workoutNumber: number): SubPhase {
  const hit = program.subPhases.find((p) => workoutNumber >= p.fromWorkout && (p.toWorkout === null || workoutNumber <= p.toWorkout));
  return (hit?.id ?? '1c') as SubPhase;
}

// 1a and 1b alternate A/B regardless of the day. 1c runs A, B, A within each week,
// so a missed day shifts the rest of that week instead of skipping a squat day.
export function letterFor(workoutNumber: number, sessionsEarlierThisWeek: number): Letter {
  if (subPhaseFor(workoutNumber) !== '1c') return workoutNumber % 2 === 1 ? 'A' : 'B';
  const pattern = program.workouts['1cWeekPattern'] as Letter[];
  return pattern[sessionsEarlierThisWeek] ?? (sessionsEarlierThisWeek % 2 === 0 ? 'A' : 'B');
}

export type WorkoutPicks = {
  lastUpper: Upper | null; // the bench/press lift from the last workout, for 1c's alternation
  pull: Pull;
  curls: boolean;
};

// Lift slugs for a workout, in order.
export function liftsFor(sub: SubPhase, letter: Letter, picks: WorkoutPicks): string[] {
  const upper: Upper = sub === '1c' ? (picks.lastUpper === 'bench' ? 'press' : 'bench') : letter === 'A' ? 'bench' : 'press';
  return program.workouts[sub][letter]
    .map((s) => (s === 'UPPER' ? upper : s === 'PULL' ? picks.pull : s))
    .filter((s) => s !== 'curl' || picks.curls);
}

// The next training day on or after `from`. Pass tomorrow to skip today.
export function nextTrainingDay(from: Date, days: Day[] = S.trainingDays as Day[]): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 7; i++) {
    if (days.includes(DAYS[d.getDay()])) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// Training weeks start on Monday.
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const hoursBetween = (a: Date, b: Date) => Math.abs(b.getTime() - a.getTime()) / 3_600_000;

// True when the last workout was too recent to lift heavy again.
export function tooSoon(lastFinished: Date | null, now: Date, warnHours: number = S.restWarningHours): boolean {
  return lastFinished !== null && hoursBetween(lastFinished, now) < warnHours;
}

// Layoff rule: over 7 days off repeats the last weights; over 14 drops 10%.
// nextTopLb is what progression set; lastDoneLb is the top set actually lifted last time.
export function afterLayoff(daysOff: number, nextTopLb: number, lastDoneLb: number, eq: Equipment): number {
  if (daysOff > S.layoffDropAfterDays) return roundDown(lastDoneLb * (1 - S.layoffDropPct / 100), eq);
  if (daysOff > S.layoffRepeatAfterDays) return lastDoneLb;
  return nextTopLb;
}
