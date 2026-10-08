import { Input } from '../atoms/Input';
import { FormField } from './FormField';

export interface HealthValues {
  eps: string;
  prepaidHealth: string;
  emergencyContact: string;
}

export function HealthFields({ value, onChange }: {
  value: HealthValues;
  onChange: (field: keyof HealthValues, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="EPS" hint="Entidad a la que estás afiliado.">
        <Input value={value.eps} maxLength={120} onChange={event => onChange('eps', event.target.value)} placeholder="Nombre de la EPS" />
      </FormField>
      <FormField label="Medicina prepagada" hint="Opcional. Deja vacío si no tienes o no la has informado.">
        <Input value={value.prepaidHealth} maxLength={120} onChange={event => onChange('prepaidHealth', event.target.value)} placeholder="Entidad de medicina prepagada" />
      </FormField>
      <FormField label="Contacto de emergencia" className="sm:col-span-2">
        <Input value={value.emergencyContact} maxLength={200} onChange={event => onChange('emergencyContact', event.target.value)} placeholder="Nombre · teléfono" />
      </FormField>
    </div>
  );
}
