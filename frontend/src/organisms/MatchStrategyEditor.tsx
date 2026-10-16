import { useMatchStrategies } from "../hooks/useMatchStrategies";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Card, CardBody, CardTitle } from "../atoms/Card";
import { StrategyList } from "./StrategyList";
import { StrategyFormModal } from "./StrategyFormModal";
import type { Strategy } from "../types/api";

export function MatchStrategyEditor({
  matchId,
  strategies,
  onChanged,
}: {
  matchId: number;
  strategies: Strategy[];
  onChanged: () => void;
}) {
  const state = useMatchStrategies(onChanged);
  return (
    <Card>
      <CardBody>
        <div className="sport-panel-heading">
          <div>
            <p className="sport-eyebrow">Del vestuario a la cancha</p>
            <CardTitle>Plan de juego</CardTitle>
          </div>
          <Button size="sm" onClick={() => state.setEditor({ strategy: null })}>
            Nueva estrategia
          </Button>
        </div>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <StrategyList
          strategies={strategies}
          onEdit={(strategy) => state.setEditor({ strategy })}
          onDelete={(strategy) => void state.remove(strategy)}
        />
        {state.editor && (
          <StrategyFormModal
            open
            matchId={matchId}
            strategy={state.editor.strategy}
            onClose={() => state.setEditor(null)}
            onSaved={onChanged}
          />
        )}
      </CardBody>
    </Card>
  );
}
