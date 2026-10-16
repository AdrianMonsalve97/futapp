export function PerformanceTrend({
  entries,
}: {
  entries: { matchId: number; rating: number; opponent: string }[];
}) {
  if (!entries.length) return null;
  return (
    <figure className="performance-trend">
      <figcaption>
        Media de las últimas actuaciones <span>sobre 10</span>
      </figcaption>
      <div>
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <div key={entry.matchId}>
              <strong>{entry.rating.toFixed(1)}</strong>
              <span style={{ height: `${Math.max(2, entry.rating * 10)}%` }} />
              <small title={entry.opponent}>{entry.opponent}</small>
            </div>
          ))}
      </div>
    </figure>
  );
}
