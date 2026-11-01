import { useState } from 'react';
import program from './program/program.json';
import { roundDown, sideLabel, type Equipment } from './engine/plates';
import { buildRamp, rampFor } from './engine/ramp';

// Step 3 phone test: type a top set, see the ramp and the plates for every set.
// Folds into the Today screen in step 4.
const MAIN = program.lifts.filter((l) => l.kind === 'main');

export default function PlateCalc() {
  const [slug, setSlug] = useState('squat');
  const [top, setTop] = useState('135');
  const [fractionals, setFractionals] = useState(false);

  const eq: Equipment = {
    barLb: program.equipment.barLb,
    platesLb: fractionals ? [...program.equipment.platesLb, 1.25] : program.equipment.platesLb,
  };
  const typed = Number(top);
  const valid = Number.isFinite(typed) && typed >= eq.barLb && typed <= 1000;
  const ramp = valid ? buildRamp(typed, rampFor(slug), eq) : [];
  const rounded = valid && roundDown(typed, eq) !== typed;

  return (
    <section className="w-full rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-4 text-lg font-black tracking-wide">Plate calculator</h2>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {MAIN.map((l) => (
          <button
            key={l.slug}
            onClick={() => setSlug(l.slug)}
            className={`rounded-lg py-2 text-sm font-bold ${slug === l.slug ? 'bg-plate' : 'border border-line text-steel'}`}
          >
            {l.slug === 'deadlift' ? 'Dead' : l.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <label className="mb-2 flex items-center gap-3">
        <span className="text-steel">Top set</span>
        <input
          inputMode="decimal"
          value={top}
          onChange={(e) => setTop(e.target.value)}
          className="w-24 rounded-xl border border-line bg-ink px-3 py-2 text-right text-xl font-bold outline-none focus:border-plate"
        />
        <span className="text-steel">lb</span>
      </label>

      <label className="mb-4 flex items-center gap-2 text-sm text-steel">
        <input type="checkbox" checked={fractionals} onChange={(e) => setFractionals(e.target.checked)} />
        I have 1.25 lb plates
      </label>

      {!valid && <p className="text-sm text-plate">Enter a weight of at least {eq.barLb} lb.</p>}
      {rounded && <p className="mb-2 text-sm text-plate">Can't load {typed} exactly; using {roundDown(typed, eq)}.</p>}

      <ul className="divide-y divide-line">
        {ramp.map((s) => (
          <li key={s.pct} className={`flex items-baseline justify-between py-2 ${s.isTop ? 'text-chalk' : 'text-steel'}`}>
            <span className="w-14 text-xs">{s.pct === 0 ? 'Bar' : `${s.pct}%`}</span>
            <span className={`w-24 font-bold ${s.isTop ? 'text-xl' : ''}`}>
              {s.lb} <span className="text-xs font-normal">x {s.reps}</span>
            </span>
            <span className="flex-1 text-right text-sm">{sideLabel(s.plates)}</span>
          </li>
        ))}
      </ul>
      {ramp.length > 0 && <p className="mt-2 text-xs text-steel">Plates are per side.</p>}
    </section>
  );
}
