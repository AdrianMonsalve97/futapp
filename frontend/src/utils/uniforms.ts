import type {UniformKind,UniformVariant,UniformRecipientInput} from '../types/api';
import {humanize} from './format';

export const UNIFORM_SIZES=['XS','S','M','L','XL','XXL'];
export const CHILD_SIZES=['2','4','6','8','10','12','14','16'];
export const uniformVariantLabel=(variant:UniformVariant)=>({titular:'Local',alterna:'Visitante',entrenamiento:'Entrenamiento'}[variant]);
export const uniformKindLabel=(kind:UniformKind)=>kind==='completo'?'Uniforme completo con medias':kind==='camiseta'?'Solo camiseta':humanize(kind);
export function uniformRecipientLabel(order:UniformRecipientInput):string {
  return order.recipientType==='pareja'?`Pareja · ${order.recipientName??''}`:order.recipientType==='hijo'?`Hijo/a · ${order.recipientName??''}`:'Jugador';
}
