// Server-rendered SVG line chart for an item's price history.
// No client JS — exact values live in the table below.

export interface PricePoint {
  capturedAt: Date;
  amount: number;
  originalAmount?: number | null;
}

interface Props {
  points: PricePoint[];
  currency: string;
  windowStart: Date;
  windowEnd: Date;
}

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 14, right: 56, bottom: 24, left: 8 };

export function PriceChart({ points, currency, windowStart, windowEnd }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-card p-10 text-sm text-muted-foreground">
        No prices observed in this window.
      </div>
    );
  }

  // Sort ascending by time; downstream rendering assumes that order.
  const sorted = [...points].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  const xMin = windowStart.getTime();
  const xMax = windowEnd.getTime();
  const xSpan = Math.max(1, xMax - xMin);

  const amounts = sorted.map((p) => p.amount);
  const originals = sorted
    .map((p) => p.originalAmount)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const allValues = [...amounts, ...originals];
  const yMinRaw = Math.min(...allValues);
  const yMaxRaw = Math.max(...allValues);
  // Pad the y-axis so points don't sit on the edges; collapse to ±5% if the
  // series is flat.
  const yPad = yMaxRaw === yMinRaw ? Math.max(1, yMaxRaw * 0.05) : (yMaxRaw - yMinRaw) * 0.1;
  const yMin = Math.max(0, yMinRaw - yPad);
  const yMax = yMaxRaw + yPad;
  const ySpan = Math.max(1, yMax - yMin);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (ts: number) => PAD.left + ((ts - xMin) / xSpan) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / ySpan) * plotH;

  const linePath = polyline(sorted.map((p) => [x(p.capturedAt.getTime()), y(p.amount)]));
  const originalPath = polyline(
    sorted
      .filter((p) => p.originalAmount != null)
      .map((p) => [x(p.capturedAt.getTime()), y(p.originalAmount as number)]),
  );

  const yTicks = makeTicks(yMin, yMax, 3);
  const formatMoney = makeMoneyFormatter(currency);

  return (
    <div className="rounded-md border bg-card p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-44 w-full"
        role="img"
        aria-label={`Price history in ${currency}`}
      >
        {/* y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={WIDTH - PAD.right + 4}
              y={y(t)}
              className="fill-muted-foreground font-mono"
              fontSize={10}
              dominantBaseline="middle"
            >
              {formatMoney(t)}
            </text>
          </g>
        ))}

        {/* original price overlay (dashed) */}
        {originalPath ? (
          <path
            d={originalPath}
            fill="none"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            className="stroke-muted-foreground/70"
          />
        ) : null}

        {/* actual price line */}
        {linePath ? (
          <path d={linePath} fill="none" strokeWidth={2} className="stroke-primary" />
        ) : null}

        {/* observation dots */}
        {sorted.map((p) => (
          <circle
            key={`${p.capturedAt.getTime()}-${p.amount}`}
            cx={x(p.capturedAt.getTime())}
            cy={y(p.amount)}
            r={2.5}
            className="fill-primary"
          />
        ))}

        {/* x-axis date labels */}
        <text x={PAD.left} y={HEIGHT - 6} className="fill-muted-foreground font-mono" fontSize={10}>
          {formatDate(windowStart)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 6}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize={10}
        >
          {formatDate(windowEnd)}
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-4 text-[10px] text-muted-foreground">
        <Legend label="Price" className="bg-primary" />
        {originals.length > 0 ? (
          <Legend label="Original" className="bg-muted-foreground/70" />
        ) : null}
        <span className="ml-auto font-mono">
          {sorted.length} obs · {formatMoney(Math.min(...amounts))}–
          {formatMoney(Math.max(...amounts))}
        </span>
      </div>
    </div>
  );
}

function Legend({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-0.5 w-3 ${className}`} />
      {label}
    </span>
  );
}

function polyline(coords: Array<[number, number]>): string | null {
  if (coords.length === 0) return null;
  const first = coords[0];
  if (!first) return null;
  let d = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let i = 1; i < coords.length; i++) {
    const c = coords[i];
    if (!c) continue;
    d += ` L ${c[0].toFixed(2)} ${c[1].toFixed(2)}`;
  }
  return d;
}

function makeTicks(min: number, max: number, count: number): number[] {
  if (count <= 1 || max === min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function makeMoneyFormatter(currency: string): (v: number) => string {
  try {
    const f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    return (v) => f.format(v);
  } catch {
    return (v) => `${Math.round(v)} ${currency}`;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
