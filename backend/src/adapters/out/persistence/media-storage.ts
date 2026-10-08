import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { env } from '../../../config/env';
import type { MediaAsset, MediaPurpose, MediaStorage } from '../../../application/ports/out/media.storage';
import { asAsyncDatabase, type ApplicationDatabase } from "./async-database";
import { normalizeMedia } from "./normalize-media";

export class FileMediaStorage implements MediaStorage {
  private readonly directory = path.join(path.dirname(path.resolve(env.dbPath)), 'uploads');
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }
  async find(id: string): Promise<MediaAsset | null> {
    return (await this.db.prepare(`SELECT id, owner_id AS ownerId, purpose, file_name AS fileName,
      stored_name AS storedName, mime_type AS mimeType, size, extracted_text AS extractedText
      FROM media_assets WHERE id = ?`).get(id)) as MediaAsset | undefined ?? null;
  }
  filePath(asset: MediaAsset): string {
    if (!/^[a-zA-Z0-9_.-]+$/.test(asset.storedName) || ['.','..'].includes(asset.storedName)) throw new Error('Nombre de archivo inválido');
    return path.join(this.directory, asset.storedName);
  }
  async content(asset: MediaAsset): Promise<Buffer> { return (await fs.readFile(this.filePath(asset))); }
  async store(ownerId: number, purpose: MediaPurpose, name: string, data: Uint8Array): Promise<MediaAsset> {
      const {fileName,bytes,extension,mimeType,extractedText}=await normalizeMedia(purpose,name,data);
      const id = randomUUID();
      const asset: MediaAsset = { id, ownerId, purpose, fileName, storedName: id + extension, mimeType, size: bytes.length, extractedText };
      await fs.mkdir(this.directory, { recursive: true });
      await fs.writeFile(this.filePath(asset), bytes, { flag: 'wx' });
      try {
        (await this.db.prepare(`INSERT INTO media_assets (id, owner_id, purpose, file_name, stored_name, mime_type, size, extracted_text)
        VALUES (@id, @ownerId, @purpose, @fileName, @storedName, @mimeType, @size, @extractedText)`).run(asset));
      } catch (error) { await fs.unlink(this.filePath(asset)); throw error; }
      return asset;
  }
  async discard(asset: MediaAsset): Promise<void> {
    (await this.db.prepare('DELETE FROM media_assets WHERE id = ?').run(asset.id));
    await fs.unlink(this.filePath(asset)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }

    private readonly db: ApplicationDatabase;
}
