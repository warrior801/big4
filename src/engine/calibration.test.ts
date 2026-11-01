import { describe, expect, it } from 'vitest';
import { firstWeight, lighterWeight, nextWeight, startAfterMiss } from './calibration';
import type { Equipment } from './plates';

const VASA: Equipment = { barLb: 45, platesLb: [45, 35, 25, 10, 5, 2.5] };

describe('day-one calibration', () => {
  it('starts squat, bench and press on the empty bar', () => {
    expect(['squat', 'bench', 'press'].map((s) => firstWeight(s, VASA))).toEqual([45, 45, 45]);
  });

  it('starts the deadlift at 135, a 45 each side', () => {
    expect(firstWeight('deadlift', VASA)).toBe(135);
  });

  it('suggests +10 on squat and deadlift, +5 on bench and press', () => {
    expect(nextWeight('squat', 95, VASA)).toBe(105);
    expect(nextWeight('deadlift', 135, VASA)).toBe(145);
    expect(nextWeight('bench', 65, VASA)).toBe(70);
    expect(nextWeight('press', 45, VASA)).toBe(50);
  });

  it('rounds a suggestion up to something loadable', () => {
    expect(nextWeight('press', 47.5, VASA)).toBe(55); // 52.5 can't be loaded without 1.25s
  });

  it('makes the heaviest good set the start after a miss', () => {
    expect(startAfterMiss([45, 65, 85, 105])).toBe(105);
  });

  it('asks for a lighter weight when nothing was good yet', () => {
    expect(startAfterMiss([])).toBeNull();
    expect(lighterWeight('deadlift', 135, VASA)).toBe(125);
    expect(lighterWeight('press', 45, VASA)).toBe(45); // never below the bar
  });
});
