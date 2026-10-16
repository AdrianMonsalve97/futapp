import type { TacticalPlay } from "../types/tactics";

export function TacticalPlayDetails({
  play,
  headingLevel = 3,
}: {
  play: TacticalPlay;
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 4 ? "h4" : "h3";
  return (
    <div className="space-y-3">
      <Heading className="font-semibold text-lg">{play.title}</Heading>
      <p>{play.objective}</p>
      <ol className="list-decimal pl-5 space-y-3 text-sm">
        {play.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <p className="rounded-xl bg-base-200 p-4 text-sm">{play.coaching}</p>
      <a
        className="link text-sm"
        href={play.source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Referencia deportiva: {play.source.title}
      </a>
    </div>
  );
}
