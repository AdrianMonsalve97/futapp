import type { ModelStore } from '../../../application/ports/out/model-store';
import type { ModelArtifact } from '../../../domain/model/performance-model';
import type { ApplicationDatabase } from './async-database';
export class PostgresModelStore implements ModelStore {
  constructor(private db:ApplicationDatabase){}
  async load():Promise<ModelArtifact|null>{
    const row=await this.db.prepare('SELECT data FROM model_artifacts WHERE id=1').get();
    if(!row)return null;
    try{const parsed=JSON.parse(row.data) as ModelArtifact;
      return parsed.weights?.length===11&&parsed.mean?.length===10&&parsed.std?.length===10&&[...parsed.weights,...parsed.mean,...parsed.std].every(Number.isFinite)?parsed:null;
    }catch{return null;}
  }
  async save(artifact:ModelArtifact){await this.db.prepare('INSERT INTO model_artifacts(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(artifact));}
}
