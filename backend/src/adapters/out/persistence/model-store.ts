import fs from 'node:fs';
import path from 'node:path';
import type { ModelStore } from '../../../application/ports/out/model-store';
import type { ModelArtifact } from '../../../domain/model/performance-model';
import { env } from '../../../config/env';

/** Persistencia del modelo en `backend/data/model.json` (§8.2). */
export class FileModelStore implements ModelStore {
  private readonly filePath: string;

  constructor(baseDir: string = path.dirname(path.resolve(process.cwd(), env.dbPath))) {
    this.filePath = path.join(baseDir, 'model.json');
  }

  load(): ModelArtifact | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as ModelArtifact;
      if (parsed.weights?.length !== 11 || parsed.mean?.length !== 10 || parsed.std?.length !== 10 || ![...parsed.weights, ...parsed.mean, ...parsed.std].every(Number.isFinite)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save(artifact: ModelArtifact): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, this.filePath);
  }
}
