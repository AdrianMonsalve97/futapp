import rules from '../../../backend/src/domain/password-rules.json';
const requirements=rules.patterns.map(pattern=>new RegExp(pattern,'u'));
export const PASSWORD_MIN_LENGTH=rules.minLength;
export const PASSWORD_HINT=rules.hint;
export function passwordError(password:string):string|null {
  if(password.length<rules.minLength||requirements.some(pattern=>!pattern.test(password)))return rules.hint;
  if(new TextEncoder().encode(password).byteLength>rules.maxBytes)return 'La contraseña debe ocupar como máximo 72 bytes.';
  return null;
}
