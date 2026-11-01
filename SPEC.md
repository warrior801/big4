# BIG4 — Build Spec v1

Oct 31, 2026 · @Cecil Hawthorne

## Overview

A personal strength app that runs Paul Horn's Radically Simple Strength method for one user (Cecil), on desktop and phone. It replaces the Ironframe Health Tracker as the active app for now, and lives in the same Supabase project with its own tables.

**Who it's for:** just Cecil. No public version, no client accounts, no sign-up flow beyond his own login.

**Starting point:** true barbell novice, recomposition goal (hold bodyweight, build strength), training 3 days a week: Monday morning, Wednesday morning, and Saturday around noon.

**What it runs:** Horn's novice phase on the four main lifts (squat, bench press, overhead press, deadlift), with ascending sets of five and weight added every session. Later phases (Intermediate B, Radically Simple Muscle) are planned but out of v1.

**Working name:** BIG4. Icon (decided): red bumper plate with a steel hub, one big white 4 in the center, STRENGTH curved across the top and POWER across the bottom. Design file: \[BIG4 App Icon\](https://claude.ai/artifact/Y49GSkzCLLzvCCEFpontpV), artboard A2. Export as PWA icons (512 px, 192 px, maskable 512 px, Apple touch icon 180 px) during the build. No Hawthorne Noir label on the app; brand colors and fonts are fine.

**Content rule:** the app is written in Cecil's own words, guided by the key points from Horn's books, podcasts, and interviews. No text is copied from the books.

**Change rule:** practical settings (lift weights, jump sizes, accessory swaps, rest timers, plates) change in the app's Settings screen. Program logic (phases, ramp percentages, miss rules) changes through chat and Claude Code.

## Platform and stack

One installable web app (PWA): same build on desktop and phone, added to the phone home screen, no app store.

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | React + TypeScript (Vite), Tailwind | Fast to build in Claude Code, one codebase for both screens |
| Backend | Existing Supabase project, new tables prefixed `str_` | Shares login with the health tracker, keeps data separate |
| Auth | Supabase email login, single user, row-level security on `user_id` | Locked to Cecil |
| Offline | Local database in the browser (IndexedDB via Dexie), sync queue to Supabase | VASA signal can't be trusted mid-workout |
| Hosting | Vercel or Netlify, free tier | Push to deploy |

**Offline-first rule:** every set logs locally first and syncs when a connection returns. The Today screen must work with zero signal, including the rest timer and plate math.

**Units:** pounds throughout. Bar = 45 lb. Plates at VASA: 45, 35, 25, 10, 5, 2.5 lb. The smallest possible jump on the bar is 5 lb (2.5 per side).

## Program engine

The engine decides what Cecil lifts next and at what weight. All rules live in one config file (`program.json`) so logic changes go through chat and Claude Code. Settings-level values in that file are defaults that Cecil can override in the app. Rules marked **Horn** come from his podcast and published material; rules marked **default** are placeholders to confirm against the book.

### Novice phase structure (Horn)

Two workouts alternate, A then B, every session. Squat is in every workout.

| Sub-phase | Workouts | Workout A | Workout B |
| --- | --- | --- | --- |
| 1a | 1–12 | Squat, Bench, Deadlift | Squat, Press, Deadlift |
| 1b | 13–24 | Squat, Bench, Deadlift | Squat, Press, Chin-ups or Lat pulldown |
| 1c | 25 until progress stops | Squat, Bench or Press, Curls | Deadlift, Bench or Press, Lying triceps extensions |

Horn swaps the deadlift for chin-ups or pulldowns every other workout from exactly workout 13, because the deadlift is the hardest lift to recover from. From workout 25 the squat drops to twice a week. His preferred layout is the same every week: workout A on Monday and Saturday, workout B on Wednesday, with bench and press still alternating. Curls and lying triceps extensions come in at the same point. Which accessory lands on which 1c day, and where chin-ups go in 1c, are **default** (confirm in the book).

### Ascending sets of five (Horn)

For each main lift, the app takes today's top-set weight and builds the ramp:

1. Empty bar x 5
2. 60% x 5
3. 70% x 5
4. 80% x 5
5. 90% x 5
6. 100% x 5 (the top set)

Warm-ups count as work. Only the 90% and 100% sets need to be exact (Horn); the lighter steps round down to the nearest easy load with the plates on hand. When early weights are too light for six distinct steps (for example a 75 lb press), the app collapses duplicate steps instead of listing the same weight twice.

**Deadlift exception (Horn):** the reps come down as the weight goes up so the warm-ups don't tire you out before the one heavy set: 60% x 5, 70% x 3, 80% x 2, 90% x 1, then 100% x 5. While the top set is light, the 90% single is skipped.

**Accessories:** chin-ups add weight once the first set reaches 10 reps (Horn). Lat pulldowns work in the 8–10 range and add weight once the first set reaches 10 (Horn). Curls and lying triceps extensions are **default** 3 x 8–12, stopping 1–2 reps short of failure; when all three sets reach 12, add the smallest jump and start back at 8. The point is tension, not soreness: arm work should help bench and press, not leave the elbows beat up on bench day. Chin-up and pulldown set counts are **default** 3 sets, stopping one rep short of failure.

### Progression (Horn)

All 5 reps on the top set means weight goes up next time that lift appears.

| Lift | Early jump (while it feels light) | Later jump |
| --- | --- | --- |
| Squat | +10 lb | +5 lb |
| Deadlift | +20 lb | +5 lb |
| Bench press | +5 lb | +2.5 lb |
| Press | +5 lb | +2.5 lb |

Horn's minimums are 5 lb on the lower-body lifts and 2.5 lb on bench and press, and he is plain that upper-body lifts stall too soon without small jumps. VASA's smallest plate is 2.5 lb, so **1.25 lb fractional plates in the gym bag are required** for the 2.5 lb jumps. Early jumps run for the first 3 sessions of each lift after day-one calibration (decided; Horn gives no number), then the lift switches to its later jump on its own. Settings can switch a lift sooner. Until the 1.25 lb plates are added in Settings, a 2.5 lb jump isn't loadable, so the app uses the smallest jump it can load (5 lb).

### Missed reps (Horn)

1. Miss the top set once: repeat the same weight next time. One bad day changes nothing.
2. Miss it 2 sessions in a row (Horn's own example: miss, miss again, reset on the third workout): reset that lift only. Take 10% off the top set, rebuild the ramp from it, and make the top set as many reps as possible, stopping one rep short of a miss.
3. After a reset, weight keeps going up as long as the top set gets at least 3 reps.
4. Below 3 again: either a second reset (10–15% off, aiming to beat the rep record from the first reset) or the novice phase is done.
5. Optional: when a lift appears twice in one week, the second session can be a light day that stops at 90%.

### Day-one calibration (Starting Strength practice)

First session for each lift: work up in small jumps for sets of five, starting from the empty bar, until bar speed slows or form slips. Cecil taps "this is my start" and that weight becomes the first top set. Calibration runs over the first two sessions (A covers bench and deadlift, B covers press).

### Schedule

Training days are Monday morning, Wednesday morning, and Saturday around noon after the Delta shift. In 1a and 1b, workouts alternate A/B regardless of the day, so each workout rotates through the week. In 1c the layout is fixed: A on Monday and Saturday, B on Wednesday.

- **Rest gaps:** Monday to Wednesday about 48 hours, Wednesday to Saturday about 75, Saturday to Monday about 44. All clear the 40-hour rest warning.
- **Missed day:** the next workout in the rotation moves to the next training day. No doubling up.
- **Saturday:** comes after a morning of work. The app sends a reminder that morning to eat before lifting. If the shift runs long, the session rolls to Monday.
- **Reminders:** a notification the morning of each training day. On iPhone this requires the app installed to the home screen.
- **Weekly count:** sessions this week out of 3.
- **Layoff rule (default):** more than 7 days off, repeat the last weights; more than 14 days, drop 10%.

### Phase change (Horn)

Horn's novice phase usually runs three to six months, three to four being more realistic. The squat decides when it ends: bench and press usually stall first and get reset, while squat and deadlift keep going. When the squat stalls, or a reset lift drops below 3 reps again, the app flags "novice phase may be done" and stops there. Switching early is fine; Horn would rather you move on than grind. Cecil decides in chat whether to move to Intermediate B.

## Screens and features

Six screens, phone layout first. On desktop the same screens sit side by side.

### 1. Today

The gym screen. Opens straight to the next workout.

- Each lift shows its full ramp (bar, 60–100%) with the weight and the plates per side for every set. Example: 185 lb = 45 + 25 per side; 215 lb = 45 + 35 + 5 per side. Plates load heaviest first.
- One tap logs a set as done; long-press to enter reps actually hit (0–5).
- Rest timer starts automatically after each logged set. Default 3 min for ramp sets, 5 min after the top set, both adjustable.
- "Video link" button on each top set (see Video below).
- A notes field per session (sleep, how the shift went, aches).
- Finish button closes the session, runs the progression rules, and shows what changes next time.

### 2. Technique guide

One page per lift (squat, bench, press, deadlift, chin-up, lat pulldown, curl, lying triceps extension). Each page has:

- **Setup:** stance, grip, bar position, in short steps.
- **Cues:** three to five one-line cues to read between sets.
- **Common faults:** what goes wrong and the fix.
- **Demo link:** Horn's YouTube demo for that lift.
- **My notes:** Cecil's own running notes, plus links to his past top-set videos.

Guide text is written in Cecil's own words in chat and loaded as a content file. Nothing copied from the books.

### 3. Tracker

- Session history, newest first, with every set.
- Per-lift chart of top-set weight over time.
- PR list: heaviest top set and best estimated 1-rep max per lift. Estimate formula: weight x (1 + reps / 30).
- **Benchmarks (Horn):** progress bars toward Tier 1 plate goals for one rep (press 135, bench 225, squat 315, deadlift 405), then Tier 2 (the same weights for five reps). Tier 1 is measured by estimated max from top sets; no max-out testing required.

### 4. Body

- **Daily weigh-in (Horn):** morning, after the bathroom, before food. One number, one tap.
- Shows the 7-day average and the change versus 4 weeks ago.
- **Recomp band:** goal is to hold weight. Flag if the 4-week average moves more than 2 lb either direction (default). Horn's line: more than 4 lb a month up is fat gain.
- **Measurements:** neck, chest, waist, hips, bicep, forearm, thigh, calf, every other Monday morning with the weigh-in. App reminds on those Mondays.

### 5. Protein

- Daily target 200 g (Horn).
- Saved meals with protein grams (chicken Caesar, batch-cook lunches, etc.). One tap adds a meal.
- Quick-add box for anything else (grams only).
- Progress bar for the day; a 7-day hit rate (days at 200 g or more).
- No calories, no barcode scanning, no full food log in v1.

### 6. Settings

A settings-level editor. Cecil changes the practical knobs from his phone; the program's logic stays locked.

- **Lift weights:** override any lift's current top-set weight (bar taken, bad day, retest).
- **Jumps:** change the jump size per lift, or switch a lift to its later jump.
- **Accessories:** pick chin-ups or lat pulldowns; turn curls on or off. Lying triceps extensions stay on (Horn calls them essential for bench and press).
- **Rest timers:** ramp-set and top-set defaults.
- **Schedule:** training days, reminder times, rest-warning hours.
- **Plates:** plates available and bar weight; add 1.25 lb plates when bought.
- **Protein:** daily target and saved meals.
- **Export:** all data as CSV.

Every change is logged with its date, old value, and new value, so the history still makes sense later.

**Not editable in the app:** phases, ramp percentages, miss and reset rules, phase-change triggers. Those change through chat and Claude Code.

### Video

Videos stay on Cecil's phone. A web app can't reliably reach the phone's camera roll, so each top set gets:

1. An automatic timestamp, so the clip is easy to find by time in the camera roll.
2. An optional link field for a share link (iCloud, Google Photos or Google Drive) if he uploads the clip there.

Linked videos then show on that lift's technique page under My notes.

## Warm-up, mobility, and pain checks

Every session gets about 10 minutes of prep before the first bar, 5 minutes of stretching after, and a pain check at the end. Horn's own piece here is a shoulder stretch for getting into the low-bar squat position; the rest is standard practice, not from his books.

**What actually prevents injury:** a real warm-up, the ramp sets, good technique, and not jumping weight too fast. Stretching alone has weak evidence for preventing lifting injuries, and long static holds right before heavy sets can sap some strength. So: movement prep before lifting, static stretching after.

### Before lifting (about 10 min)

1. General warm-up: 5 minutes on a bike, rower, or incline treadmill, enough to break a light sweat.
2. Lift-specific prep for that session, 2 easy rounds:

| Lift in today's workout | Prep |
| --- | --- |
| Squat (every session) | Ankle rocks to a wall x10 per side; hip flexor lunge with overhead reach, x5 per side; bodyweight squat with a 3 s pause at the bottom x8; Horn's shoulder stretch for bar position, 30 s per side |
| Bench press or press | Band pull-aparts x15; band pass-throughs x10; scap push-ups x10 |
| Deadlift | Dowel hip hinge x10; cat-cow x8; glute bridge x10 |
| Chin-ups (from sub-phase 1b) | Dead hang from the bar, 20 s |

3. Then the ramp sets. The empty bar and 60% sets are part of the warm-up, so don't rush them.

### After lifting (about 5 min, 30–45 s per hold)

- Couch stretch (hip flexors and quads)
- Figure-4 glute stretch
- Lat stretch, hanging onto a rack upright
- Doorway chest stretch
- Calf stretch on a plate edge

### Non-lifting days (optional)

The after-lifting list plus a 10-minute walk, on any day off from the bar.

### Pain check

- At the end of each session the app asks "Anything hurt?" Pick an area (shoulder, elbow, wrist, low back, hip, knee, other), score it 1–10, add a note.
- **Rule:** muscle soreness is normal. Sharp pain, joint pain, or pain that changes how you move means stop that lift for the day.
- Same area flagged two sessions in a row: the app suggests holding that lift's weight and getting it checked by a doctor or physical therapist.
- Pain history shows on the Tracker next to the lift it came from.

### In the app

- **Prep card:** the Today screen opens with a prep checklist for that session's lifts, with a built-in hold timer. Skippable, but skips are logged.
- **Stretch pages:** the technique guide gets a page per prep move and stretch: how to do it and what you should feel, with Horn's shoulder stretch video linked.
- **Settings:** turn individual prep items on or off, or add your own.

## Data model

Twelve new tables in the existing Supabase project, all prefixed `str_`, all carrying `user_id` with row-level security. No changes to the health tracker's tables.

| Table | Holds | Key fields |
| --- | --- | --- |
| `str_lifts` | The exercise list | name, type (main or accessory), default jump lb, later jump lb, active yes/no |
| `str_lift_state` | Where each lift stands now | lift, current top-set lb, miss streak, jump stage, calibrated yes/no |
| `str_sessions` | One row per workout | date-time, workout (A/B), sub-phase (1a/1b/1c), notes, finished yes/no |
| `str_sets` | Every set logged | session, lift, set order, target lb, target reps, reps done, is top set, video timestamp, video link |
| `str_body_weight` | Daily weigh-ins | date, lb |
| `str_measurements` | Every-other-Monday tape | date, neck, chest, waist, hips, bicep, forearm, thigh, calf (inches) |
| `str_meals` | Saved protein meals | name, protein g |
| `str_protein_log` | What he ate each day | date, meal or quick-add, protein g |
| `str_settings` | Current settings | rest timers, plates, bar weight, training days, reminder times, rest-warning hours, protein target, accessory picks |
| `str_settings_log` | Every settings change | date-time, setting, old value, new value |

**Added for prep and pain checks:** `str_prep_log` (session, prep item, done or skipped) and `str_pain_log` (date-time, session, lift, area, score 1–10, note).

**Not in the database:** the program rules (`program.json`) and the technique guide text (`technique.json`). Both ship with the code and change through Claude Code.

**Sync:** each table has `updated_at` and a client-generated `id` (UUID), so offline rows created on the phone merge cleanly. Last write wins; one user means conflicts are rare. Each table also has a `deleted` yes/no column: deleting marks the row instead of removing it, so a delete made offline on the phone reaches the desktop too.

## Scope, open items, and build order

### In v1

Novice phase engine (1a–1c), Today screen with ramp and plate math, rest timer, offline logging, technique guide, tracker with Tier 1 and Tier 2 benchmarks, daily weigh-in with recomp band, measurements, protein counter, video timestamps and links, CSV export.

### Later

- Intermediate B (upper/lower, heavy/light, rep ranges, one top set plus a back-off set)
- Radically Simple Muscle phase (lower body like a powerlifter, upper body like a bodybuilder)
- Dips as an accessory (later in the program)
- Cut-phase mode for the eventual drop toward 175 lb (weight-loss band instead of recomp band)
- Reading bodyweight from or into the health tracker, if that app comes back

### Open items to confirm

- [x] In-app editor: settings-level (decided)
- [x] From the book: exact novice workout lists and the workout-13 boundary
- [x] From the book: miss and reset rule (replaces the default)
- [x] From the book: weight jumps per lift and when to switch to smaller jumps
- [x] Accessory sets and reps: not in Horn's public material. Curls and lying triceps extensions 3 x 8–12, chin-ups and pulldowns 3 sets (decided, both default)
- [x] Fractional plates (1.25 lb) for bench and press, or accept 5 lb jumps
- [x] Keep dips as an accessory, or drop them
- [x] App name: BIG4 (decided)

### Build order for Claude Code

Hand Claude Code this doc and build in this order, testing each step on the phone before the next.

1. Project setup: Vite + React + TypeScript + Tailwind, PWA install, connect the existing Supabase project.
2. Create the twelve `str_` tables with row-level security.
3. `program.json` and the engine: ramp math, plate math, progression, misses, A/B rotation. Unit tests for every rule.
4. Today screen with prep card, logging, rest timer, and pain check, working fully offline.
5. Sync queue from the phone to Supabase.
6. Day-one calibration flow.
7. Tracker and benchmarks.
8. Body and Protein screens.
9. Technique guide (content written in chat first).
10. Video timestamps and links, settings, CSV export.
