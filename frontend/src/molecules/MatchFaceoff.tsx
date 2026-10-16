import { ClubLogo } from "../atoms/ClubLogo";
import { Icon } from "../atoms/Icon";

export function MatchFaceoff({
  teamName,
  opponent,
  isHome,
}: {
  teamName: string;
  opponent: string;
  isHome: boolean;
}) {
  const initials =
    opponent
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => [...word][0] ?? "")
      .join("")
      .toLocaleUpperCase("es") || "?";
  const club = { club: true, name: teamName },
    rival = { club: false, name: opponent };
  const teams = isHome ? [club, rival] : [rival, club];
  return (
    <div className="match-faceoff">
      {teams.map((team, index) => (
        <div
          className="match-faceoff-team"
          data-club={team.club}
          key={team.club ? "club" : "opponent"}
        >
          <div className="match-faceoff-crest">
            {team.club ? (
              <ClubLogo />
            ) : (
              <div className="match-faceoff-opponent" aria-hidden="true">
                <Icon name="shield" size={96} />
                <span>{initials}</span>
              </div>
            )}
          </div>
          <span className="match-faceoff-side">
            {index === 0 ? "LOCAL" : "VISITANTE"}
          </span>
          <h3>{team.name}</h3>
          <small>{team.club ? "NUESTRO ESCUDO" : "EL RIVAL"}</small>
        </div>
      ))}
      <div className="match-faceoff-versus" aria-hidden="true">
        <span>VS</span>
        <i />
      </div>
    </div>
  );
}
