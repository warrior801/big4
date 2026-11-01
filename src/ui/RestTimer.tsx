import { useEffect, useRef, useState } from 'react';
import { beep, beepOn, setBeepOn } from '../lib/beep';

// The big rest timer. Counts down from the clock time the set was logged, so it stays
// right if the phone locks. Flashes red for the last 3 seconds, then says LIFT.
export default function RestTimer({ endsAt, next, onClose }: { endsAt: number; next: string | null; onClose: () => void }) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [sound, setSound] = useState(beepOn());
  const beeped = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  // Keep the screen awake while resting. iOS drops the lock when the app is hidden, so ask again on return.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const grab = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen');
      } catch {
        /* not supported: the screen may dim, the timer still counts */
      }
    };
    void grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      document.removeEventListener('visibilitychange', grab);
      void lock?.release();
    };
  }, []);

  const left = Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
  const over = left === 0;
  const flashing = left > 0 && left <= 3;

  useEffect(() => {
    if (over && !beeped.current) {
      beeped.current = true;
      beep();
    }
  }, [over]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div
      onClick={over ? onClose : undefined}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center ${over ? 'bg-plate' : flashing ? 'animate-[flash_0.5s_steps(1)_infinite]' : 'bg-ink'}`}
      style={{ padding: 'env(safe-area-inset-top) 16px env(safe-area-inset-bottom)' }}
    >
      <p className="text-2xl font-black tracking-[0.3em] text-steel uppercase">{over ? '' : 'Rest'}</p>
      <p className="text-[min(36vw,58vh)] leading-none font-black tabular-nums">{over ? 'LIFT' : `${mm}:${ss}`}</p>
      {next && <p className="mt-4 text-center text-3xl font-black uppercase landscape:text-2xl">Next: {next}</p>}

      <div className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] flex gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            setBeepOn(!sound);
            setSound(!sound);
          }}
          className="min-h-16 flex-1 rounded-2xl border-2 border-line text-xl font-black tracking-wide uppercase"
        >
          Beep {sound ? 'on' : 'off'}
        </button>
        <button onClick={onClose} className="min-h-16 flex-[2] rounded-2xl bg-chalk text-2xl font-black tracking-wide text-ink uppercase">
          {over ? 'Go' : 'Skip rest'}
        </button>
      </div>
    </div>
  );
}
