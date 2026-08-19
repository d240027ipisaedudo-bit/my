import { useMemo, useState } from 'react';

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 220, formatValue }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / Math.max(data.length, 1);

  return (
    <div className="w-full" style={{ height }}>
      <div className="relative h-full flex items-end gap-2 px-2">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 40);
          return (
            <div
              key={i}
              className="relative flex-1 flex flex-col items-center justify-end group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div className="absolute -top-2 z-10 px-2.5 py-1.5 rounded-lg bg-ink-900 dark:bg-ink-700 text-white text-xs font-semibold whitespace-nowrap shadow-lg -translate-y-full">
                  {formatValue ? formatValue(d.value) : d.value}
                </div>
              )}
              <div
                className="w-full max-w-[48px] rounded-t-lg transition-all duration-300 hover:opacity-80"
                style={{
                  height: Math.max(h, 2),
                  background: d.color ?? 'linear-gradient(to top, #f97316, #fb923c)',
                }}
              />
              <span className="mt-2 text-[11px] text-slate-500 dark:text-ink-400 font-medium text-center truncate w-full">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function LineChart({ data, height = 220, color = '#f97316', formatValue }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 600;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);

  const points = data.map((d, i) => {
    const x = padLeft + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padTop + chartH - ((d.value - min) / Math.max(max - min, 1)) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
    : '';
  const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z` : '';

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padLeft}
            x2={width - padRight}
            y1={padTop + chartH * t}
            y2={padTop + chartH * t}
            className="stroke-slate-200 dark:stroke-ink-800"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}
        {areaD && <path d={areaD} fill="url(#lineGrad)" />}
        {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x - chartW / data.length / 2}
              y={padTop}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
            {hoverIdx === i && <circle cx={p.x} cy={p.y} r="5" fill={color} stroke="white" strokeWidth="2" />}
            <circle cx={p.x} cy={p.y} r="3" fill={color} />
          </g>
        ))}
        {data.map((d, i) => {
          const x = padLeft + (i / Math.max(data.length - 1, 1)) * chartW;
          return (
            <text key={i} x={x} y={height - 8} textAnchor="middle" className="fill-slate-400 dark:fill-ink-500" fontSize="10">
              {d.label}
            </text>
          );
        })}
      </svg>
      {hoverIdx !== null && (
        <div
          className="relative -mt-4 pointer-events-none"
          style={{ marginLeft: `${(points[hoverIdx].x / width) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="inline-block px-2.5 py-1 rounded-lg bg-ink-900 dark:bg-ink-700 text-white text-xs font-semibold whitespace-nowrap">
            {formatValue ? formatValue(data[hoverIdx].value) : data[hoverIdx].value}
          </div>
        </div>
      )}
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  formatValue?: (v: number) => string;
}

export function DonutChart({ data, size = 180, formatValue }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2 - 10;
  const innerRadius = radius * 0.62;
  const cx = size / 2;
  const cy = size / 2;

  const segments = useMemo(() => {
    let angle = -Math.PI / 2;
    return data.map((d) => {
      const fraction = d.value / total;
      const startAngle = angle;
      const endAngle = angle + fraction * Math.PI * 2;
      angle = endAngle;
      const largeArc = fraction > 0.5 ? 1 : 0;
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const x3 = cx + innerRadius * Math.cos(endAngle);
      const y3 = cy + innerRadius * Math.sin(endAngle);
      const x4 = cx + innerRadius * Math.cos(startAngle);
      const y4 = cy + innerRadius * Math.sin(startAngle);
      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
      return { path, ...d, fraction };
    });
  }, [data, total, radius, innerRadius, cx, cy]);

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {segments.map((seg, i) => (
            <path
              key={i}
              d={seg.path}
              fill={seg.color}
              className="transition-opacity duration-200 cursor-pointer"
              style={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-display text-ink-900 dark:text-white">
            {formatValue ? formatValue(total) : total}
          </span>
          <span className="text-xs text-slate-400 dark:text-ink-500">Total</span>
        </div>
      </div>
      <div className="space-y-2 min-w-[140px]">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-sm text-ink-700 dark:text-ink-300 flex-1">{d.label}</span>
            <span className="text-sm font-semibold text-ink-900 dark:text-white">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
