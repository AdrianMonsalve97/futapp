import type { Match } from "../types/api";
import { Card, CardBody, CardTitle } from "../atoms/Card";

export function MatchVenueMap({ match }: { match: Match }) {
  if (!match.venueMap) return null;
  return (
    <Card className="venue-map">
      <CardBody>
        <div className="sport-panel-heading">
          <div>
            <p className="sport-eyebrow">Nos vemos en la cancha</p>
            <CardTitle>{match.venue || "Ubicación del partido"}</CardTitle>
          </div>
          <a
            className="btn btn-primary btn-sm"
            href={match.venueMap.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver cómo llegar ↗
          </a>
        </div>
        <iframe
          title={`Mapa de ${match.venue || "la cancha"}`}
          src={match.venueMap.embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer"
          allowFullScreen
        />
        <a
          className="link text-sm"
          href={match.venueMap.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir ubicación en Google Maps ↗
        </a>
      </CardBody>
    </Card>
  );
}
