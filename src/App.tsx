import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { STR_TABLES, missingTables } from './lib/tables';
import { clearTestData } from './lib/reset';
import { onSyncStatus, startAutoSync, syncNow, waitingCount, type SyncStatus } from './lib/sync';
import PlateCalc from './PlateCalc';
import Today from './Today';
import { BigButton } from './ui/Overlay';

type Tab = 'today' | 'plates' | 'me';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [tab, setTab] = useState<Tab>('today');
  const [sync, setSync] = useState<SyncStatus | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Signed in: keep the phone and Supabase in step (see lib/sync.ts for when it runs).
  const userId = session?.user.id;
  useEffect(() => (userId ? startAutoSync() : undefined), [userId]);
  useEffect(() => onSyncStatus(setSync), []);

  if (checking) return null;
  if (!session) return <SignIn online={online} />;

  return (
    <div className="mx-auto max-w-xl pb-28">
      {!online && <p className="pt-3 text-center text-lg font-black tracking-widest text-plate">NO SIGNAL · SAVING ON THE PHONE</p>}
      {sync?.state === 'error' && <p className="pt-3 text-center text-lg font-black text-plate">SYNC PROBLEM · SEE ME</p>}

      {tab === 'today' && <Today userId={session.user.id} />}
      {tab === 'plates' && <PlateCalc />}
      {tab === 'me' && <Me session={session} online={online} sync={sync} />}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-ink"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {(['today', 'plates', 'me'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-4 text-xl font-black tracking-widest uppercase ${tab === t ? 'text-plate' : 'text-steel'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Me({ session, online, sync }: { session: Session; online: boolean; sync: SyncStatus | null }) {
  return (
    <div className="pb-6">
      <header className="pt-6 pb-4">
        <img src="/icon-192.png" alt="" className="h-24 w-24" />
        <h1 className="mt-3 text-[15vw] leading-[0.9] font-black tracking-tight sm:text-8xl">BIG4</h1>
      </header>
      <p className="text-xl font-black tracking-widest text-steel">SIGNED IN AS</p>
      <p className="text-2xl font-black break-all">{session.user.email}</p>
      <SyncPanel sync={sync} online={online} />
      <div className="mt-6">
        <DatabaseCheck online={online} />
      </div>
      <ClearTestData online={online} />
      <BigButton tone="ghost" onClick={() => void supabase.auth.signOut()} className="mt-4 w-full">
        Sign out
      </BigButton>
    </div>
  );
}

function SyncPanel({ sync, online }: { sync: SyncStatus | null; online: boolean }) {
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    void waitingCount().then(setWaiting);
  }, [sync]);

  const ago = (iso: string) => {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    return min < 1 ? 'JUST NOW' : min < 60 ? `${min} MIN AGO` : `${Math.round(min / 60)} H AGO`;
  };
  const line =
    sync?.state === 'syncing'
      ? 'SYNCING…'
      : !online
        ? 'NO SIGNAL · SAVED ON THE PHONE'
        : sync?.state === 'error'
          ? 'SYNC PROBLEM'
          : sync?.lastOk
            ? `SYNCED ${ago(sync.lastOk)}`
            : 'NOT SYNCED YET';

  return (
    <div className="mt-6 rounded-3xl border-2 border-line p-5">
      <p className="text-xl font-black tracking-widest text-steel">SYNC</p>
      <p className={`text-3xl font-black ${sync?.state === 'error' ? 'text-plate' : ''}`}>{line}</p>
      {waiting !== null && waiting > 0 && <p className="mt-1 text-xl font-black text-plate">{waiting} CHANGES WAITING TO SEND</p>}
      {sync?.state === 'error' && <p className="mt-1 text-lg font-bold break-words text-steel">{sync.message}</p>}
      <BigButton tone="ghost" disabled={!online || sync?.state === 'syncing'} onClick={() => void syncNow()} className="mt-4 w-full">
        Sync now
      </BigButton>
    </div>
  );
}

// Erase test workouts and start weights, on Supabase and this phone, before real training begins.
function ClearTestData({ online }: { online: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  return (
    <div className="mt-8">
      <BigButton
        tone="ghost"
        disabled={!online || status === 'working'}
        onClick={async () => {
          if (!confirm('Erase every workout, start weight, prep and pain entry, on this phone and in Supabase? This cannot be undone.')) return;
          setStatus('working');
          const err = await clearTestData();
          setStatus(err ? `Problem: ${err}` : 'done');
        }}
        className="w-full border-plate text-plate"
      >
        {!online ? 'Clear test data needs signal' : status === 'working' ? 'Clearing…' : 'Clear test data'}
      </BigButton>
      {status === 'done' && <p className="mt-2 text-xl font-black">CLEARED. ALL LIFTS BACK TO NO START WEIGHT.</p>}
      {status?.startsWith('Problem') && <p className="mt-2 text-xl font-black text-plate">{status}</p>}
    </div>
  );
}

// Are all twelve str_ tables in Supabase?
function DatabaseCheck({ online }: { online: boolean }) {
  const [missing, setMissing] = useState<string[] | null>(null);

  useEffect(() => {
    if (online) missingTables().then(setMissing);
  }, [online]);

  if (!online) return <p className="text-xl font-black text-steel">DATABASE CHECK NEEDS SIGNAL</p>;
  if (missing === null) return <p className="text-xl font-black text-steel">CHECKING DATABASE…</p>;

  const ready = STR_TABLES.length - missing.length;
  return (
    <div>
      <p className={`text-xl font-black ${missing.length ? 'text-plate' : ''}`}>
        DATABASE: {ready} OF {STR_TABLES.length} TABLES READY
      </p>
      {missing.length > 0 && <p className="mt-1 break-all text-steel">Missing: {missing.join(', ')}</p>}
    </div>
  );
}

function SignIn({ online }: { online: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-28 w-28" />
        <h1 className="text-7xl font-black tracking-tight">BIG4</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border-2 border-line bg-panel px-4 py-4 text-xl font-bold outline-none focus:border-plate"
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl border-2 border-line bg-panel px-4 py-4 text-xl font-bold outline-none focus:border-plate"
          required
        />
        {error && <p className="text-lg font-bold text-plate">{error}</p>}
        <button
          type="submit"
          disabled={busy || !online}
          className="min-h-16 rounded-2xl bg-plate text-2xl font-black tracking-wide uppercase active:bg-plate-dark disabled:opacity-50"
        >
          {!online ? 'Sign in needs signal' : busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-lg font-bold text-steel">Same login as Ironframe</p>
      </form>
    </main>
  );
}
