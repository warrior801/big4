import { db } from './db';
import { supabase } from './supabase';
import { resetPullCursors, syncNow } from './sync';

// Before real training starts: erase every test workout, prep and pain entry, and put every
// lift back to "no start weight", on Supabase and on this phone. Lifts and settings stay.
// Needs signal, so Supabase and the phone end up agreeing.
export async function clearTestData(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return 'Signed out';
  const now = new Date().toISOString();

  // Soft-delete, so a desktop that synced earlier drops them too.
  for (const t of ['str_sessions', 'str_sets', 'str_prep_log', 'str_pain_log']) {
    const { error } = await supabase.from(t).update({ deleted: true, updated_at: now }).eq('deleted', false);
    if (error) return error.message;
  }
  const { error } = await supabase
    .from('str_lift_state')
    .update({ top_set_lb: null, miss_streak: 0, jump_stage: 'early', calibrated: false, reset_count: 0, reset_rep_record: null, updated_at: now })
    .eq('deleted', false);
  if (error) return error.message;

  // Then start the phone over from Supabase's copy.
  await db.transaction('rw', [db.sessions, db.sets, db.prepLog, db.painLog, db.liftState, db.lifts, db.settings], async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.prepLog.clear(), db.painLog.clear(), db.liftState.clear(), db.lifts.clear(), db.settings.clear()]);
  });
  try {
    localStorage.removeItem('big4.rest');
  } catch {
    /* nothing saved */
  }
  resetPullCursors(userId);
  await syncNow();
  return null;
}
