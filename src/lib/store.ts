// Everything the Today screen writes. All of it lands on the phone first (see db.ts).
import program from '../program/program.json';
import type { Equipment } from '../engine/plates';
import type { Upper } from '../engine/schedule';
import { resultFor, type MaybeStarted, type LiftInfo, type LiftResult, type PastSession, type WorkoutPlan } from '../engine/workout';
import { db, now, touched, type LiftRow, type LiftStateRow, type SessionRow, type SetRow, type SettingsRow } from './db';

const id = () => crypto.randomUUID();

export function equipmentOf(settings: SettingsRow | undefined): Equipment {
  return {
    barLb: settings?.bar_lb ?? program.equipment.barLb,
    platesLb: settings?.plates_lb ?? program.equipment.platesLb,
  };
}

export const liftInfo = (l: LiftRow): LiftInfo => ({
  id: l.id,
  slug: l.slug,
  name: l.name,
  kind: l.kind,
  earlyJumpLb: Number(l.default_jump_lb),
  laterJumpLb: Number(l.later_jump_lb),
});

export const engineState = (s: LiftStateRow): MaybeStarted => ({
  topSetLb: s.top_set_lb === null ? null : Number(s.top_set_lb),
  missStreak: s.miss_streak,
  jumpStage: s.jump_stage,
  calibrated: s.calibrated,
  resetCount: s.reset_count,
  resetRepRecord: s.reset_rep_record,
});

// Finished workouts, oldest first, with the bench/press lift each one used.
export function pastSessions(sessions: SessionRow[], sets: SetRow[], lifts: LiftRow[]): PastSession[] {
  const slugOf = new Map(lifts.map((l) => [l.id, l.slug]));
  return sessions
    .filter((s) => s.finished && !s.deleted)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((s) => {
      const upper = sets.find((x) => x.session_id === s.id && !x.deleted && ['bench', 'press'].includes(slugOf.get(x.lift_id) ?? ''));
      return {
        startedAt: new Date(s.started_at),
        finishedAt: new Date(s.finished_at ?? s.started_at),
        upper: upper ? (slugOf.get(upper.lift_id) as Upper) : null,
      };
    });
}

// The top set actually lifted last time, per lift slug (for the layoff rule).
export function lastTopDone(sessions: SessionRow[], sets: SetRow[], lifts: LiftRow[]): Record<string, number> {
  const finished = new Map(sessions.filter((s) => s.finished && !s.deleted).map((s) => [s.id, s.started_at]));
  const out: Record<string, number> = {};
  const seen: Record<string, string> = {};
  for (const x of sets) {
    const when = finished.get(x.session_id);
    if (!when || !x.is_top_set || x.reps_done === null || x.deleted) continue;
    const slug = lifts.find((l) => l.id === x.lift_id)?.slug;
    if (slug && (!seen[slug] || when > seen[slug])) {
      seen[slug] = when;
      out[slug] = Number(x.target_lb);
    }
  }
  return out;
}

export async function setStartWeight(liftId: string, lb: number) {
  const row = await db.liftState.where('lift_id').equals(liftId).first();
  if (row) await db.liftState.put(touched({ ...row, top_set_lb: lb }));
}

export async function startWorkout(plan: WorkoutPlan, userId: string): Promise<string> {
  const sessionId = id();
  const t = now();
  const session: SessionRow = {
    id: sessionId,
    user_id: userId,
    started_at: t,
    finished_at: null,
    workout: plan.letter,
    sub_phase: plan.subPhase,
    is_light_day: false,
    notes: null,
    finished: false,
    updated_at: t,
    deleted: false,
    dirty: 1,
  };
  const sets: SetRow[] = plan.lifts.flatMap((pl, liftIndex) =>
    pl.sets.map((s) => ({
      id: id(),
      user_id: userId,
      session_id: sessionId,
      lift_id: pl.lift.id,
      set_order: liftIndex * 100 + s.setOrder, // keeps lifts in workout order
      target_lb: s.lb,
      target_reps: s.reps,
      reps_done: null,
      is_top_set: s.isTop,
      is_amrap: s.isAmrap,
      done_at: null,
      video_at: null,
      video_link: null,
      updated_at: t,
      deleted: false,
      dirty: 1,
    })),
  );
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.add(session);
    await db.sets.bulkAdd(sets);
  });
  return sessionId;
}

export async function logSet(setId: string, reps: number) {
  const row = await db.sets.get(setId);
  // The top set's time doubles as the video timestamp, to find the clip in the camera roll.
  if (row) await db.sets.put(touched({ ...row, reps_done: reps, done_at: now(), video_at: row.is_top_set ? now() : row.video_at }));
}

export async function logPrep(sessionId: string, userId: string, items: { item: string; done: boolean }[]) {
  const t = now();
  await db.prepLog.bulkAdd(
    items.map((x) => ({ id: id(), user_id: userId, session_id: sessionId, item: x.item, status: x.done ? 'done' : 'skipped', updated_at: t, deleted: false, dirty: 1 }) as const),
  );
}

export type Pain = { area: string; liftId: string | null; score: number; note: string };

export async function logPain(sessionId: string, userId: string, pains: Pain[]) {
  const t = now();
  await db.painLog.bulkAdd(
    pains.map((p) => ({
      id: id(),
      user_id: userId,
      logged_at: t,
      session_id: sessionId,
      lift_id: p.liftId,
      area: p.area,
      score: p.score,
      note: p.note || null,
      updated_at: t,
      deleted: false,
      dirty: 1 as const,
    })),
  );
}

export async function discardWorkout(sessionId: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    const s = await db.sessions.get(sessionId);
    if (s) await db.sessions.put(touched({ ...s, deleted: true }));
    const sets = await db.sets.where('session_id').equals(sessionId).toArray();
    await db.sets.bulkPut(sets.map((x) => touched({ ...x, deleted: true })));
  });
}

export type Change = { liftName: string; before: number; result: LiftResult };

// Close the workout: run the progression rules on every lift and save the new weights.
export async function finishWorkout(sessionId: string, notes: string, eq: Equipment): Promise<Change[]> {
  return db.transaction('rw', [db.sessions, db.sets, db.lifts, db.liftState], async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return [];
    const sets = (await db.sets.where('session_id').equals(sessionId).toArray()).filter((s) => !s.deleted).sort((a, b) => a.set_order - b.set_order);
    const allSets = await db.sets.toArray();
    const finishedIds = new Set((await db.sessions.toArray()).filter((s) => s.finished && !s.deleted).map((s) => s.id));
    const changes: Change[] = [];

    for (const liftId of [...new Set(sets.map((s) => s.lift_id))]) {
      const lift = await db.lifts.get(liftId);
      const stateRow = await db.liftState.where('lift_id').equals(liftId).first();
      if (!lift || !stateRow || stateRow.top_set_lb === null) continue;
      const mine = sets.filter((s) => s.lift_id === liftId).sort((a, b) => a.set_order - b.set_order);
      // Sessions of this lift so far, counting today: drives the early-jump window.
      const before = new Set(allSets.filter((s) => s.lift_id === liftId && s.reps_done !== null && finishedIds.has(s.session_id)).map((s) => s.session_id)).size;
      const result = resultFor(
        liftInfo(lift),
        { ...engineState(stateRow), topSetLb: Number(stateRow.top_set_lb) },
        mine.map((s) => ({ isTop: s.is_top_set, lb: Number(s.target_lb), repsDone: s.reps_done })),
        before + 1,
        eq,
      );
      changes.push({ liftName: lift.name, before: Number(stateRow.top_set_lb), result });
      if (result.kind === 'skipped') continue;
      const st = result.state;
      await db.liftState.put(
        touched({
          ...stateRow,
          top_set_lb: st.topSetLb,
          miss_streak: st.missStreak,
          jump_stage: st.jumpStage,
          reset_count: st.resetCount,
          reset_rep_record: st.resetRepRecord,
        }),
      );
    }

    await db.sessions.put(touched({ ...session, notes: notes.trim() || null, finished: true, finished_at: now() }));
    return changes;
  });
}
