// One side of the bar, drawn the way it's loaded: biggest plate against the collar.
const STYLE: Record<string, { h: number; w: number; fill: string; text: string }> = {
  '45': { h: 100, w: 30, fill: '#d62828', text: '#f4f4f2' },
  '35': { h: 88, w: 26, fill: '#f4f4f2', text: '#14161a' },
  '25': { h: 74, w: 24, fill: '#9aa1ab', text: '#14161a' },
  '10': { h: 56, w: 18, fill: '#3a3f48', text: '#f4f4f2' },
  '5': { h: 44, w: 16, fill: '#5b616c', text: '#f4f4f2' },
  '2.5': { h: 36, w: 14, fill: '#a81e1e', text: '#f4f4f2' },
  '1.25': { h: 30, w: 12, fill: '#c9cdd3', text: '#14161a' },
};

export default function BarDrawing({ plates }: { plates: number[] }) {
  const gap = 3;
  const collar = 16;
  const width = Math.max(150, collar + plates.reduce((sum, p) => sum + (STYLE[String(p)]?.w ?? 16) + gap, 0) + 40);
  let x = collar + 6;

  return (
    <svg viewBox={`0 0 ${width} 110`} className="h-auto w-full max-h-[30vh]" role="img" aria-label={plates.length ? `${plates.join(', ')} per side` : 'Empty bar'}>
      {/* sleeve and collar */}
      <rect x={0} y={49} width={width} height={12} rx={3} fill="#2c3038" />
      <rect x={0} y={38} width={collar} height={34} rx={3} fill="#9aa1ab" />
      {plates.map((p, i) => {
        const s = STYLE[String(p)] ?? STYLE['5'];
        const left = x;
        x += s.w + gap;
        return (
          <g key={i}>
            <rect x={left} y={55 - s.h / 2} width={s.w} height={s.h} rx={4} fill={s.fill} stroke="#14161a" strokeWidth={1.5} />
            <text
              x={left + s.w / 2}
              y={55}
              fill={s.text}
              fontSize={s.w > 20 ? 13 : 10}
              fontWeight={900}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(-90 ${left + s.w / 2} 55)`}
            >
              {p}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
