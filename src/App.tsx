import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

// Step 1 placeholder: proves install, offline open, and the Supabase login.
// The real screens (Today, Tracker, ...) replace this from step 4 on.
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-8 py-10">
      <div className="flex flex-col items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-24 w-24" />
        <h1 className="text-4xl font-black tracking-wide">BIG4</h1>
        <p className={`text-sm ${online ? 'text-steel' : 'text-plate'}`}>
          {online ? 'Online' : 'No signal: working offline'}
        </p>
      </div>

      {checking ? null : session ? <SignedIn session={session} /> : <SignIn online={online} />}
    </main>
  );
}

function SignedIn({ session }: { session: Session }) {
  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-6 text-center">
      <p className="text-steel">Connected as</p>
      <p className="font-bold break-all">{session.user.email}</p>
      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-2 rounded-xl border border-line px-5 py-3 text-steel active:bg-line"
      >
        Sign out
      </button>
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
    <form onSubmit={submit} className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-panel p-6">
      <p className="text-center text-steel">Same login as Ironframe</p>
      <input
        type="email"
        autoComplete="username"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl border border-line bg-ink px-4 py-3 text-base outline-none focus:border-plate"
        required
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-xl border border-line bg-ink px-4 py-3 text-base outline-none focus:border-plate"
        required
      />
      {error && <p className="text-sm text-plate">{error}</p>}
      <button
        type="submit"
        disabled={busy || !online}
        className="mt-1 rounded-xl bg-plate py-3 font-bold active:bg-plate-dark disabled:opacity-50"
      >
        {!online ? 'Sign in needs signal' : busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
