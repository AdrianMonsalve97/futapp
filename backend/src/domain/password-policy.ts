import { ValidationError } from './errors';
import rules from './password-rules.json';
const requirements=rules.patterns.map(pattern=>new RegExp(pattern,'u'));
export function validatePassword(password:string):void {
  if(password.length<rules.minLength||requirements.some(pattern=>!pattern.test(password)))throw new ValidationError(rules.hint);
  if(Buffer.byteLength(password,'utf8')>rules.maxBytes)throw new ValidationError('La contraseña debe ocupar como máximo 72 bytes.');
}
