import { lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import { useSquadNavigation } from "../hooks/useSquadNavigation";
import { SectionNavigation } from "../molecules/SectionNavigation";
import { Spinner } from "../atoms/Spinner";
import { SquadCollection } from "./SquadCollection";
import type { SquadView } from "../utils/squad-navigation";

const SquadManagement = lazy(() =>
  import("./SquadManagement").then((module) => ({
    default: module.SquadManagement,
  })),
);

export function SquadWorkspace() {
  const { user } = useAuth();
  const { view, setView } = useSquadNavigation(user?.role);
  const sections: { key: SquadView; label: string }[] = [
    { key: "gallery", label: "El vestuario · Jugadores" },
    { key: "system", label: "Sala táctica · Formación" },
  ];
  if (user?.role === "admin")
    sections.push({ key: "management", label: "Gestionar integrantes" });

  return (
    <>
      <SectionNavigation
        label="Explorar la plantilla"
        value={view}
        onChange={setView}
        items={sections}
      />
      {view === "management" && user?.role === "admin" ? (
        <Suspense
          fallback={
            <div className="py-12 text-center">
              <Spinner />
            </div>
          }
        >
          <SquadManagement />
        </Suspense>
      ) : (
        <SquadCollection view={view === "system" ? "system" : "gallery"} />
      )}
    </>
  );
}
