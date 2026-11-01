import { useState } from 'react';
import { platesPerSide, sideLabel, type Equipment } from '../engine/plates';
import BarDrawing from './BarDrawing';
import { BigButton } from './Overlay';
import { RepsPicker } from './PlatesScreen';
import Sideways from './Sideways';

// Day-one work-up: one weight at a time, sets of five, until the bar slows. Sideways like
// the plates screen. `openLb` is the set about to be done; null once the start is set.
export default function CalibrateScreen({
  liftName,
  openLb,
  reps,
  goodLbs,
  startLb,
  step,
  minLb,
  eq,
  onWeight,
  onGood,
  onStart,
  onMissed,
  onClose,
}: {
  liftName: string;
  openLb: number | null;
  reps: number;
  goodLbs: number[];
  startLb: number | null;
  step: number;
  minLb: number;
  eq: Equipment;
  onWeight: (lb: number) => void;
  onGood: () => void;
  onStart: () => void;
  onMissed: (reps: number) => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const lb = openLb ?? startLb ?? minLb;
  const plates = platesPerSide(lb, eq);

  return (
    <Sideways className="bg-ink">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[7cqh] leading-none font-black tracking-wide uppercase">{liftName}</p>
            <p className="mt-1 text-[5cqh] leading-none font-black tracking-widest text-plate uppercase">
              {openLb === null ? 'Start set' : `Calibration · set ${goodLbs.length + 1}`}
            </p>
          </div>
          <button onClick={onClose} className="px-2 text-[5cqh] font-black tracking-widest text-steel uppercase">
            Close
          </button>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            {openLb !== null && (
              <BigButton tone="ghost" onClick={() => onWeight(Math.max(minLb, lb - step))} disabled={lb <= minLb} className="min-h-[18cqh] min-w-[18cqh] px-0 text-[10cqh]">
                −
              </BigButton>
            )}
            <p className="text-[30cqh] leading-[0.85] font-black">
              {lb}
              <span className="text-[7cqh] text-steel"> LB</span>
              {openLb !== null && <span className="ml-3 text-[13cqh] text-plate">×{reps}</span>}
            </p>
            {openLb !== null && (
              <BigButton tone="ghost" onClick={() => onWeight(lb + step)} className="min-h-[18cqh] min-w-[18cqh] px-0 text-[10cqh]">
                +
              </BigButton>
            )}
          </div>
          <p className="pb-2 text-right text-[9cqh] leading-none font-black">
            {sideLabel(plates)}
            {plates && plates.length > 0 && <span className="block text-[4cqh] tracking-widest text-steel">EACH SIDE</span>}
          </p>
        </div>

        <div className="min-h-0 flex-1 py-2">
          <BarDrawing plates={plates ?? []} />
        </div>

        {goodLbs.length > 0 && (
          <p className="mb-2 text-[5cqh] font-black text-steel">
            GOOD: {goodLbs.join(' · ')}
          </p>
        )}

        {openLb === null ? (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[7cqh] font-black">THAT'S YOUR START. FIRST REAL RAMP NEXT TIME.</p>
            <BigButton onClick={onClose} className="min-h-[18cqh] px-8 text-[7cqh]">
              Done
            </BigButton>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_1.2fr_1.6fr] gap-3">
            <BigButton tone="ghost" onClick={() => setPicking(true)} className="min-h-[18cqh] px-2 text-[4.5cqh] leading-tight">
              Missed / form slipped
            </BigButton>
            <BigButton tone="chalk" onClick={onStart} className="min-h-[18cqh] px-2 text-[5cqh] leading-tight">
              This is my start
            </BigButton>
            <BigButton onClick={onGood} className="min-h-[18cqh] px-2 text-[6cqh] leading-tight">
              Good, go heavier
            </BigButton>
          </div>
        )}
      </div>

      {picking && (
        <RepsPicker
          max={reps - 1}
          onPick={(r) => {
            setPicking(false);
            onMissed(r);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </Sideways>
  );
}
