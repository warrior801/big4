import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import program from './program/program.json';
import { buildRamp, rampFor } from './engine/ramp';
import { db } from './lib/db';
import { equipmentOf } from './lib/store';
import { BigButton } from './ui/Overlay';
import PlatesScreen from './ui/PlatesScreen';
import WeightPicker from './ui/WeightPicker';

// Pick a lift, pick a weight, see the plates for the whole ramp.
const MAIN = program.lifts.filter((l) => l.kind === 'main');

export default function PlateCalc() {
  const settings = useLiveQuery(() => db.settings.toArray().then((r) => r[0]), []);
  const eq = equipmentOf(settings);
  const [lift, setLift] = useState<(typeof MAIN)[number] | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [last, setLast] = useState(135);

  return (
    <div className="pb-6">
      <header className="pt-6 pb-4">
        <h1 className="text-[15vw] leading-[0.9] font-black tracking-tight sm:text-8xl">PLATES</h1>
        <p className="mt-1 text-xl font-black text-steel">PICK A LIFT, PICK A WEIGHT.</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {MAIN.map((l) => (
          <BigButton key={l.slug} tone="ghost" onClick={() => setLift(l)} className="min-h-32 text-3xl">
            {l.name}
          </BigButton>
        ))}
      </div>
      <p className="mt-6 text-lg font-bold text-steel">
        Plates on hand: {eq.platesLb.join(', ')}. Bar {eq.barLb}. Change these in Settings (coming in step 10).
      </p>

      {lift && weight === null && (
        <WeightPicker
          title={`${lift.name}: top set`}
          initial={last}
          step={2 * Math.min(...eq.platesLb)}
          min={eq.barLb}
          onClose={() => setLift(null)}
          onDone={(lb) => {
            setLast(lb);
            setWeight(lb);
          }}
        />
      )}
      {lift && weight !== null && (
        <PlatesScreen
          liftName={lift.name}
          sets={buildRamp(weight, rampFor(lift.slug), eq)}
          startIndex={99}
          eq={eq}
          onClose={() => {
            setWeight(null);
            setLift(null);
          }}
        />
      )}
    </div>
  );
}
