import { ValidationError } from './errors';
export function validatePassword(password:string):void {
  if(password.length<15)throw new ValidationError('Usa una contraseña de al menos 15 caracteres; puede ser una frase.');
  if(Buffer.byteLength(password,'utf8')>72)throw new ValidationError('La contraseña debe ocupar como máximo 72 bytes.');
}
