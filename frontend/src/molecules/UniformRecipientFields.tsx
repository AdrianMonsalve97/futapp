import type {UniformKind,UniformRecipientType} from '../types/api';
import {FormField} from './FormField';
import {Input} from '../atoms/Input';
import {Select} from '../atoms/Select';

export function UniformRecipientFields({kind,recipientType,recipientName,onTypeChange,onNameChange}:{kind:UniformKind;recipientType:UniformRecipientType;recipientName:string;onTypeChange:(type:UniformRecipientType)=>void;onNameChange:(name:string)=>void}) {
  return <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-primary/20 p-4">
    <FormField label="¿Para quién es?" hint={kind==='camiseta'?'Las camisetas de familiares quedan asociadas al jugador.':'El uniforme completo y las demás prendas son para el jugador.'}>
      <Select value={recipientType} onChange={event=>onTypeChange(event.target.value as UniformRecipientType)}>
        <option value="jugador">Jugador</option>
        {kind==='camiseta'?<><option value="pareja">Pareja / esposa</option><option value="hijo">Hijo / hija</option></>:null}
      </Select>
    </FormField>
    {recipientType!=='jugador'?<FormField label={recipientType==='pareja'?'Nombre de la pareja / esposa':'Nombre del hijo / hija'} required>
      <Input value={recipientName} maxLength={120} required onChange={event=>onNameChange(event.target.value)} placeholder="Nombre de quien recibirá la camiseta"/>
    </FormField>:<p className="text-sm text-base-content/65 self-center">El destinatario será el jugador asociado a este pedido.</p>}
  </div>;
}
