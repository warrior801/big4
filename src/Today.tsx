import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import program from './program/program.json';
import prep from './program/prep.json';
import { roundUp } from './engine/plates';
import { buildRamp, rampFor } from './engine/ramp';
import { tooSoon, weekStart, type Pull } from './engine/schedule';
import { planWorkout, type PlannedLift } from './engine/workout';
import { primeAudio } from './lib/beep';
import { db, type LiftRow, type LiftStateRow, type SessionRow, type SetRow, type SettingsRow } from './lib/db';
import {
  discardWorkout,
  engineState,
  equipmentOf,
  finishWorkout,
  lastTopDone,
  liftInfo,
  logPain,
  logPrep,
  logSet,
  pastSessions,
  setStartWeight,
  startWorkout,
  type Change,
  type Pain,
} from './lib/store';
import Overlay, { BigButton } from './ui/Overlay';
import PlatesScreen from './ui/PlatesScreen';
import RestTimer from './ui/RestTimer';
import WeightPicker from './ui/WeightPicker';

type Rest = { endsAt: number; next: string | null };
const REST_KEY = 'big4.rest';
const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function Today({ userId }: { userId: string }) {
  const lifts = useLiveQuery(() => db.lifts.toArray(), []);
  const states = useLiveQuery(() => db.liftState.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray().then((r) => r[0]), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const sets = useLiveQuery(() => db.sets.toArray(), []);

  // Lives here, not in Active: finishing closes the session, which unmounts Active.
  const [summary, setSummary] = useState<SummaryData | null>(null);

  if (!lifts || !states || !sessions || !sets) return null;
  if (lifts.length === 0)
    return (
      <Center>
        <p className="text-4xl font-black">GETTING YOUR LIFTS</p>
        <p className="mt-3 text-xl text-steel">Open BIG4 once with signal so it can download them.</p>
      </Center>
    );

  const open = sessions.find((s) => !s.finished && !s.deleted);
  return (
    <>
      {open ? (
        <Active sessionId={open.id} userId={userId} onFinished={setSummary} />
      ) : (
        <Preview userId={userId} data={{ lifts, states, settings, sessions, sets }} />
      )}
      {summary && <Summary {...summary} onClose={() => setSummary(null)} />}
    </>
  );
}

type SummaryData = { changes: Change[]; pains: Pain[]; sessionId: string };

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">{children}</div>;
}

// ---------- before the workout ----------

function Preview({ userId, data }: { userId: string; data: Data }) {
  const { lifts, states, settings, sessions, sets } = data;
  const eq = equipmentOf(settings);
  const [viewing, setViewing] = useState<PlannedLift | null>(null);
  const [starting, setStarting] = useState<PlannedLift | null>(null);

  const plan = useMemo(() => {
    const bySlug = Object.fromEntries(
      lifts.map((l) => {
        const st = states.find((s) => s.lift_id === l.id);
        return [l.slug, st ? engineState(st) : undefined];
      }),
    );
    return planWorkout({
      now: new Date(),
      past: pastSessions(sessions, sets, lifts),
      lifts: lifts.filter((l) => l.active && !l.deleted).map(liftInfo),
      states: Object.fromEntries(Object.entries(bySlug).filter(([, v]) => v)) as never,
      lastTopDone: lastTopDone(sessions, sets, lifts),
      picks: { pull: (settings?.accessory_picks?.pull ?? 'chinup') as Pull, curls: settings?.accessory_picks?.curls ?? true },
      eq,
    });
  }, [lifts, states, settings, sessions, sets, eq]);

  const finished = sessions.filter((s) => s.finished && !s.deleted);
  const lastFinish = finished.map((s) => s.finished_at ?? s.started_at).sort().at(-1);
  const thisWeek = finished.filter((s) => new Date(s.started_at) >= weekStart(new Date())).length;
  const warnHours = settings?.rest_warning_hours ?? program.schedule.restWarningHours;
  const soon = tooSoon(lastFinish ? new Date(lastFinish) : null, new Date(), warnHours);
  const ready = plan.lifts.every((l) => !l.needsStart);
  const d = new Date();

  return (
    <div className="pb-6">
      <header className="pt-6 pb-4">
        <p className="text-xl font-black tracking-widest text-steel">
          {DAY[d.getDay()]} {MON[d.getMonth()]} {d.getDate()} · {thisWeek}/3 THIS WEEK
        </p>
        <h1 className="text-[14vw] leading-[0.9] font-black tracking-tight whitespace-nowrap sm:text-8xl">WORKOUT {plan.letter}</h1>
        <p className="mt-1 text-2xl font-black text-plate">
          #{plan.workoutNumber} · PHASE {plan.subPhase.toUpperCase()}
        </p>
      </header>

      {soon && (
        <p className="mb-4 rounded-2xl bg-plate-dark p-4 text-xl font-black">UNDER {warnHours} HOURS SINCE YOUR LAST WORKOUT. REST IS PART OF THE PROGRAM.</p>
      )}
      {plan.daysOff !== null && plan.daysOff > program.schedule.layoffRepeatAfterDays && (
        <p className="mb-4 rounded-2xl border-2 border-plate p-4 text-xl font-black">
          {plan.daysOff} DAYS OFF. {plan.daysOff > program.schedule.layoffDropAfterDays ? 'WEIGHTS DROPPED 10%.' : 'REPEATING LAST WEIGHTS.'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {plan.lifts.map((pl) => (
          <LiftCard key={pl.lift.id} pl={pl} onOpen={() => (pl.needsStart ? setStarting(pl) : setViewing(pl))} />
        ))}
      </div>

      <BigButton
        disabled={!ready}
        onClick={() => {
          primeAudio();
          void startWorkout(plan, userId);
        }}
        className="mt-6 min-h-24 w-full text-4xl"
      >
        {ready ? 'Start workout' : 'Set start weights first'}
      </BigButton>

      {viewing && (
        <PlatesScreen
          liftName={viewing.lift.name}
          sets={viewing.sets}
          startIndex={viewing.sets.length - 1}
          eq={eq}
          barbell={viewing.lift.kind === 'main'}
          onClose={() => setViewing(null)}
        />
      )}
      {starting && (
        <WeightPicker
          title={`${starting.lift.name}: start weight`}
          initial={starting.lift.kind === 'main' ? eq.barLb : 0}
          step={starting.lift.kind === 'main' ? 2 * Math.min(...eq.platesLb) : 5}
          min={starting.lift.kind === 'main' ? eq.barLb : 0}
          doneLabel="Set start weight"
          onClose={() => setStarting(null)}
          onDone={(lb) => {
            const st = states.find((s) => s.lift_id === starting.lift.id);
            if (st) void setStartWeight(st.lift_id, starting.lift.kind === 'main' ? roundUp(lb, eq) : lb);
            setStarting(null);
          }}
        />
      )}
    </div>
  );
}

type Data = { lifts: LiftRow[]; states: LiftStateRow[]; settings: SettingsRow | undefined; sessions: SessionRow[]; sets: SetRow[] };

function LiftCard({ pl, onOpen, progress }: { pl: PlannedLift; onOpen: () => void; progress?: { done: number; total: number } }) {
  const top = pl.sets.at(-1);
  const finished = progress && progress.done === progress.total;
  return (
    <button onClick={onOpen} className={`rounded-3xl border-2 p-5 text-left active:bg-line ${finished ? 'border-plate bg-panel' : 'border-line bg-panel'}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-black uppercase">{pl.lift.name}</p>
        {progress && (
          <p className={`text-2xl font-black ${finished ? 'text-plate' : 'text-steel'}`}>
            {progress.done}/{progress.total}
          </p>
        )}
      </div>
      {pl.needsStart ? (
        <p className="mt-2 text-3xl font-black text-plate">SET START WEIGHT ›</p>
      ) : top ? (
        <>
          <p className="mt-1 text-7xl leading-none font-black">
            {pl.lift.kind === 'accessory' && top.lb === 0 ? 'BW' : top.lb}
            <span className="ml-2 text-3xl text-steel">
              × {top.isAmrap ? 'MAX' : top.reps}
              {pl.lift.kind === 'accessory' ? ` · ${pl.sets.length} SETS` : ''}
            </span>
          </p>
          {pl.lift.kind === 'main' && <p className="mt-2 text-xl font-black text-steel">{pl.sets.length} SETS TO THE TOP</p>}
        </>
      ) : null}
    </button>
  );
}

// ---------- during the workout ----------

function Active({ sessionId, userId, onFinished }: { sessionId: string; userId: string; onFinished: (s: SummaryData) => void }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => db.sets.where('session_id').equals(sessionId).toArray(), [sessionId]);
  const lifts = useLiveQuery(() => db.lifts.toArray(), []);
  const prepRows = useLiveQuery(() => db.prepLog.where('session_id').equals(sessionId).toArray(), [sessionId]);
  const settings = useLiveQuery(() => db.settings.toArray().then((r) => r[0]), []);
  const [openLift, setOpenLift] = useState<string | null>(null);
  const [rest, setRest] = useState<Rest | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null') as Rest | null;
      return saved && saved.endsAt > Date.now() - 60_000 ? saved : null;
    } catch {
      return null;
    }
  });
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<'lifting' | 'pain'>('lifting');

  useEffect(() => {
    try {
      if (rest) localStorage.setItem(REST_KEY, JSON.stringify(rest));
      else localStorage.removeItem(REST_KEY);
    } catch {
      /* the timer still works, it just won't survive a reload */
    }
  }, [rest]);

  if (!session || !sets || !lifts || !prepRows) return null;
  const eq = equipmentOf(settings);
  const live = sets.filter((s) => !s.deleted).sort((a, b) => a.set_order - b.set_order);
  const liftIds = [...new Set(live.map((s) => s.lift_id))];
  const byLift = liftIds.map((lid) => ({ lift: lifts.find((l) => l.id === lid)!, sets: live.filter((s) => s.lift_id === lid) })).filter((x) => x.lift);
  const slugs = byLift.map((x) => x.lift.slug);

  if (prepRows.length === 0 && stage === 'lifting') {
    return <PrepCard slugs={slugs} onDone={(items) => void logPrep(sessionId, userId, items)} />;
  }

  const nextLabel = (after: SetRow): string | null => {
    const n = live.find((s) => s.reps_done === null && s.id !== after.id);
    if (!n) return null;
    const name = lifts.find((l) => l.id === n.lift_id)?.name ?? '';
    return `${name} ${Number(n.target_lb) || 'BW'} × ${n.is_amrap ? 'MAX' : n.target_reps}`;
  };

  const current = byLift.find((x) => x.lift.id === openLift);
  const allDone = live.every((s) => s.reps_done !== null);

  return (
    <div className="pb-6">
      <header className="pt-6 pb-4">
        <p className="text-xl font-black tracking-widest text-plate">IN PROGRESS · PHASE {session.sub_phase.toUpperCase()}</p>
        <h1 className="text-[14vw] leading-[0.9] font-black tracking-tight whitespace-nowrap sm:text-8xl">WORKOUT {session.workout}</h1>
      </header>

      <div className="flex flex-col gap-3">
        {byLift.map(({ lift, sets: ls }) => (
          <LiftCard
            key={lift.id}
            pl={{
              lift: liftInfo(lift),
              needsStart: false,
              sets: ls.map((s) => ({ setOrder: s.set_order, pct: 0, lb: Number(s.target_lb), reps: s.target_reps, isTop: s.is_top_set, isAmrap: s.is_amrap })),
            }}
            progress={{ done: ls.filter((s) => s.reps_done !== null).length, total: ls.length }}
            onOpen={() => setOpenLift(lift.id)}
          />
        ))}
      </div>

      <label className="mt-6 block">
        <span className="text-xl font-black tracking-widest text-steel">NOTES</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sleep, the shift, aches"
          rows={3}
          className="mt-2 w-full rounded-2xl border-2 border-line bg-panel p-4 text-xl font-bold outline-none focus:border-plate"
        />
      </label>

      <BigButton onClick={() => setStage('pain')} tone={allDone ? 'plate' : 'ghost'} className="mt-4 min-h-24 w-full text-4xl">
        Finish workout
      </BigButton>
      <button
        onClick={() => {
          if (confirm('Throw away this workout? Nothing from it is kept.')) void discardWorkout(sessionId);
        }}
        className="mt-6 w-full py-3 text-lg font-black tracking-widest text-steel"
      >
        DISCARD WORKOUT
      </button>

      {current && (
        <PlatesScreen
          liftName={current.lift.name}
          sets={current.sets.map((s) => ({
            pct: pctOf(current.lift, current.sets, Number(s.target_lb), eq),
            lb: Number(s.target_lb),
            reps: s.target_reps,
            isTop: s.is_top_set,
            isAmrap: s.is_amrap,
            repsDone: s.reps_done,
          }))}
          startIndex={Math.max(0, current.sets.findIndex((s) => s.reps_done === null))}
          eq={eq}
          barbell={current.lift.kind === 'main'}
          onClose={() => setOpenLift(null)}
          onLog={(idx, reps) => {
            primeAudio();
            const s = current.sets[idx];
            void logSet(s.id, reps);
            const next = nextLabel(s);
            if (!next) return;
            const sec = s.is_top_set ? (settings?.rest_top_sec ?? 300) : (settings?.rest_ramp_sec ?? 180);
            setRest({ endsAt: Date.now() + sec * 1000, next });
          }}
        />
      )}

      {rest && <RestTimer endsAt={rest.endsAt} next={rest.next} onClose={() => setRest(null)} />}

      {stage === 'pain' && (
        <PainCheck
          lifts={byLift.map((x) => ({ id: x.lift.id, name: x.lift.name }))}
          onCancel={() => setStage('lifting')}
          onDone={async (pains) => {
            setRest(null);
            await logPain(sessionId, userId, pains);
            const changes = await finishWorkout(sessionId, notes, eq);
            onFinished({ changes, pains, sessionId });
          }}
        />
      )}
    </div>
  );
}

// Which ramp step a logged weight was (bar, 60%, ...), for the plates screen's label.
function pctOf(lift: LiftRow, sets: SetRow[], lb: number, eq: ReturnType<typeof equipmentOf>): number {
  const top = sets.find((s) => s.is_top_set);
  if (lift.kind !== 'main' || !top) return 100;
  return buildRamp(Number(top.target_lb), rampFor(lift.slug), eq).find((r) => r.lb === lb)?.pct ?? 100;
}

// ---------- prep ----------

type PrepItem = { id: string; name: string; dose: string; holdSec?: number };

function PrepCard({ slugs, onDone }: { slugs: string[]; onDone: (items: { item: string; done: boolean }[]) => void }) {
  const items: PrepItem[] = [
    ...prep.general,
    ...(slugs.includes('squat') ? prep.byLift.squat : []),
    ...(slugs.some((s) => s === 'bench' || s === 'press') ? prep.byLift.upper : []),
    ...(slugs.includes('deadlift') ? prep.byLift.deadlift : []),
    ...(slugs.some((s) => s === 'chinup' || s === 'pulldown') ? prep.byLift.pull : []),
  ];
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setDone((d) => new Set(d.has(id) ? [...d].filter((x) => x !== id) : [...d, id]));

  return (
    <div className="pb-6">
      <header className="pt-6 pb-2">
        <h1 className="text-[15vw] leading-[0.9] font-black tracking-tight sm:text-8xl">PREP</h1>
        <p className="mt-1 text-xl font-black text-steel">10 MINUTES. {prep.roundsNote.toUpperCase()}</p>
      </header>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((it) => (
          <ChecklistRow key={it.id} item={it} checked={done.has(it.id)} onToggle={() => toggle(it.id)} />
        ))}
      </div>
      <BigButton onClick={() => onDone(items.map((it) => ({ item: it.id, done: done.has(it.id) })))} className="mt-6 min-h-24 w-full text-4xl">
        {done.size === items.length ? 'To the bar' : 'Skip the rest'}
      </BigButton>
    </div>
  );
}

function ChecklistRow({ item, checked, onToggle }: { item: PrepItem; checked: boolean; onToggle: () => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${checked ? 'border-plate bg-panel' : 'border-line'}`}>
      <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-2xl font-black ${checked ? 'border-plate bg-plate' : 'border-steel'}`}>
          {checked ? '✓' : ''}
        </span>
        <span>
          <span className="block text-xl leading-tight font-black uppercase">{item.name}</span>
          <span className="block text-lg font-bold text-steel">{item.dose}</span>
        </span>
      </button>
      {item.holdSec && <HoldTimer sec={item.holdSec} />}
    </div>
  );
}

function HoldTimer({ sec }: { sec: number }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : sec;
  const label = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${left}`;
  return (
    <button
      onClick={() => setEndsAt(endsAt && left > 0 ? null : Date.now() + sec * 1000)}
      className={`min-h-14 min-w-20 rounded-xl px-3 text-2xl font-black tabular-nums ${endsAt && left === 0 ? 'bg-plate' : endsAt ? 'bg-chalk text-ink' : 'border-2 border-line'}`}
    >
      {endsAt && left === 0 ? 'DONE' : label}
    </button>
  );
}

// ---------- pain check ----------

const AREAS = ['shoulder', 'elbow', 'wrist', 'low back', 'hip', 'knee', 'other'];

function PainCheck({ lifts, onDone, onCancel }: { lifts: { id: string; name: string }[]; onDone: (p: Pain[]) => void; onCancel: () => void }) {
  const [pains, setPains] = useState<Pain[]>([]);
  const [draft, setDraft] = useState<Partial<Pain> | null>(null);

  if (draft === null)
    return (
      <Overlay onClose={onCancel}>
        <p className="mt-4 text-[15vw] leading-[0.9] font-black sm:text-8xl">ANYTHING HURT?</p>
        <p className="mt-4 text-xl font-bold text-steel">
          Soreness is normal. Sharp pain, joint pain, or pain that changes how you move means stop that lift for the day.
        </p>
        {pains.length > 0 && (
          <p className="mt-4 text-xl font-black text-plate">
            LOGGED: {pains.map((p) => `${p.area.toUpperCase()} ${p.score}/10`).join(', ')}
          </p>
        )}
        <div className="mt-auto mb-4 grid gap-3">
          <BigButton tone="ghost" onClick={() => setDraft({})} className="min-h-20">
            {pains.length ? 'Something else hurts' : 'Yes, something hurts'}
          </BigButton>
          <BigButton onClick={() => onDone(pains)} className="min-h-24 text-4xl">
            {pains.length ? 'Done, finish' : 'No, finish'}
          </BigButton>
        </div>
      </Overlay>
    );

  if (!draft.area)
    return (
      <Overlay onClose={() => setDraft(null)}>
        <p className="text-4xl font-black">WHERE?</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {AREAS.map((a) => (
            <BigButton key={a} tone="ghost" onClick={() => setDraft({ area: a })} className="min-h-20">
              {a}
            </BigButton>
          ))}
        </div>
      </Overlay>
    );

  if (draft.liftId === undefined)
    return (
      <Overlay onClose={() => setDraft(null)}>
        <p className="text-4xl font-black">FROM WHICH LIFT?</p>
        <div className="mt-4 grid gap-3">
          {lifts.map((l) => (
            <BigButton key={l.id} tone="ghost" onClick={() => setDraft({ ...draft, liftId: l.id })} className="min-h-20">
              {l.name}
            </BigButton>
          ))}
          <BigButton tone="ghost" onClick={() => setDraft({ ...draft, liftId: null })} className="min-h-20">
            Not a lift
          </BigButton>
        </div>
      </Overlay>
    );

  return (
    <Overlay onClose={() => setDraft(null)}>
      <p className="text-4xl font-black">HOW BAD? 1–10</p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <BigButton key={n} tone={draft.score === n ? 'plate' : 'ghost'} onClick={() => setDraft({ ...draft, score: n })} className="min-h-20 px-0 text-3xl">
            {n}
          </BigButton>
        ))}
      </div>
      <textarea
        value={draft.note ?? ''}
        onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        placeholder="Note (optional)"
        rows={2}
        className="mt-4 w-full rounded-2xl border-2 border-line bg-panel p-4 text-xl font-bold outline-none focus:border-plate"
      />
      <BigButton
        disabled={!draft.score}
        onClick={() => {
          setPains([...pains, { area: draft.area!, liftId: draft.liftId ?? null, score: draft.score!, note: draft.note ?? '' }]);
          setDraft(null);
        }}
        className="mt-auto mb-4 min-h-20"
      >
        Save
      </BigButton>
    </Overlay>
  );
}

// ---------- after the workout ----------

function Summary({ changes, pains, sessionId, onClose }: SummaryData & { onClose: () => void }) {
  // Same area flagged in the last workout too: Horn's line is hold the weight and get it checked.
  const repeated = useLiveQuery(async () => {
    if (!pains.length) return [];
    const finished = (await db.sessions.toArray()).filter((s) => s.finished && !s.deleted && s.id !== sessionId).sort((a, b) => a.started_at.localeCompare(b.started_at));
    const prev = finished.at(-1);
    if (!prev) return [];
    const prevAreas = new Set((await db.painLog.where('session_id').equals(prev.id).toArray()).map((p) => p.area));
    return pains.filter((p) => prevAreas.has(p.area)).map((p) => p.area);
  }, [pains, sessionId]);
  const [done, setDone] = useState<Set<string>>(new Set());

  const line = (c: Change) => {
    const r = c.result;
    if (r.kind === 'skipped') return { big: 'NOT LOGGED', small: 'No change' };
    const after = r.state.topSetLb;
    if (r.kind === 'accessory') return { big: r.event === 'up' ? `${after} LB` : 'SAME', small: r.event === 'up' ? 'Weight goes up' : 'Same weight, chase the reps' };
    switch (r.event) {
      case 'up':
        return { big: `${after} LB`, small: `Up ${after - c.before} lb` };
      case 'repeat':
        return { big: `${after} LB`, small: 'Missed. Same weight next time' };
      case 'reset':
        return { big: `${after} LB`, small: 'Reset 10%. Top set is now as many reps as you can' };
      case 'reset-stalled':
        return { big: `${after} LB`, small: 'Stuck after a reset. Decide in chat: second reset or move on' };
    }
  };

  return (
    <Overlay>
      <div className="flex-1 overflow-auto pb-4">
        <p className="mt-4 text-[15vw] leading-[0.9] font-black sm:text-8xl">DONE.</p>
        <p className="mt-2 text-2xl font-black tracking-widest text-steel">NEXT TIME</p>
        <div className="mt-3 flex flex-col gap-2">
          {changes.map((c) => {
            const l = line(c);
            return (
              <div key={c.liftName} className="rounded-2xl border-2 border-line p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl font-black uppercase">{c.liftName}</p>
                  <p className="text-4xl font-black">{l.big}</p>
                </div>
                <p className="text-lg font-bold text-steel">{l.small}</p>
              </div>
            );
          })}
        </div>

        {repeated && repeated.length > 0 && (
          <p className="mt-4 rounded-2xl bg-plate-dark p-4 text-xl font-black">
            {repeated.map((a) => a.toUpperCase()).join(', ')} FLAGGED TWO WORKOUTS IN A ROW. HOLD THAT LIFT'S WEIGHT AND GET IT CHECKED BY A DOCTOR OR PT.
          </p>
        )}

        <p className="mt-6 text-2xl font-black tracking-widest text-steel">STRETCH · 5 MIN</p>
        <div className="mt-2 flex flex-col gap-2">
          {prep.after.map((it) => (
            <ChecklistRow
              key={it.id}
              item={it}
              checked={done.has(it.id)}
              onToggle={() => setDone((d) => new Set(d.has(it.id) ? [...d].filter((x) => x !== it.id) : [...d, it.id]))}
            />
          ))}
        </div>
      </div>
      <BigButton onClick={onClose} className="mb-4 min-h-20">
        Close
      </BigButton>
    </Overlay>
  );
}
