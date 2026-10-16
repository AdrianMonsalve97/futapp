import { useSettings } from "../context/SettingsContext";
import { ClubLogo } from "../atoms/ClubLogo";
import { MatchCountdown } from "../molecules/MatchCountdown";
import type { Match } from "../types/api";

export function MatchKickoffPanel({ match }: { match: Match }) {
  const { settings } = useSettings();
  return (
    <section className="match-kickoff-panel">
      <div className="match-kickoff-rival">
        <ClubLogo className="w-16 h-16" />
        <div>
          <p className="sport-eyebrow">
            {match.competition} · {match.isHome ? "LOCAL" : "VISITANTE"}
          </p>
          <h2>
            {settings.teamName}
            <span> vs. {match.opponent}</span>
          </h2>
          <p>{match.venue || "Cancha por confirmar"}</p>
        </div>
      </div>
      <MatchCountdown match={match} />
    </section>
  );
}
