// Two-way sync between the phone's database and Supabase. Newest edit wins (merge.ts).
// Push: every row marked dirty goes up, unless Supabase holds a newer copy.
// Pull: every row changed since the last pull comes down, deletes included.
import { db, REMOTE } from './db';
import { forRemote, pullFrom, sendLocal, takeRemote } from './merge';
import { ensureSeeded } from './seed';
import { supabase } from './supabase';

type LocalName = keyof typeof REMOTE;
const TABLES = Object.keys(REMOTE) as LocalName[];
const table = (name: LocalName) => (db as unknown as Record<LocalName, typeof db.sets>)[name];

const CURSOR = (userId: string, t: string) => `big4.pulled.${userId}.${t}`;
const LAST_OK = 'big4.syncedAt';

export type SyncStatus = { state: 'idle' | 'syncing' | 'offline' | 'error'; message: string; lastOk: string | null; waiting: number };

let status: SyncStatus = { state: 'idle', message: '', lastOk: read(LAST_OK), waiting: 0 };
const listeners = new Set<(s: SyncStatus) => void>();
let running: Promise<void> | null = null;

export function onSyncStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  fn(status);
  return () => void listeners.delete(fn);
}

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((fn) => fn(status));
}

// How many changes on the phone haven't reached Supabase yet.
export async function waitingCount(): Promise<number> {
  const counts = await Promise.all(TABLES.map((t) => table(t).where('dirty').equals(1).count()));
  return counts.reduce((a, b) => a + b, 0);
}

export function syncNow(): Promise<void> {
  running ??= run().finally(() => (running = null)); // one sync at a time
  return running;
}

async function run() {
  const waiting = await waitingCount();
  if (!navigator.onLine) return setStatus({ state: 'offline', message: 'No signal. Saved on the phone.', waiting });
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return setStatus({ state: 'idle', message: 'Signed out', waiting });

  setStatus({ state: 'syncing', message: 'Syncing…', waiting });
  try {
    const seeded = await ensureSeeded();
    if (seeded.error) throw new Error(seeded.error);
    for (const t of TABLES) await push(t);
    for (const t of TABLES) await pull(t, userId);
    const now = new Date().toISOString();
    write(LAST_OK, now);
    setStatus({ state: 'idle', message: '', lastOk: now, waiting: await waitingCount() });
  } catch (e) {
    setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e), waiting: await waitingCount() });
  }
}

async function push(name: LocalName) {
  const local = table(name);
  const dirty = await local.where('dirty').equals(1).toArray();
  if (!dirty.length) return;

  // What Supabase already has for these rows, to respect a newer edit made elsewhere.
  const ids = dirty.map((r) => r.id);
  const { data: theirs, error } = await supabase.from(REMOTE[name]).select('id, updated_at').in('id', ids);
  if (error) throw new Error(error.message);
  const remoteAt = new Map((theirs ?? []).map((r) => [r.id as string, r.updated_at as string]));

  const send = dirty.filter((r) => sendLocal(r, remoteAt.get(r.id)));
  if (send.length) {
    const { error: upErr } = await supabase.from(REMOTE[name]).upsert(send.map(forRemote));
    if (upErr) throw new Error(upErr.message);
  }

  // Mark them sent, unless the row was edited again while this was in flight.
  await db.transaction('rw', local, async () => {
    for (const r of dirty) {
      const cur = await local.get(r.id);
      if (cur && cur.updated_at === r.updated_at) await local.put({ ...cur, dirty: 0 });
    }
  });
}

async function pull(name: LocalName, userId: string) {
  const local = table(name);
  const key = CURSOR(userId, name);
  const { data, error } = await supabase.from(REMOTE[name]).select('*').gt('updated_at', pullFrom(read(key))).order('updated_at');
  if (error) throw new Error(error.message);
  if (!data?.length) return;

  await db.transaction('rw', local, async () => {
    for (const row of data) {
      const mine = await local.get(row.id);
      if (takeRemote(mine, row)) await local.put({ ...row, dirty: 0 });
    }
  });
  write(key, data[data.length - 1].updated_at);
}

// Forget where each pull stopped, so the next sync pulls everything again.
export function resetPullCursors(userId: string) {
  TABLES.forEach((t) => {
    try {
      localStorage.removeItem(CURSOR(userId, t));
    } catch {
      /* nothing saved */
    }
  });
}

// Sync on open, when signal returns, when the app comes back on screen, and every 30 s.
export function startAutoSync(): () => void {
  const kick = () => void syncNow();
  const visible = () => document.visibilityState === 'visible' && kick();
  window.addEventListener('online', kick);
  window.addEventListener('offline', kick);
  document.addEventListener('visibilitychange', visible);
  const timer = setInterval(() => document.visibilityState === 'visible' && kick(), 30_000);
  kick();
  return () => {
    window.removeEventListener('online', kick);
    window.removeEventListener('offline', kick);
    document.removeEventListener('visibilitychange', visible);
    clearInterval(timer);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the next sync just pulls a little more */
  }
}
