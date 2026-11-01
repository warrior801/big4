import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { STR_TABLES, missingTables } from './lib/tables';
import { downloadBasics } from './lib/download';
import PlateCalc from './PlateCalc';
import Today from './Today';
import { BigButton } from './ui/Overlay';

type Tab = 'today' | 'plates' | 'me';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [tab, setTab] = useState<Tab>('today');
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  // With signal: make sure the lifts exist and copy them to the phone.
  const userId = session?.user.id;
  useEffect(() => {
    if (userId && online) downloadBasics().then(setDownloadError);
  }, [userId, online]);

  if (checking) return null;
  if (!session) return <SignIn online={online} />;

  return (
    <div className="mx-auto max-w-xl pb-28">
      {!online && <p className="pt-3 text-center text-lg font-black tracking-widest text-plate">NO SIGNAL · SAVING ON THE PHONE</p>}
      {downloadError && <p className="pt-3 text-center text-lg font-black text-plate">Download problem: {downloadError}</p>}

      {tab === 'today' && <Today userId={session.user.id} />}
      {tab === 'plates' && <PlateCalc />}
      {tab === 'me' && <Me session={session} online={online} />}

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

function Me({ session, online }: { session: Session; online: boolean }) {
  return (
    <div className="pb-6">
      <header className="pt-6 pb-4">
        <img src="/icon-192.png" alt="" className="h-24 w-24" />
        <h1 className="mt-3 text-[15vw] leading-[0.9] font-black tracking-tight sm:text-8xl">BIG4</h1>
      </header>
      <p className="text-xl font-black tracking-widest text-steel">SIGNED IN AS</p>
      <p className="text-2xl font-black break-all">{session.user.email}</p>
      <div className="mt-4">
        <DatabaseCheck online={online} />
      </div>
      <BigButton tone="ghost" onClick={() => void supabase.auth.signOut()} className="mt-8 w-full">
        Sign out
      </BigButton>
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
