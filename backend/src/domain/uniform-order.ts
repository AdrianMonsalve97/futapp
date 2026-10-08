import type {UniformKind,UniformRecipientInput,UniformRecipientType} from './entities';
import {ValidationError} from './errors';

/** Family orders belong to the player's account and purchase shirts only. */
export function uniformRecipient(input:UniformRecipientInput,kind:UniformKind):{recipientType:UniformRecipientType;recipientName:string|null} {
  const recipientType=input.recipientType??'jugador';
  if(!['jugador','pareja','hijo'].includes(recipientType))throw new ValidationError('Destinatario de uniforme inválido');
  const recipientName=typeof input.recipientName==='string'?input.recipientName.trim():null;
  if(recipientType==='jugador') {
    if(recipientName)throw new ValidationError('El pedido del jugador usa su propia ficha; el nombre adicional es para pareja o hijo');
    return {recipientType,recipientName:null};
  }
  if(kind!=='camiseta')throw new ValidationError('Los pedidos para pareja o hijo son solo de camiseta');
  if(!recipientName||recipientName.length>120||/[\u0000-\u001f\u007f]/.test(recipientName))throw new ValidationError('Indica el nombre de la pareja o hijo, hasta 120 caracteres');
  return {recipientType,recipientName};
}
