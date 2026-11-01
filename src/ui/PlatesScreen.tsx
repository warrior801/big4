import { useRef, useState } from 'react';
import { platesPerSide, sideLabel, type Equipment } from '../engine/plates';
import BarDrawing from './BarDrawing';
import Overlay, { BigButton } from './Overlay';
import Sideways, { useUpright } from './Sideways';

export type ScreenSet = { pct: number; lb: number; reps: number; isTop: boolean; isAmrap: boolean; repsDone?: number | null };

// One set at a time, huge, laid out sideways around the whole bar. Swipe or tap the arrows
// to move up and down the ramp. With onLog it's the gym screen (DONE / MISSED); without,
// it's view-only (the calculator).
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
  const upright = useUpright();
  const touch = useRef<{ x: number; y: number } | null>(null);
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
    <Sideways className="bg-ink">
      <div
        className="flex h-full flex-col"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          // Held upright, the screen is turned: a sideways swipe moves the finger down the glass.
          const along = upright ? e.changedTouches[0].clientY - touch.current.y : e.changedTouches[0].clientX - touch.current.x;
          if (Math.abs(along) > 50) go(along < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[7cqh] leading-none font-black tracking-wide uppercase">{liftName}</p>
            <p className={`mt-1 text-[5cqh] leading-none font-black tracking-widest uppercase ${s.isTop || s.isAmrap ? 'text-plate' : 'text-steel'}`}>{label}</p>
          </div>
          <button onClick={onClose} className="px-2 text-[5cqh] font-black tracking-widest text-steel uppercase" aria-label="Close">
            Close
          </button>
        </div>

        <div className="flex items-end justify-between gap-4">
          <p className="text-[30cqh] leading-[0.85] font-black">
            {barbell || s.lb > 0 ? s.lb : 'BW'}
            {(barbell || s.lb > 0) && <span className="text-[7cqh] text-steel"> LB</span>}
            <span className="ml-3 text-[13cqh] text-plate">{s.isAmrap ? 'MAX' : `×${s.reps}`}</span>
          </p>
          {barbell && (
            <p className="pb-2 text-right text-[9cqh] leading-none font-black">
              {sideLabel(plates)}
              {plates && plates.length > 0 && <span className="block text-[4cqh] tracking-widest text-steel">EACH SIDE</span>}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 py-2">{barbell && <BarDrawing plates={plates ?? []} />}</div>

        <div className="flex items-center gap-3">
          <button onClick={() => go(-1)} disabled={i === 0} className="px-2 text-[12cqh] leading-none font-black disabled:opacity-20" aria-label="Previous set">
            ‹
          </button>
          <div className="flex gap-2">
            {sets.map((x, n) => (
              <span key={n} className={`h-3 w-3 rounded-full ${n === i ? 'bg-chalk' : x.repsDone !== null && x.repsDone !== undefined ? 'bg-plate' : 'bg-line'}`} />
            ))}
          </div>
          <button onClick={() => go(1)} disabled={i === sets.length - 1} className="px-2 text-[12cqh] leading-none font-black disabled:opacity-20" aria-label="Next set">
            ›
          </button>

          <div className="ml-auto flex gap-3">
            {onLog &&
              (done ? (
                <>
                  <p className="self-center text-[7cqh] font-black">DONE · {s.repsDone}</p>
                  <BigButton tone="ghost" onClick={() => setPicking({ max: 20 })}>
                    Change
                  </BigButton>
                </>
              ) : s.isAmrap ? (
                <BigButton onClick={() => setPicking({ max: 20 })} className="min-h-[18cqh] px-8 text-[7cqh]">
                  Log reps
                </BigButton>
              ) : (
                <>
                  <BigButton tone="ghost" onClick={() => setPicking({ max: barbell ? s.reps - 1 : 20 })} className="min-h-[18cqh] text-[5cqh]">
                    {barbell ? 'Missed' : 'Other'}
                  </BigButton>
                  <BigButton onClick={() => log(s.reps)} className="min-h-[18cqh] px-8 text-[8cqh]">
                    Done {s.reps}
                  </BigButton>
                </>
              ))}
          </div>
        </div>
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
    </Sideways>
  );
}

export function RepsPicker({ max, onPick, onClose }: { max: number; onPick: (reps: number) => void; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <p className="text-center text-3xl font-black tracking-wide uppercase">Reps done</p>
      <div className="mt-4 grid flex-1 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] content-start gap-3 overflow-auto pb-4">
        {Array.from({ length: max + 1 }, (_, r) => max - r).map((r) => (
          <BigButton key={r} tone={r === max ? 'plate' : 'ghost'} onClick={() => onPick(r)} className="min-h-20 text-5xl">
            {r}
          </BigButton>
        ))}
      </div>
    </Overlay>
  );
}
