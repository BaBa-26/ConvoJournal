// The Progress logo: a gold ring with a filled centre dot. Pure SVG so it scales crisply
// anywhere. `animate` plays the grow-in (ring expands, dot pops) — used once on the hero.
export default function BrandMark({
  size = 24,
  stroke = 8,
  dotR = 3.4,
  animate = false,
  className,
}: {
  size?: number;
  stroke?: number;
  dotR?: number;
  animate?: boolean;
  className?: string;
}) {
  const cls = [animate ? "bm-play" : null, className].filter(Boolean).join(" ") || undefined;
  return (
    <svg className={cls} viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <circle className="bm-ring" cx={50} cy={50} r={44} fill="none" stroke="#c8a878" strokeWidth={stroke} />
      <circle className="bm-dot" cx={50} cy={50} r={dotR} fill="#c8a878" />
    </svg>
  );
}
