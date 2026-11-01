import { useRef, useState } from 'react';
import { platesPerSide, sideLabel, type Equipment } from '../engine/plates';
import BarDrawing from './BarDrawing';
import Overlay, { BigButton } from './Overlay';

export type ScreenSet = { pct: number; lb: number; reps: number; isTop: boolean; isAmrap: boolean; repsDone?: number | null };

// One set at a time, huge. Swipe or tap the arrows to move up and down the ramp.
// With onLog it's the gym screen (DONE / MISSED); without, it's view-only (the calculator).
export default function PlatesScreen({
  liftName,
  sets,
  startIndex,
  eq,
  barbell = true,
  onLog,
  onClose,
}: {
  liftName: string;
  sets: ScreenSet[];
  startIndex: number;
  eq: Equipment;
  barbell?: boolean;
  onLog?: (index: number, reps: number) => void;
  onClose: () => void;
}) {
  const [i, setI] = useState(Math.min(startIndex, sets.length - 1));
  const [picking, setPicking] = useState<null | { max: number }>(null);
  const touchX = useRef<number | null>(null);
  const s = sets[i];
  const plates = barbell ? platesPerSide(s.lb, eq) : null;
  const done = s.repsDone !== null && s.repsDone !== undefined;
  const go = (d: number) => setI((n) => Math.max(0, Math.min(sets.length - 1, n + d)));
  // Log, then line up the next set so it's waiting when the rest timer ends.
  const log = (reps: number) => {
    onLog?.(i, reps);
    go(1);
  };

  const label = s.isAmrap ? 'As many as you can' : s.isTop ? 'Top set' : s.pct === 0 ? 'Empty bar' : barbell ? `Warm-up · ${s.pct}%` : `Set ${i + 1}`;

  return (
    <Overlay onClose={onClose}>
      <div
        className="flex flex-1 flex-col"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <p className="text-center text-3xl font-black tracking-wide uppercase">{liftName}</p>
        <p className={`mt-1 text-center text-xl font-black tracking-widest uppercase ${s.isTop || s.isAmrap ? 'text-plate' : 'text-steel'}`}>{label}</p>

        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-[32vw] leading-none font-black landscape:text-[22vh]">
            {barbell || s.lb > 0 ? s.lb : 'BW'}
            {(barbell || s.lb > 0) && <span className="text-[6vw] text-steel landscape:text-[5vh]"> LB</span>}
          </p>
          <p className="text-5xl font-black text-plate">{s.isAmrap ? 'MAX REPS' : `× ${s.reps}`}</p>
          {barbell && (
            <>
              <div className="mt-4 w-full">
                <BarDrawing plates={plates ?? []} />
              </div>
              <p className="text-center text-5xl font-black">
                {sideLabel(plates)}
                {plates && plates.length > 0 && <span className="block text-lg tracking-widest text-steel">PER SIDE</span>}
              </p>
            </>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => go(-1)} disabled={i === 0} className="px-4 py-3 text-5xl font-black disabled:opacity-20" aria-label="Previous set">
            ‹
          </button>
          <div className="flex gap-2">
            {sets.map((x, n) => (
              <span
                key={n}
                className={`h-3 w-3 rounded-full ${n === i ? 'bg-chalk' : x.repsDone !== null && x.repsDone !== undefined ? 'bg-plate' : 'bg-line'}`}
              />
            ))}
          </div>
          <button onClick={() => go(1)} disabled={i === sets.length - 1} className="px-4 py-3 text-5xl font-black disabled:opacity-20" aria-label="Next set">
            ›
          </button>
        </div>

        {onLog &&
          (done ? (
            <div className="mb-4 flex items-center gap-3">
              <p className="flex-1 text-center text-3xl font-black">DONE · {s.repsDone}</p>
              <BigButton tone="ghost" onClick={() => setPicking({ max: 20 })}>
                Change
              </BigButton>
            </div>
          ) : s.isAmrap ? (
            <BigButton onClick={() => setPicking({ max: 20 })} className="mb-4 min-h-24 text-4xl">
              Log reps
            </BigButton>
          ) : (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <BigButton onClick={() => log(s.reps)} className="col-span-2 min-h-24 text-4xl">
                Done {s.reps}
              </BigButton>
              <BigButton tone="ghost" onClick={() => setPicking({ max: barbell ? s.reps - 1 : 20 })} className="min-h-24 text-xl">
                {barbell ? 'Missed' : 'Other'}
              </BigButton>
            </div>
          ))}
      </div>

      {picking && (
        <RepsPicker
          max={picking.max}
          onPick={(r) => {
            setPicking(null);
            log(r);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </Overlay>
  );
}

export function RepsPicker({ max, onPick, onClose }: { max: number; onPick: (reps: number) => void; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <p className="text-center text-3xl font-black tracking-wide uppercase">Reps done</p>
      <div className="mt-6 grid flex-1 grid-cols-3 content-start gap-3 overflow-auto pb-4">
        {Array.from({ length: max + 1 }, (_, r) => max - r).map((r) => (
          <BigButton key={r} tone={r === max ? 'plate' : 'ghost'} onClick={() => onPick(r)} className="min-h-24 text-5xl">
            {r}
          </BigButton>
        ))}
      </div>
    </Overlay>
  );
}
