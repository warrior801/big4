// Ascending sets of five: today's top set becomes the full ramp, bar to 100%.
import program from '../program/program.json';
import { platesPerSide, roundDown, type Equipment } from './plates';

export type RampStep = { pct: number; reps: number; onlyFromTopLb?: number };

export type RampSet = {
  pct: number; // 0 = empty bar
  lb: number;
  reps: number;
  plates: number[]; // one side, heaviest first
  isTop: boolean;
  isAmrap: boolean; // as many reps as possible: the top set after a reset
};

export type RampOptions = {
  amrap?: boolean;
  lightDay?: boolean; // Horn's light day: stop at 90%, no top set
};

export function rampFor(slug: string): RampStep[] {
  return slug === 'deadlift' ? program.ramps.deadlift : program.ramps.main;
}

export function buildRamp(topLb: number, steps: RampStep[], eq: Equipment, opts: RampOptions = {}): RampSet[] {
  const top = roundDown(topLb, eq);
  const lastPct = opts.lightDay ? program.ramps.lightDayMaxPct : 100;
  const sets: RampSet[] = [];

  for (const step of steps) {
    if (step.pct > lastPct) continue;
    if (step.onlyFromTopLb && top < step.onlyFromTopLb) continue;
    const isTop = step.pct === lastPct;
    // The top set is exact; warm-ups round down to the nearest easy load.
    const lb = isTop && !opts.lightDay ? top : step.pct === 0 ? eq.barLb : roundDown((top * step.pct) / 100, eq);
    const prev = sets[sets.length - 1];
    // Collapse steps that land on the same weight, so light days never list a weight twice.
    if (prev && lb <= prev.lb) {
      if (isTop) sets.pop();
      else continue;
    }
    if (!isTop && lb >= top) continue;
    sets.push({
      pct: step.pct,
      lb,
      reps: step.reps,
      plates: platesPerSide(lb, eq) ?? [],
      isTop,
      isAmrap: isTop && !opts.lightDay && !!opts.amrap,
    });
  }
  return sets;
}
