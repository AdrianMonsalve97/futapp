import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { ClubLogo } from "../atoms/ClubLogo";
import { SquadWorkspace } from "../organisms/SquadWorkspace";

export function SquadPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  return (
    <div className="squad-experience">
      <header className="sport-stage">
        <div>
          <p className="sport-eyebrow">{settings.teamName} · Plantilla</p>
          <h1>
            NOMBRES QUE
            <br />
            <em>DEFIENDEN EL ESCUDO.</em>
          </h1>
          <p>Tu plantilla. Su aportación. El próximo paso en la cancha.</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              className="btn btn-primary btn-sm"
              to={`/${user?.role === "admin" ? "admin" : "jugador"}/partidos`}
            >
              Ir al partido →
            </Link>
          </div>
        </div>
        <ClubLogo className="sport-stage-crest" />
      </header>
      <SquadWorkspace />
    </div>
  );
}
