import { useEffect, useRef, useState } from 'react';
import { beep, beepOn, setBeepOn } from '../lib/beep';
import Sideways from './Sideways';

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
    // Resting: bright-to-dark red with bright white numbers. Last 3 seconds: flashes white.
    // Time's up: white screen, red LIFT. Tap anywhere to go.
    <Sideways z={60} className={over ? 'bg-white text-plate' : flashing ? 'animate-[flash_0.5s_steps(1)_infinite] text-white' : 'rest-red text-white'}>
      <div onClick={over ? onClose : undefined} className="flex h-full flex-col items-center justify-center pb-[18cqh]">
        <p className="text-[7cqh] leading-none font-black tracking-[0.3em] uppercase opacity-80">{over ? 'Time' : 'Rest'}</p>
        <p className="text-[min(48cqh,30cqw)] leading-none font-black tabular-nums">{over ? 'LIFT' : `${mm}:${ss}`}</p>
        {next && <p className="text-center text-[7cqh] leading-tight font-black uppercase">Next: {next}</p>}
      </div>

      <div className="absolute right-3 bottom-3 left-3 flex gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            setBeepOn(!sound);
            setSound(!sound);
          }}
          className={`min-h-[16cqh] flex-1 rounded-2xl border-2 text-[5cqh] font-black tracking-wide uppercase ${over ? 'border-plate' : 'border-white/60'}`}
        >
          Beep {sound ? 'on' : 'off'}
        </button>
        <button
          onClick={onClose}
          className={`min-h-[16cqh] flex-[2] rounded-2xl text-[7cqh] font-black tracking-wide uppercase ${over ? 'bg-plate text-white' : 'bg-white text-plate-dark'}`}
        >
          {over ? 'Go' : 'Skip rest'}
        </button>
      </div>
    </Sideways>
  );
}
