// The optional beep at the end of a rest. iPhones only allow sound that a tap unlocked,
// so primeAudio() runs on the tap that logs a set, and beep() plays later.
// The on/off choice is saved on this phone only until the Settings screen (step 10).

const KEY = 'big4.beep';
let ctx: AudioContext | null = null;

export function beepOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setBeepOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: stays off */
  }
  if (on) primeAudio();
}

export function primeAudio() {
  if (!beepOn()) return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function beep() {
  if (!beepOn() || !ctx) return;
  // three short high beeps, loud enough to cut through gym music
  [0, 0.25, 0.5].forEach((t) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.frequency.value = 1320;
    gain.gain.setValueAtTime(0.6, ctx!.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + t + 0.18);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(ctx!.currentTime + t);
    osc.stop(ctx!.currentTime + t + 0.2);
  });
}
