import program from '../program/program.json';
import { supabase } from './supabase';

// First sign-in: add the eight lifts, a state row for each, and the settings row.
// Only fills in what's missing, so it's safe to run on every sign-in.
// Runs online for now; step 5's sync takes this over.

let running: Promise<SeedResult> | null = null;

export type SeedResult = { lifts: number; added: number; error: string | null };

export function ensureSeeded(): Promise<SeedResult> {
  running ??= seed().finally(() => (running = null)); // one run at a time, even if called twice
  return running;
}

async function seed(): Promise<SeedResult> {
  const { data: have, error } = await supabase.from('str_lifts').select('slug').eq('deleted', false);
  if (error) return { lifts: 0, added: 0, error: error.message };

  const haveSlugs = new Set(have.map((l) => l.slug));
  const now = new Date().toISOString();
  const missing = program.lifts
    .map((l, i) => ({ ...l, sort_order: i }))
    .filter((l) => !haveSlugs.has(l.slug))
    .map((l) => ({
      id: crypto.randomUUID(),
      slug: l.slug,
      name: l.name,
      kind: l.kind,
      default_jump_lb: l.earlyJumpLb,
      later_jump_lb: l.laterJumpLb,
      active: true,
      sort_order: l.sort_order,
      updated_at: now,
    }));

  if (missing.length) {
    const { error: e1 } = await supabase.from('str_lifts').insert(missing);
    if (e1) return { lifts: haveSlugs.size, added: 0, error: e1.message };
    // No top set yet: day-one calibration (step 6) sets the first one.
    const states = missing.map((l) => ({ id: crypto.randomUUID(), lift_id: l.id, updated_at: now }));
    const { error: e2 } = await supabase.from('str_lift_state').insert(states);
    if (e2) return { lifts: haveSlugs.size + missing.length, added: missing.length, error: e2.message };
  }

  const { count } = await supabase.from('str_settings').select('id', { count: 'exact', head: true });
  if (!count) {
    const { error: e3 } = await supabase.from('str_settings').insert({ id: crypto.randomUUID(), updated_at: now });
    if (e3) return { lifts: haveSlugs.size + missing.length, added: missing.length, error: e3.message };
  }

  return { lifts: haveSlugs.size + missing.length, added: missing.length, error: null };
}
