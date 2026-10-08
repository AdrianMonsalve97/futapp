import { EmptyState } from '../atoms/EmptyState';

export interface PerfSeries {
  name: string;
  /** Clase Tailwind de relleno, p.ej. `fill-primary`. */
  fill: string;
}

export interface PerfItem {
  label: string;
  values: number[];
}

export interface PerformanceChartProps {
  series: PerfSeries[];
  items: PerfItem[];
  title?: string;
  /** Muestra la leyenda debajo del gráfico (por defecto sí). */
  showLegend?: boolean;
  className?: string;
}

const W = 440;
const H = 190;
const PAD = { l: 30, r: 10, t: 14, b: 36 };

/** Gráfico de barras SVG (series agrupadas) sin librerías externas. */
export function PerformanceChart({
  series,
  items,
  title,
  showLegend = true,
  className = '',
}: PerformanceChartProps) {
  const hasData = items.length > 0 && items.some((item) => item.values.some((value) => value > 0));

  return (
    <div className={className}>
      {title ? <h3 className="font-semibold text-sm mb-2">{title}</h3> : null}
      {!hasData ? (
        <EmptyState title="Sin datos para graficar" message="Cargá estadísticas de partidos para ver el comparativo." />
      ) : (
        <>
          <div className="chart-scroll overflow-x-auto" tabIndex={0} role="region" aria-label={`${title ?? 'Gráfico de barras'}: desliza para ver completo`}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title ?? 'Gráfico de barras'}>
            <Bars series={series} items={items} />
          </svg>
          </div>
          {showLegend ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-base-content/70">
              {series.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block w-3 h-3 rounded-sm ${s.fill.replace('fill-', 'bg-')}`} />
                  {s.name}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Capa interna: rejilla, ejes y barras. */
function Bars({ series, items }: { series: PerfSeries[]; items: PerfItem[] }) {
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxValue = Math.max(1, ...items.flatMap((item) => item.values.map((value) => (Number.isFinite(value) ? value : 0))));
  const niceMax = Math.max(1, Math.ceil(maxValue));
  const ticks = [0, 1, 2, 3, 4].map((i) => (niceMax * i) / 4);
  const groupW = innerW / Math.max(items.length, 1);
  const barW = Math.min(20, (groupW * 0.62) / Math.max(series.length, 1));
  const groupWidth = barW * series.length;

  return (
    <g>
      {ticks.map((tick) => {
        const y = PAD.t + innerH - (tick / niceMax) * innerH;
        return (
          <g key={tick}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} className="stroke-base-300" strokeWidth={0.8} strokeDasharray="3 3" />
            <text x={PAD.l - 5} y={y + 3} textAnchor="end" fontSize={8} className="fill-base-content/50">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          </g>
        );
      })}
      <line x1={PAD.l} y1={PAD.t + innerH} x2={W - PAD.r} y2={PAD.t + innerH} className="stroke-base-content/40" strokeWidth={1} />

      {items.map((item, itemIndex) => {
        const groupX = PAD.l + itemIndex * groupW + (groupW - groupWidth) / 2;
        return (
          <g key={`${item.label}-${itemIndex}`}>
            {series.map((s, seriesIndex) => {
              const raw = item.values[seriesIndex] ?? 0;
              const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
              const barH = (value / niceMax) * innerH;
              return (
                <rect
                  key={s.name}
                  x={groupX + seriesIndex * barW}
                  y={PAD.t + innerH - barH}
                  width={Math.max(barW - 2, 2)}
                  height={Math.max(barH, 0)}
                  rx={1.5}
                  className={s.fill}
                >
                  <title>{`${item.label} · ${s.name}: ${value}`}</title>
                </rect>
              );
            })}
            <text
              x={PAD.l + itemIndex * groupW + groupW / 2}
              y={H - 18}
              textAnchor="middle"
              fontSize={8}
              className="fill-base-content/60"
            >
              {item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
