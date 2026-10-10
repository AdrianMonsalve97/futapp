import {useId,useState,type FormEvent} from 'react';
import {useAuth} from '../context/AuthContext';
import {Modal} from '../atoms/Modal';
import {Button} from '../atoms/Button';
import {Alert} from '../atoms/Alert';
import {Textarea} from '../atoms/Textarea';
import {Icon} from '../atoms/Icon';
import {Money} from '../molecules/Money';
import {FormField} from '../molecules/FormField';
import {UniformProductImage} from '../molecules/UniformProductImage';
import {UniformRecipientFields} from '../molecules/UniformRecipientFields';
import {CHILD_SIZES,UNIFORM_SIZES,uniformContents,uniformVariantLabel} from '../utils/uniforms';
import {api,errorMessage} from '../services/api';
import type {Uniform,UniformRecipientType} from '../types/api';

export function UniformOrderDialog({uniform,onClose,onSaved}:{uniform:Uniform;onClose:()=>void;onSaved:(notice:string)=>void}) {
  const {player,user}=useAuth(),formId=useId();
  const [size,setSize]=useState('M'),[recipientType,setRecipientType]=useState<UniformRecipientType>('jugador'),[recipientName,setRecipientName]=useState(''),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;
    if(recipientType!=='jugador'&&!recipientName.trim()){setError('Indica el nombre del destinatario.');return;}
    setBusy(true);setError(null);
    try{await api('/api/me/uniform-requests',{method:'POST',json:{uniformId:uniform.id,size,recipientType,recipientName:recipientType==='jugador'?null:recipientName.trim(),reason:details.trim()||undefined}});
      onSaved(`Solicitud enviada: ${uniform.name} · talla ${size}${recipientName.trim()?` · ${recipientName.trim()}`:''}.`);
    }catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  };
  return <Modal open title="Personaliza tu equipamiento" size="lg" onClose={()=>{if(!busy)onClose();}} closeOnOutside={!busy} footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Volver al vestuario</Button><Button form={formId} type="submit" loading={busy}>Confirmar solicitud <Icon name="arrowRight" size={18}/></Button></>}>
    <div className="kit-order-layout">
      <aside className="kit-order-preview">
        <div className={`kit-product-stage kit-stage-${uniform.variant}`}><span className="kit-variant">{uniformVariantLabel(uniform.variant)}</span><UniformProductImage uniform={uniform}/></div>
        <h4>{uniform.name}</h4><p>{uniformContents(uniform.kind)}</p>
        <div className="kit-personalization" key={`${recipientType}-${size}`}><small>TU ELECCIÓN</small><strong>{recipientType==='jugador'?user?.fullName:recipientName||'Tu familia'}</strong><span>Talla {size}</span></div>
        <p className="kit-responsible">Jugador responsable{player?.shirtNumber!=null?` · dorsal #${player.shirtNumber}`:''}</p>
      </aside>
      <form id={formId} onSubmit={event=>void submit(event)} className="kit-order-form">
        {error?<Alert tone="error">{error}</Alert>:null}
        <fieldset disabled={busy}><legend><b>01</b> ¿Quién la lleva?</legend>
          <UniformRecipientFields kind={uniform.kind} recipientType={recipientType} recipientName={recipientName} onTypeChange={value=>{setRecipientType(value);setRecipientName('');setSize(value==='hijo'?'8':'M');}} onNameChange={setRecipientName}/>
        </fieldset>
        <fieldset disabled={busy}><legend><b>02</b> Elige tu talla</legend>
          <div className="kit-size-picker" role="group" aria-label="Tallas disponibles">{(recipientType==='hijo'?[...CHILD_SIZES,...UNIFORM_SIZES]:UNIFORM_SIZES).map(value=><button key={value} type="button" aria-pressed={size===value} onClick={()=>setSize(value)}>{value}</button>)}</div>
          <p className="kit-help">Confirma las medidas con el administrador antes de solicitar.</p>
        </fieldset>
        <FormField label="Observaciones y personalización"><Textarea value={details} disabled={busy} onChange={event=>setDetails(event.target.value)} rows={3} maxLength={1000} placeholder="Nombre a estampar, preferencias o detalles del pedido…"/></FormField>
        <div className="kit-order-total"><span>1 prenda / conjunto</span><strong><Money value={uniform.price}/></strong></div>
        <p className="kit-help">{uniform.stock===0?'Bajo pedido: confirma disponibilidad con el administrador.':'La solicitud no reserva unidades; la disponibilidad se confirma al revisarla.'}</p>
        <div className="kit-payment-note"><Icon name="shield" size={22}/><p>Después de enviar, paga con el QR y sube tu soporte en <b>Mis pedidos</b>. El administrador revisará la solicitud y el pago.</p></div>
      </form>
    </div>
  </Modal>;
}
