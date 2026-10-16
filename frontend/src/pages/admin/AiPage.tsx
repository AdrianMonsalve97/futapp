import { PageHeader } from "../../templates/PageHeader";
import { CoachingWorkspace } from "../../organisms/CoachingWorkspace";
export function AiPage() {
  return (
    <>
      <PageHeader
        title="Dirección deportiva"
        subtitle="Un plan para el equipo. Una misión para cada jugador."
      />
      <CoachingWorkspace />
    </>
  );
}
