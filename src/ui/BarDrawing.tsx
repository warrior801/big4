// The whole bar, loaded the way it sits in the rack: biggest plates against the collars,
// the same stack mirrored on both sides. `plates` is one side, heaviest first.
const STYLE: Record<string, { h: number; w: number; fill: string; text: string }> = {
  '45': { h: 100, w: 22, fill: '#d62828', text: '#f4f4f2' },
  '35': { h: 88, w: 19, fill: '#f4f4f2', text: '#14161a' },
  '25': { h: 74, w: 17, fill: '#9aa1ab', text: '#14161a' },
  '10': { h: 56, w: 13, fill: '#3a3f48', text: '#f4f4f2' },
  '5': { h: 44, w: 11, fill: '#5b616c', text: '#f4f4f2' },
  '2.5': { h: 36, w: 10, fill: '#a81e1e', text: '#f4f4f2' },
  '1.25': { h: 30, w: 9, fill: '#c9cdd3', text: '#14161a' },
};

const MID = 55; // vertical centre of the drawing
const GAP = 2;
const COLLAR = 8;
const SHAFT = 150; // the grip section between the collars, drawn short to save room

export default function BarDrawing({ plates }: { plates: number[] }) {
  const looks = plates.map((p) => ({ p, ...(STYLE[String(p)] ?? STYLE['5']) }));
  const stack = looks.reduce((sum, s) => sum + s.w + GAP, 0);
  const sleeve = Math.max(70, stack + 18);
  const width = 2 * sleeve + 2 * COLLAR + SHAFT;
  const leftCollar = sleeve;
  const rightCollar = sleeve + COLLAR + SHAFT;

  const plate = (s: (typeof looks)[number], x: number, key: string) => (
    <g key={key}>
      <rect x={x} y={MID - s.h / 2} width={s.w} height={s.h} rx={3} fill={s.fill} stroke="#14161a" strokeWidth={1.2} />
      <text
        x={x + s.w / 2}
        y={MID}
        fill={s.text}
        fontSize={s.w >= 17 ? 11 : 8}
        fontWeight={900}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(-90 ${x + s.w / 2} ${MID})`}
      >
        {s.p}
      </text>
    </g>
  );

  let left = leftCollar - GAP;
  let right = rightCollar + COLLAR + GAP;
  return (
    <svg viewBox={`0 0 ${width} 110`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={plates.length ? `${plates.join(', ')} each side` : 'Empty bar'}>
      {/* sleeves, then the thinner grip with knurl marks */}
      <rect x={0} y={MID - 6} width={width} height={12} rx={3} fill="#3a3f48" />
      <rect x={leftCollar + COLLAR} y={MID - 4} width={SHAFT} height={8} fill="#9aa1ab" />
      {Array.from({ length: 14 }, (_, k) => (
        <line key={k} x1={leftCollar + COLLAR + 12 + k * 9} x2={leftCollar + COLLAR + 16 + k * 9} y1={MID - 4} y2={MID + 4} stroke="#5b616c" strokeWidth={1} />
      ))}
      <rect x={leftCollar} y={MID - 16} width={COLLAR} height={32} rx={2} fill="#c9cdd3" />
      <rect x={rightCollar} y={MID - 16} width={COLLAR} height={32} rx={2} fill="#c9cdd3" />
      {looks.map((s, k) => {
        left -= s.w;
        const node = plate(s, left, `l${k}`);
        left -= GAP;
        return node;
      })}
      {looks.map((s, k) => {
        const node = plate(s, right, `r${k}`);
        right += s.w + GAP;
        return node;
      })}
    </svg>
  );
}
