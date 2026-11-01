// Last write wins: whichever copy of a row was changed more recently is the one kept.
// Kept apart from sync.ts so the rule can be tested without a database.

export type Stamped = { updated_at: string; dirty?: 0 | 1 };

// A row came down from Supabase. Should it replace the phone's copy?
export function takeRemote(local: Stamped | undefined, remote: Stamped): boolean {
  if (!local) return true;
  return Date.parse(remote.updated_at) > Date.parse(local.updated_at);
}

// The phone wants to send a row. Should it overwrite Supabase's copy?
// No copy there yet, or the phone's is newer (ties go to the phone: it's the same edit).
export function sendLocal(local: Stamped, remoteUpdatedAt: string | undefined): boolean {
  if (!remoteUpdatedAt) return true;
  return Date.parse(local.updated_at) >= Date.parse(remoteUpdatedAt);
}

// Where the next pull starts. A day of overlap covers a device whose clock runs slow.
export function pullFrom(lastSeen: string | null): string {
  if (!lastSeen) return '1970-01-01T00:00:00.000Z';
  return new Date(Date.parse(lastSeen) - 24 * 3_600_000).toISOString();
}

// Supabase columns only: the phone's bookkeeping field stays on the phone.
export function forRemote<T extends Stamped>(row: T): Omit<T, 'dirty'> {
  const copy = { ...row };
  delete copy.dirty;
  return copy;
}
