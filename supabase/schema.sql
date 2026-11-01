-- BIG4 schema: the twelve str_ tables.
-- Run this once in the Supabase project shared with Ironframe:
--   SQL Editor -> New query -> paste all of this -> Run.
-- Safe to run again: it only creates what's missing and resets the policies.
-- It never touches Ironframe's tables.
--
-- Every table carries:
--   id          made on the phone (a UUID), so rows created offline never collide
--   user_id     your login; the policy at the bottom means only you see your rows
--   updated_at  set by the app when you make the change, so the newer edit wins on sync
--   deleted     a soft delete, so a delete made offline still reaches the other device
--
-- No foreign keys between str_ tables on purpose: offline rows can sync in any order,
-- and a set must not be rejected because its session hasn't arrived yet.

-- ---------- the program ----------

create table if not exists str_lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slug text not null,                       -- squat, bench, press, deadlift, chinup, pulldown, curl, lte
  name text not null,
  kind text not null check (kind in ('main', 'accessory')),
  default_jump_lb numeric not null,         -- seeded from program.json, editable in Settings
  later_jump_lb numeric not null,
  active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_lift_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lift_id uuid not null,
  top_set_lb numeric,                       -- empty until day-one calibration sets it
  miss_streak int not null default 0,
  jump_stage text not null default 'early' check (jump_stage in ('early', 'later')),
  calibrated boolean not null default false,
  reset_count int not null default 0,       -- Horn's reset: 10% off, then as many reps as possible
  reset_rep_record int,                     -- best reps after a reset, the number to beat next time
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- workouts ----------

create table if not exists str_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  workout text not null check (workout in ('A', 'B')),
  sub_phase text not null check (sub_phase in ('1a', '1b', '1c')),
  is_light_day boolean not null default false,
  notes text,
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null,
  lift_id uuid not null,
  set_order int not null,
  target_lb numeric not null,
  target_reps int not null,
  reps_done int,                            -- empty until the set is logged
  is_top_set boolean not null default false,
  is_amrap boolean not null default false,  -- top set after a reset: as many reps as possible
  done_at timestamptz,
  video_at timestamptz,                     -- timestamp to find the clip in the camera roll
  video_link text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_prep_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null,
  item text not null,
  status text not null check (status in ('done', 'skipped')),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_pain_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_at timestamptz not null default now(),
  session_id uuid,
  lift_id uuid,
  area text not null check (area in ('shoulder', 'elbow', 'wrist', 'low back', 'hip', 'knee', 'other')),
  score int not null check (score between 1 and 10),
  note text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- body and protein ----------

create table if not exists str_body_weight (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  lb numeric not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  neck numeric, chest numeric, waist numeric, hips numeric,  -- inches
  bicep numeric, forearm numeric, thigh numeric, calf numeric,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  protein_g numeric not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_protein_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  meal_id uuid,                             -- empty for a quick-add
  label text,
  protein_g numeric not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- settings ----------

-- One row per user: plain columns for single values, one json column per list.
create table if not exists str_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  rest_ramp_sec int not null default 180,
  rest_top_sec int not null default 300,
  bar_lb numeric not null default 45,
  plates_lb jsonb not null default '[45, 35, 25, 10, 5, 2.5]',
  training_days jsonb not null default '["mon", "wed", "sat"]',
  reminder_times jsonb not null default '{}',
  rest_warning_hours int not null default 40,
  protein_target_g int not null default 200,
  accessory_picks jsonb not null default '{"pull": "chinup", "curls": true}',
  prep_items jsonb not null default '{}',   -- prep moves switched off, and any of Cecil's own
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists str_settings_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  changed_at timestamptz not null default now(),
  setting text not null,
  old_value jsonb,
  new_value jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- lock every table to its owner, and index for sync ----------

do $$
declare t text;
begin
  foreach t in array array[
    'str_lifts', 'str_lift_state', 'str_sessions', 'str_sets', 'str_prep_log', 'str_pain_log',
    'str_body_weight', 'str_measurements', 'str_meals', 'str_protein_log',
    'str_settings', 'str_settings_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    -- sync asks "what changed since last time?"
    execute format('create index if not exists %I on %I (user_id, updated_at)', t || '_sync_idx', t);
  end loop;
end $$;
