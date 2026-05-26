// Server-rendered SVG timeline showing each location's stock status as a
// colored band over time. One row per location.

type StockStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'preorder'
  | 'backorder'
  | 'discontinued'
  | 'unknown';

export interface StockObs {
  capturedAt: Date;
  status: StockStatus;
}

export interface LocationSeries {
  locationId: string;
  locationName: string;
  locationKind: 'physical' | 'online';
  observations: StockObs[];
}

interface Props {
  series: LocationSeries[];
  windowStart: Date;
  windowEnd: Date;
}

const STATUS_FILL: Record<StockStatus, string> = {
  in_stock: 'fill-emerald-500',
  low_stock: 'fill-amber-500',
  out_of_stock: 'fill-rose-500',
  preorder: 'fill-sky-500',
  backorder: 'fill-violet-500',
  discontinued: 'fill-stone-500',
  unknown: 'fill-muted-foreground/40',
};

const STATUS_BG: Record<StockStatus, string> = {
  in_stock: 'bg-emerald-500',
  low_stock: 'bg-amber-500',
  out_of_stock: 'bg-rose-500',
  preorder: 'bg-sky-500',
  backorder: 'bg-violet-500',
  discontinued: 'bg-stone-500',
  unknown: 'bg-muted-foreground/40',
};

const WIDTH = 720;
const ROW_HEIGHT = 22;
const ROW_GAP = 8;
const PAD = { top: 6, right: 8, bottom: 22, left: 140 };

export function StockTimeline({ series, windowStart, windowEnd }: Props) {
  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-card p-10 text-sm text-muted-foreground">
        No stock observations in this window.
      </div>
    );
  }

  const xMin = windowStart.getTime();
  const xMax = windowEnd.getTime();
  const xSpan = Math.max(1, xMax - xMin);
  const plotW = WIDTH - PAD.left - PAD.right;
  const x = (ts: number) =>
    PAD.left + ((Math.min(xMax, Math.max(xMin, ts)) - xMin) / xSpan) * plotW;

  const height = PAD.top + series.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + PAD.bottom;

  // Unique statuses observed, for the legend.
  const seenStatuses = new Set<StockStatus>();
  for (const s of series) for (const obs of s.observations) seenStatuses.add(obs.status);

  return (
    <div className="rounded-md border bg-card p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        style={{ height: `${height}px` }}
        role="img"
        aria-label="Stock timeline"
      >
        {series.map((row, idx) => {
          const yTop = PAD.top + idx * (ROW_HEIGHT + ROW_GAP);
          const segments = toSegments(row.observations, windowStart, windowEnd);
          return (
            <g key={row.locationId}>
              <text
                x={PAD.left - 8}
                y={yTop + ROW_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                className="fill-foreground"
              >
                {row.locationName}
              </text>
              <text
                x={PAD.left - 8}
                y={yTop + ROW_HEIGHT / 2 + 11}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                className="fill-muted-foreground"
              >
                {row.locationKind}
              </text>
              {/* row background — clarifies the no-data state */}
              <rect
                x={PAD.left}
                y={yTop}
                width={plotW}
                height={ROW_HEIGHT}
                className="fill-muted/40"
                rx={2}
              />
              {segments.map((seg) => {
                const x1 = x(seg.from.getTime());
                const x2 = x(seg.to.getTime());
                const w = Math.max(1, x2 - x1);
                return (
                  <rect
                    key={`${row.locationId}-${seg.from.getTime()}`}
                    x={x1}
                    y={yTop}
                    width={w}
                    height={ROW_HEIGHT}
                    className={STATUS_FILL[seg.status]}
                    rx={2}
                  >
                    <title>{`${seg.status} · ${formatDate(seg.from)} → ${formatDate(seg.to)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* x-axis date labels */}
        <text x={PAD.left} y={height - 6} fontSize={10} className="fill-muted-foreground font-mono">
          {formatDate(windowStart)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={height - 6}
          textAnchor="end"
          fontSize={10}
          className="fill-muted-foreground font-mono"
        >
          {formatDate(windowEnd)}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        {[...seenStatuses].map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-3 rounded-sm ${STATUS_BG[s]}`} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Segment {
  from: Date;
  to: Date;
  status: StockStatus;
}

// Each observation describes the status starting at its capturedAt and
// holding until the next observation (or the window end for the last one).
// Observations before the window are clipped to start at windowStart so the
// chart shows the prevailing state even if its last change predates the
// window.
function toSegments(obs: StockObs[], windowStart: Date, windowEnd: Date): Segment[] {
  if (obs.length === 0) return [];
  const sorted = [...obs].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  const segs: Segment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (!cur) continue;
    const start = cur.capturedAt < windowStart ? windowStart : cur.capturedAt;
    const next = sorted[i + 1];
    const end = next ? next.capturedAt : windowEnd;
    if (end <= windowStart || start >= windowEnd) continue;
    segs.push({
      from: start,
      to: end > windowEnd ? windowEnd : end,
      status: cur.status,
    });
  }
  return segs;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
