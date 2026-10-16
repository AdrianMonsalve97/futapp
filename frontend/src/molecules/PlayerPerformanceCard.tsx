import type { SquadMember } from "../../../backend/src/domain/squad";
import { Avatar } from "../atoms/Avatar";
import { ClubLogo } from "../atoms/ClubLogo";

export function PlayerPerformanceCard({
  member,
  onSelect,
}: {
  member: SquadMember;
  onSelect?: () => void;
}) {
  const { stats } = member;
  const content = (
    <>
      <div className="fc-player-top">
        <div>
          <strong>
            {stats.appearances ? stats.avgRating.toFixed(1) : "—"}
          </strong>
          <span>MEDIA / 10</span>
          <b>{member.position}</b>
        </div>
        <ClubLogo className="w-10 h-10" />
      </div>
      <Avatar
        className="fc-player-portrait"
        name={member.name}
        src={member.avatarUrl}
        size="lg"
      />
      <span className="fc-player-number">{member.shirtNumber ?? "—"}</span>
      <div className="fc-player-name">
        <span>
          {member.secondaryPosition
            ? `${member.position} / ${member.secondaryPosition}`
            : member.position}
        </span>
        <h3>{member.name}</h3>
      </div>
      <dl className="fc-player-numbers">
        <div>
          <dt>PJ</dt>
          <dd>{stats.appearances}</dd>
        </div>
        <div>
          <dt>GOL</dt>
          <dd>{stats.goals}</dd>
        </div>
        <div>
          <dt>ASI</dt>
          <dd>{stats.assists}</dd>
        </div>
      </dl>
      <span className="fc-player-cta">
        {stats.appearances
          ? `${stats.minutes} min · ${onSelect ? "Explorar rendimiento" : "Registro deportivo"}`
          : "Ficha lista · Aún sin registros"}{" "}
        {onSelect && <span aria-hidden="true">↗</span>}
      </span>
    </>
  );
  const className = "fc-player-card";
  return onSelect ? (
    <button
      type="button"
      className={className}
      onClick={onSelect}
      aria-label={`Ver rendimiento de ${member.name}`}
      aria-haspopup="dialog"
    >
      {content}
    </button>
  ) : (
    <article className={className}>{content}</article>
  );
}
