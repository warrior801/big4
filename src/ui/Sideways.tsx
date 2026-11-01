import { useEffect, useState, type ReactNode } from 'react';

// A web app can't turn the iPhone sideways, so this draws its content already turned:
// held upright, the content is rotated a quarter turn and fills the screen the long way;
// held sideways (rotation lock off), it lays out normally. Turn the phone left to read it.
// Children size themselves with container units (cqw / cqh), which follow the turned box.
export function useUpright() {
  const [upright, setUpright] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const check = () => setUpright(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return upright;
}

export default function Sideways({ children, className = '', z = 50 }: { children: ReactNode; className?: string; z?: number }) {
  const upright = useUpright();
  const box = upright
    ? {
        width: '100dvh',
        height: '100vw',
        transform: 'rotate(90deg) translateY(-100%)',
        transformOrigin: 'top left',
        // the notch ends up on the left of the turned box, the home bar on the right
        padding: '12px max(12px, env(safe-area-inset-bottom)) 12px max(12px, env(safe-area-inset-top))',
      }
    : { inset: 0, padding: '12px max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))' };

  return (
    <div className={`fixed top-0 left-0 flex flex-col [container-type:size] ${className}`} style={{ ...box, zIndex: z }}>
      {children}
    </div>
  );
}
