import type { ReactNode } from 'react';

// Full-screen pop-up shell: covers everything, respects the iPhone notch and home bar.
export default function Overlay({ children, onClose, tone = 'ink' }: { children: ReactNode; onClose?: () => void; tone?: 'ink' | 'plate' }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${tone === 'plate' ? 'bg-plate' : 'bg-ink'}`}
      style={{ padding: 'env(safe-area-inset-top) 16px env(safe-area-inset-bottom)' }}
    >
      {onClose && (
        <button onClick={onClose} className="self-end px-2 py-4 text-lg font-black tracking-widest text-steel uppercase" aria-label="Close">
          Close
        </button>
      )}
      {children}
    </div>
  );
}

// Big chunky button used across the pop-ups.
export function BigButton({
  children,
  onClick,
  tone = 'plate',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'plate' | 'ghost' | 'chalk';
  disabled?: boolean;
  className?: string;
}) {
  const look =
    tone === 'plate'
      ? 'bg-plate text-chalk active:bg-plate-dark'
      : tone === 'chalk'
        ? 'bg-chalk text-ink active:bg-steel'
        : 'border-2 border-line text-chalk active:bg-line';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-16 rounded-2xl px-4 text-2xl font-black tracking-wide uppercase disabled:opacity-40 ${look} ${className}`}
    >
      {children}
    </button>
  );
}
