export function PerformanceMeter({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div className="performance-meter">
      <div>
        <span>{label}</span>
        <strong>{percent === null ? "Sin registros" : `${percent}%`}</strong>
      </div>
      <progress aria-label={label} max={Math.max(total, 1)} value={value} />
      <small>
        {value} de {total}
      </small>
    </div>
  );
}
