import type { ModelArtifact } from '../../../domain/model/performance-model';

/** Puerto de salida para la persistencia del modelo (`data/model.json`). */
export interface ModelStore {
  load(): ModelArtifact | null;
  save(artifact: ModelArtifact): void;
}
