import { useSettings } from "../context/SettingsContext";
import { ClubLogo } from "../atoms/ClubLogo";
import { MatchCountdown } from "../molecules/MatchCountdown";
import { getFormat } from "../data/formations";
import type { Match } from "../types/api";

export function MatchKickoffPanel({ match }: { match: Match }) {
  const { settings } = useSettings();
  const profile = getFormat(match.format);
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
          <p>
            {profile.name} · {match.minutes} minutos
          </p>
        </div>
      </div>
      <div>
        {match.status === "jugado" &&
          match.goalsFor !== null &&
          match.goalsAgainst !== null && (
            <p
              className="match-kickoff-score"
              aria-label={`Resultado: ${match.goalsFor} a ${match.goalsAgainst}`}
            >
              {match.goalsFor} – {match.goalsAgainst}
            </p>
          )}
        <MatchCountdown match={match} />
      </div>
    </section>
  );
}
