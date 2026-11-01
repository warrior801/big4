import { describe, expect, it } from 'vitest';
import { forRemote, pullFrom, sendLocal, takeRemote } from './merge';

const at = (iso: string, dirty: 0 | 1 = 0) => ({ updated_at: iso, dirty });

describe('last write wins', () => {
  it('takes a row the phone has never seen', () => {
    expect(takeRemote(undefined, at('2026-11-02T08:00:00Z'))).toBe(true);
  });

  it('takes the remote copy only when it is newer', () => {
    expect(takeRemote(at('2026-11-02T08:00:00Z'), at('2026-11-02T09:00:00Z'))).toBe(true);
    expect(takeRemote(at('2026-11-02T09:00:00Z'), at('2026-11-02T08:00:00Z'))).toBe(false);
  });

  it('lets a newer desktop edit beat an older unsent phone edit', () => {
    expect(takeRemote(at('2026-11-02T08:00:00Z', 1), at('2026-11-02T09:00:00Z'))).toBe(true);
  });

  it('keeps an unsent phone edit that is newer than the remote copy', () => {
    expect(takeRemote(at('2026-11-02T10:00:00Z', 1), at('2026-11-02T09:00:00Z'))).toBe(false);
  });

  it('sends a phone row when Supabase has none or an older copy', () => {
    expect(sendLocal(at('2026-11-02T08:00:00Z', 1), undefined)).toBe(true);
    expect(sendLocal(at('2026-11-02T09:00:00Z', 1), '2026-11-02T08:00:00Z')).toBe(true);
    expect(sendLocal(at('2026-11-02T08:00:00Z', 1), '2026-11-02T08:00:00Z')).toBe(true);
  });

  it('does not overwrite a newer copy in Supabase', () => {
    expect(sendLocal(at('2026-11-02T08:00:00Z', 1), '2026-11-02T09:00:00Z')).toBe(false);
  });

  it('compares real times, not text (Supabase writes +00:00, the phone writes Z)', () => {
    expect(sendLocal(at('2026-11-02T08:00:00.000Z', 1), '2026-11-02T08:00:00+00:00')).toBe(true);
    expect(takeRemote(at('2026-11-02T08:00:00.500Z'), at('2026-11-02T08:00:00+00:00'))).toBe(false);
  });
});

describe('pull window', () => {
  it('pulls everything the first time', () => {
    expect(pullFrom(null)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('overlaps the last pull by a day for slow clocks', () => {
    expect(pullFrom('2026-11-03T08:00:00.000Z')).toBe('2026-11-02T08:00:00.000Z');
  });
});

describe('sending', () => {
  it('drops the phone-only dirty flag', () => {
    expect(forRemote({ id: 'a', updated_at: 'x', dirty: 1 as const })).toEqual({ id: 'a', updated_at: 'x' });
  });
});
