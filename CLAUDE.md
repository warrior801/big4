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
- **Step 1 done (2026-10-31):** Vite + React + TypeScript + Tailwind, PWA install with offline open, sign-in to the shared Supabase project. Next: step 2, the twelve `str_` tables.

## How it's built
- **Stack:** Vite, React, TypeScript, Tailwind v4 (`@tailwindcss/vite`), `vite-plugin-pwa`. The Archivo font is bundled, so it works offline.
- **Supabase:** the same project as Ironframe (`src/lib/supabase.ts`), with email and password login. The publishable key in the code is fine there. New tables are prefixed `str_`. Never touch Ironframe's tables.
- **Hosting:** Hostinger, which auto-deploys from `github.com/warrior801/big4` on every push to `main`. The build command is `npm run build`, and the output folder is `dist`.
- **Icons:** `public/` holds icons generated from `icon-source.png`. The source has **white** corners, not transparent ones, and the script masks them out. To regenerate: `npm i --no-save sharp && npm run icons`. `sharp` is kept out of `package.json` on purpose, so Hostinger's build never has to install a native image library.
- **Local preview:** `npm run build`, then `npm run preview` (port 4173). The service worker only runs in a built preview, not in `npm run dev`.

## Rules
- Program logic (phases, ramp, miss rules) goes in `program.json` and changes through chat. Practical settings change in the app's Settings screen.
- Technique and guide text is written in Cecil's own words. Never copy text from Horn's books.
- Pounds throughout. Bar 45 lb. VASA plates: 45, 35, 25, 10, 5, 2.5, plus 1.25 fractional plates for bench and press.
