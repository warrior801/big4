import { useState } from 'react';
import Overlay, { BigButton } from './Overlay';

// One huge number, big − / +. Tap the number to type it.
export default function WeightPicker({
  title,
  initial,
  step,
  min,
  onDone,
  onClose,
  doneLabel = 'Done',
}: {
  title: string;
  initial: number;
  step: number;
  min: number;
  onDone: (lb: number) => void;
  onClose: () => void;
  doneLabel?: string;
}) {
  const [lb, setLb] = useState(initial);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(String(initial));
  const snap = (v: number) => Math.max(min, Math.round(v / step) * step);
  const set = (v: number) => setLb(snap(v));
  // Functional update so rapid taps all count.
  const nudge = (d: number) => setLb((cur) => snap(cur + d));

  return (
    <Overlay onClose={onClose}>
      <p className="text-center text-2xl font-black tracking-widest text-steel uppercase">{title}</p>

      <div className="flex flex-1 flex-col items-center justify-center">
        {typing ? (
          <input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const v = Number(draft);
              if (Number.isFinite(v)) set(v);
              setTyping(false);
            }}
            className="w-full bg-transparent text-center text-[38vw] leading-none font-black outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(String(lb));
              setTyping(true);
            }}
            className="text-[38vw] leading-none font-black"
          >
            {lb}
          </button>
        )}
        <p className="mt-2 text-2xl font-black tracking-widest text-steel">LB</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <BigButton tone="ghost" onClick={() => nudge(-step)} className="min-h-24 text-6xl">
          −
        </BigButton>
        <BigButton tone="ghost" onClick={() => nudge(step)} className="min-h-24 text-6xl">
          +
        </BigButton>
      </div>
      <BigButton onClick={() => onDone(lb)} className="mb-4 min-h-20">
        {doneLabel}
      </BigButton>
    </Overlay>
  );
}
