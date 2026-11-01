import { db, type LiftRow, type LiftStateRow, type SettingsRow } from './db';
import { ensureSeeded } from './seed';
import { supabase } from './supabase';

// When there's signal: make sure the account has its lifts, then copy the lifts, their
// state, and settings down to the phone. A row only comes down if the phone has no
// newer copy, so nothing changed here is overwritten. Full two-way sync is step 5.
export async function downloadBasics(): Promise<string | null> {
  const seeded = await ensureSeeded();
  if (seeded.error) return seeded.error;

  const pull = async <T extends { id: string; updated_at: string }>(remote: string, local: typeof db.lifts | typeof db.liftState | typeof db.settings) => {
    const { data, error } = await supabase.from(remote).select('*').eq('deleted', false);
    if (error) return error.message;
    await db.transaction('rw', local, async () => {
      for (const row of data as T[]) {
        const mine = await local.get(row.id);
        if (!mine || (!mine.dirty && mine.updated_at < row.updated_at)) await local.put({ ...(row as object), dirty: 0 } as never);
      }
    });
    return null;
  };

  return (
    (await pull<LiftRow>('str_lifts', db.lifts)) ??
    (await pull<LiftStateRow>('str_lift_state', db.liftState)) ??
    (await pull<SettingsRow>('str_settings', db.settings))
  );
}
