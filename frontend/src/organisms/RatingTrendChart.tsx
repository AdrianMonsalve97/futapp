import { useState } from 'react';
import { EmptyState } from '../atoms/EmptyState';
import { formatRating } from '../utils/format';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface RatingTrendChartProps {
  points: TrendPoint[];
  title?: string;
  /** Rango del eje Y (por defecto 1–10, rango de calificaciones). */
  min?: number;
  max?: number;
  className?: string;
}

const W = 400;
const H = 170;
const PAD = { l: 30, r: 14, t: 16, b: 30 };

/** Gráfico de línea SVG de calificaciones, con ejes y tooltip al pasar el mouse. */
export function RatingTrendChart({
  points,
  title,
  min = 1,
  max = 10,
  className = '',
}: RatingTrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className={className}>
        {title ? <h3 className="font-semibold text-sm mb-2">{title}</h3> : null}
        <EmptyState title="Sin calificaciones registradas" message="Todavía no hay partidos con estadísticas." />
      </div>
    );
  }

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const yFor = (value: number) => PAD.t + ((max - value) / (max - min)) * innerH;
  const xFor = (index: number) =>
    points.length === 1 ? PAD.l + innerW / 2 : PAD.l + (index / (points.length - 1)) * innerW;

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(2)} ${(PAD.t + innerH).toFixed(2)} L ${xFor(0).toFixed(2)} ${(PAD.t + innerH).toFixed(2)} Z`;

  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4);
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const showEveryLabel = points.length <= 8 ? 1 : Math.ceil(points.length / 8);

  return (
    <div className={className}>
      {title ? <h3 className="font-semibold text-sm mb-2">{title}</h3> : null}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title ?? 'Evolución de calificaciones'}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.l}
              y1={yFor(tick)}
              x2={W - PAD.r}
              y2={yFor(tick)}
              className="stroke-base-300"
              strokeWidth={0.8}
              strokeDasharray="3 3"
            />
            <text x={PAD.l - 6} y={yFor(tick) + 3} textAnchor="end" fontSize={8} className="fill-base-content/50">
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={areaPath} className="fill-primary/15" />
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.value)}
              r={hover === index ? 5 : 3.4}
              className="fill-primary stroke-base-100"
              strokeWidth={1.6}
            />
            {index % showEveryLabel === 0 ? (
              <text
                x={xFor(index)}
                y={H - 12}
                textAnchor="middle"
                fontSize={8}
                className="fill-base-content/60"
              >
                {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
              </text>
            ) : null}
            {/* Zona invisible para el tooltip */}
            <rect
              x={xFor(index) - step / 2}
              y={PAD.t}
              width={step}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {hover !== null ? (
          <g pointerEvents="none">
            <rect
              x={Math.min(Math.max(xFor(hover) - 40, PAD.l), W - PAD.r - 80)}
              y={Math.max(yFor(points[hover].value) - 30, 2)}
              width={80}
              height={22}
              rx={4}
              className="fill-base-content"
            />
            <text
              x={Math.min(Math.max(xFor(hover) - 40, PAD.l), W - PAD.r - 80) + 40}
              y={Math.max(yFor(points[hover].value) - 30, 2) + 14.5}
              textAnchor="middle"
              fontSize={9.5}
              className="fill-base-100"
            >
              {`${points[hover].label}: ${formatRating(points[hover].value, 2)}`}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
