---
type: project
status: active
tags: [big4, fitness, app]
updated: 2026-10-31
---

# BIG4

Cecil's personal strength app: Paul Horn's Radically Simple Strength novice phase, for one user. An installable web app (PWA) for iPhone and desktop. It replaces the [[Fitness-app/ironframe-handoff-brief|Ironframe]] tracker as the active app.

**Read [[SPEC]] first.** It holds the program rules, screens, data model, and build order. Ask Cecil before changing anything in it.

## Where it stands
- **Build order:** one step at a time, and stop after each so Cecil can test it on his iPhone.
- **Step 1 done and tested on the iPhone (2026-10-31):** Vite + React + TypeScript + Tailwind, PWA install, offline open (passed the airplane-mode test), and sign-in to the shared Supabase project, live on Hostinger.
- **Step 2 done and tested on the iPhone (2026-10-31), "12 of 12 tables ready":** `supabase/schema.sql` creates the twelve `str_` tables with a soft-delete `deleted` column and an own-rows policy. After sign-in the app shows "Database: N of 12 tables ready." The eight lifts get seeded by the app on first sign-in in step 3, not by the SQL.
- **Step 3 done and tested on the iPhone (2026-10-31), "8 of 8 lifts," plate math checked:** `src/program/program.json` holds every rule, `src/engine/` runs it (plates, ramp, progression, schedule), and there are 34 tests (`npm test`). On first sign-in, `src/lib/seed.ts` adds the eight lifts, a state row for each, and the settings row. The signed-in screen has a plate calculator that becomes part of the Today screen in step 4.

- **Step 4 done and tested on the iPhone (2026-10-31).** Follow-ups the same day: the plates screen and rest timer are drawn sideways (`src/ui/Sideways.tsx`), the bar drawing shows the whole bar, the timer is red with white numbers, and Me has a "Clear test data" button. Step 4 details: the Today screen (`src/Today.tsx`) with prep card, plates screen, DONE / MISSED logging, the big rest timer, notes, pain check, and the "next time" summary. Everything saves to the phone's own database first (`src/lib/db.ts`, Dexie, rows marked `dirty` for step 5's sync). With signal, `src/lib/download.ts` copies lifts, lift state, and settings down. Bottom bar: Today, Plates (calculator), Me. **Workouts stay on the phone until step 5**; Cecil isn't training on the app before it's finished. The beep on/off is saved on the phone only until Settings (step 10).

## How it's built
- **Stack:** Vite, React, TypeScript, Tailwind v4 (`@tailwindcss/vite`), `vite-plugin-pwa`. The Archivo font is bundled, so it works offline.
- **Supabase:** the same project as Ironframe (`src/lib/supabase.ts`), with email and password login. The publishable key in the code is fine there. New tables are prefixed `str_`. Never touch Ironframe's tables.
- **Hosting:** Hostinger, which auto-deploys from `github.com/warrior801/big4` on every push to `main`. The build command is `npm run build`, and the output folder is `dist`.
- **Icons:** `public/` holds icons generated from `icon-source.png`. The source has **white** corners, not transparent ones, and the script masks them out. To regenerate: `npm i --no-save sharp && npm run icons`. `sharp` is kept out of `package.json` on purpose, so Hostinger's build never has to install a native image library.
- **Tests:** `npm test` (Vitest) covers every engine rule. Run it before every push that touches `src/engine/` or `program.json`.
- **Local preview:** `npm run build`, then `npm run preview` (port 4173). The service worker only runs in a built preview, not in `npm run dev`.

## Rules
- **Design: big and BOLD, every screen.** Cecil's words: it should make people look twice and ask what he's working with. Huge heavy numbers (Archivo 900), plate red on the dark tile, tap targets sized for chalky hands. Never small grey rows of data.
- Program logic (phases, ramp, miss rules) goes in `program.json` and changes through chat. Practical settings change in the app's Settings screen.
- Technique and guide text is written in Cecil's own words. Never copy text from Horn's books.
- Pounds throughout. Bar 45 lb. VASA plates: 45, 35, 25, 10, 5, 2.5, plus 1.25 fractional plates for bench and press.
