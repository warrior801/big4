import { db } from './db';
import { downloadBasics } from './download';

// Wipes everything this phone has logged (test workouts, start weights, prep, pain) and
// downloads a clean copy of the lifts and settings. Nothing has synced to Supabase yet
// (that's step 5), so the account itself is already clean. Needs signal for the download.
export async function clearTestData(): Promise<string | null> {
  await db.transaction('rw', [db.sessions, db.sets, db.prepLog, db.painLog, db.liftState, db.lifts, db.settings], async () => {
    await Promise.all([db.sessions.clear(), db.sets.clear(), db.prepLog.clear(), db.painLog.clear(), db.liftState.clear(), db.lifts.clear(), db.settings.clear()]);
  });
  try {
    localStorage.removeItem('big4.rest');
  } catch {
    /* nothing saved */
  }
  return downloadBasics();
}
