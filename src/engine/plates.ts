// Plate math: what goes on each side of the bar, using only the plates on hand.
// Weights are handled in quarter-pounds internally so 1.25 lb plates never cause rounding drift.

export type Equipment = { barLb: number; platesLb: number[] };

const toQ = (lb: number) => Math.round(lb * 4);
const fromQ = (q: number) => q / 4;

// Plates for one side, heaviest first, or null if the weight can't be loaded exactly.
// Assumes the gym has enough of each plate, which holds at VASA for these weights.
export function platesPerSide(totalLb: number, eq: Equipment): number[] | null {
  const sideQ = toQ(totalLb) - toQ(eq.barLb);
  if (sideQ < 0 || sideQ % 2 !== 0) return null;
  let left = sideQ / 2;
  const plates: number[] = [];
  for (const p of [...eq.platesLb].sort((a, b) => b - a).map(toQ)) {
    while (left >= p) {
      plates.push(fromQ(p));
      left -= p;
    }
  }
  return left === 0 ? plates : null;
}

export const isLoadable = (lb: number, eq: Equipment) => platesPerSide(lb, eq) !== null;

// The smallest step the bar can change by: two of the smallest plate.
const stepQ = (eq: Equipment) => 2 * toQ(Math.min(...eq.platesLb));

// Heaviest loadable weight at or under lb. Never below the empty bar.
export function roundDown(lb: number, eq: Equipment): number {
  const barQ = toQ(eq.barLb);
  let q = toQ(lb);
  if (q <= barQ) return eq.barLb;
  q = barQ + Math.floor((q - barQ) / stepQ(eq)) * stepQ(eq);
  while (q > barQ && !isLoadable(fromQ(q), eq)) q -= stepQ(eq);
  return fromQ(q);
}

// Lightest loadable weight at or over lb. A 2.5 lb jump with no 1.25 plates becomes 5 lb.
export function roundUp(lb: number, eq: Equipment): number {
  const barQ = toQ(eq.barLb);
  let q = toQ(lb);
  if (q <= barQ) return eq.barLb;
  q = barQ + Math.ceil((q - barQ) / stepQ(eq)) * stepQ(eq);
  while (!isLoadable(fromQ(q), eq)) q += stepQ(eq);
  return fromQ(q);
}

// "45 + 25" style label for one side; "Empty bar" when there's nothing to load.
export function sideLabel(plates: number[] | null): string {
  if (plates === null) return 'Not loadable';
  return plates.length ? plates.join(' + ') : 'Empty bar';
}
