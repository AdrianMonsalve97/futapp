import type { ModelArtifact } from '../../../domain/model/performance-model';

/** Puerto de salida para la persistencia del modelo (`data/model.json`). */
export interface ModelStore {
  load(): Promise<ModelArtifact | null>;
  save(artifact: ModelArtifact): Promise<void>;
}
