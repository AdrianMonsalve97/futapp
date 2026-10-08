import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';
import { env } from '../../../config/env';
import type { MediaAsset, MediaPurpose, MediaStorage } from '../../../application/ports/out/media.storage';
import { ValidationError } from '../../../domain/errors';

export class FileMediaStorage implements MediaStorage {
  private readonly directory = path.join(path.dirname(path.resolve(env.dbPath)), 'uploads');
  constructor(private readonly db: Database) {}
  find(id: string): MediaAsset | null {
    return this.db.prepare(`SELECT id, owner_id AS ownerId, purpose, file_name AS fileName,
      stored_name AS storedName, mime_type AS mimeType, size, extracted_text AS extractedText
      FROM media_assets WHERE id = ?`).get(id) as MediaAsset | undefined ?? null;
  }
  filePath(asset: MediaAsset): string { return path.join(this.directory, asset.storedName); }
  async store(ownerId: number, purpose: MediaPurpose, name: string, data: Uint8Array): Promise<MediaAsset> {
    const document = purpose === 'tournament';
    const receipt = purpose === 'receipt';
    if (!data.byteLength || data.byteLength > (document ? 12 : 8) * 1024 * 1024) throw new ValidationError(`El archivo debe pesar hasta ${document ? 12 : 8} MB`);
    const fileName = path.basename(name.replaceAll('\\', '/')).replace(/[\x00-\x1f]/g, '').slice(0, 150) || 'archivo';
    let bytes: Buffer; let extension: string; let mimeType: string; let extractedText = '';
    const buffer = Buffer.from(data);
    if ((document || receipt) && buffer.subarray(0, 5).toString() === '%PDF-') {
      const parser = new PDFParse({ data: Uint8Array.from(buffer) });
      try {
        const info = await parser.getInfo();
        if (info.total > (receipt ? 10 : 100)) throw new ValidationError(`El PDF debe tener hasta ${receipt ? 10 : 100} páginas`);
        if (document) extractedText = (await parser.getText({ pageJoiner: '' })).text.trim().slice(0, 100000);
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError('No se pudo leer el PDF. Usa un documento sin contraseña o carga el texto de la normativa');
      } finally { await parser.destroy(); }
      bytes = buffer; extension = '.pdf'; mimeType = 'application/pdf';
    } else if (document && /\.(txt|md)$/i.test(fileName)) {
      try { extractedText = new TextDecoder('utf-8', { fatal: true }).decode(buffer).trim(); }
      catch { throw new ValidationError('El documento de texto debe estar en UTF-8'); }
      if (extractedText.includes('\0') || extractedText.length > 100000) throw new ValidationError('El texto debe contener hasta 100.000 caracteres');
      bytes = Buffer.from(extractedText); extension = '.txt'; mimeType = 'text/plain';
    } else {
      try {
        const image = sharp(buffer, { limitInputPixels: 24000000 });
        const info = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(info.format ?? '') || (info.pages ?? 1) > 1) throw new Error('format');
        const normalized = image.rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true });
        bytes = purpose === 'payment_qr' ? await normalized.png().toBuffer() : await normalized.webp({ quality: 88 }).toBuffer();
      } catch { throw new ValidationError(document ? 'Usa PDF, TXT, MD o una imagen JPG, PNG o WEBP válida' : 'Usa una imagen JPG, PNG o WEBP válida (hasta 24 megapíxeles)'); }
      extension = purpose === 'payment_qr' ? '.png' : '.webp'; mimeType = purpose === 'payment_qr' ? 'image/png' : 'image/webp';
    }
    const id = randomUUID();
    const asset: MediaAsset = { id, ownerId, purpose, fileName, storedName: id + extension, mimeType, size: bytes.length, extractedText };
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(this.filePath(asset), bytes, { flag: 'wx' });
    try {
      this.db.prepare(`INSERT INTO media_assets (id, owner_id, purpose, file_name, stored_name, mime_type, size, extracted_text)
        VALUES (@id, @ownerId, @purpose, @fileName, @storedName, @mimeType, @size, @extractedText)`).run(asset);
    } catch (error) { await fs.unlink(this.filePath(asset)); throw error; }
    return asset;
  }
  async discard(asset: MediaAsset): Promise<void> {
    this.db.prepare('DELETE FROM media_assets WHERE id = ?').run(asset.id);
    await fs.unlink(this.filePath(asset)).catch(() => {});
  }
}
