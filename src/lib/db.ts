import Dexie, { type EntityTable } from 'dexie';

// The phone's own copy of the str_ tables. Every tap saves here first, so a workout
// runs with zero signal. Rows keep Supabase's column names so step 5's sync can send
// them as they are. `dirty` = 1 means changed here and not yet sent.

type Base = { id: string; user_id?: string; updated_at: string; deleted: boolean; dirty?: 0 | 1 };

export type LiftRow = Base & {
  slug: string;
  name: string;
  kind: 'main' | 'accessory';
  default_jump_lb: number;
  later_jump_lb: number;
  active: boolean;
  sort_order: number;
};

export type LiftStateRow = Base & {
  lift_id: string;
  top_set_lb: number | null;
  miss_streak: number;
  jump_stage: 'early' | 'later';
  calibrated: boolean;
  reset_count: number;
  reset_rep_record: number | null;
};

export type SessionRow = Base & {
  started_at: string;
  finished_at: string | null;
  workout: 'A' | 'B';
  sub_phase: '1a' | '1b' | '1c';
  is_light_day: boolean;
  notes: string | null;
  finished: boolean;
};

export type SetRow = Base & {
  session_id: string;
  lift_id: string;
  set_order: number;
  target_lb: number;
  target_reps: number;
  reps_done: number | null;
  is_top_set: boolean;
  is_amrap: boolean;
  done_at: string | null;
  video_at: string | null;
  video_link: string | null;
};

export type PrepRow = Base & { session_id: string; item: string; status: 'done' | 'skipped' };

export type PainRow = Base & {
  logged_at: string;
  session_id: string | null;
  lift_id: string | null;
  area: string;
  score: number;
  note: string | null;
};

export type SettingsRow = Base & {
  rest_ramp_sec: number;
  rest_top_sec: number;
  bar_lb: number;
  plates_lb: number[];
  training_days: string[];
  rest_warning_hours: number;
  protein_target_g: number;
  accessory_picks: { pull?: 'chinup' | 'pulldown'; curls?: boolean };
  prep_items: Record<string, unknown>;
};

export const db = new Dexie('big4') as Dexie & {
  lifts: EntityTable<LiftRow, 'id'>;
  liftState: EntityTable<LiftStateRow, 'id'>;
  sessions: EntityTable<SessionRow, 'id'>;
  sets: EntityTable<SetRow, 'id'>;
  prepLog: EntityTable<PrepRow, 'id'>;
  painLog: EntityTable<PainRow, 'id'>;
  settings: EntityTable<SettingsRow, 'id'>;
};

db.version(1).stores({
  lifts: 'id, slug, dirty',
  liftState: 'id, lift_id, dirty',
  sessions: 'id, started_at, finished, dirty',
  sets: 'id, session_id, lift_id, dirty',
  prepLog: 'id, session_id, dirty',
  painLog: 'id, session_id, logged_at, dirty',
  settings: 'id, dirty',
});

// Which Supabase table each local table mirrors (step 5 uses this too).
export const REMOTE: Record<string, string> = {
  lifts: 'str_lifts',
  liftState: 'str_lift_state',
  sessions: 'str_sessions',
  sets: 'str_sets',
  prepLog: 'str_prep_log',
  painLog: 'str_pain_log',
  settings: 'str_settings',
};

export const now = () => new Date().toISOString();

// Stamp a change: newer updated_at wins on sync, dirty queues it for sending.
export const touched = <T extends object>(row: T) => ({ ...row, updated_at: now(), dirty: 1 as const });
