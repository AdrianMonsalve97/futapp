import path from 'node:path';
import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';
import type { MediaPurpose } from '../../../application/ports/out/media.storage';
import { ValidationError } from '../../../domain/errors';
export async function normalizeMedia(purpose:MediaPurpose,name:string,data:Uint8Array){
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

return {fileName,bytes,extension,mimeType,extractedText};
}
