import fs from 'node:fs';
import path from 'node:path';
import type { ModelStore } from '../../../application/ports/out/model-store';
import type { ModelArtifact } from '../../../domain/model/performance-model';

/** Persistencia del modelo en `backend/data/model.json` (§8.2). */
export class FileModelStore implements ModelStore {
  private readonly filePath: string;

  constructor(baseDir: string = path.resolve(process.cwd(), 'data')) {
    this.filePath = path.join(baseDir, 'model.json');
  }

  load(): ModelArtifact | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as ModelArtifact;
      if (!Array.isArray(parsed.weights) || !Array.isArray(parsed.mean)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save(artifact: ModelArtifact): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  }
}
