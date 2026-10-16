import { ClubLogo } from "../atoms/ClubLogo";
import { Badge } from "../atoms/Badge";
import type { Tournament } from "../types/tournament";
export function TournamentBanner({ row }: { row: Tournament }) {
  return (
    <section className="tournament-banner">
      <ClubLogo className="w-24 h-24 shrink-0" />
      <div>
        <p className="hero-kicker">
          {row.leagueName} · {row.season}
        </p>
        <h2 className="text-2xl sm:text-3xl font-black mt-2">{row.name}</h2>
        <p className="mt-3 text-sm text-white/60">
          Fútbol {row.rules.format} · {row.rules.periods} tiempos de{" "}
          {row.rules.minutesPerPeriod} min ·{" "}
          {row.rules.periods * row.rules.minutesPerPeriod} min de juego
        </p>
      </div>
      <Badge tone={row.status === "publicado" ? "success" : "neutral"}>
        {row.status}
      </Badge>
    </section>
  );
}
