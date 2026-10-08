import {useId,useState} from 'react';
import {useMediaUrl} from '../hooks/useMediaUrl';
import type {Uniform} from '../types/api';
import {Icon} from '../atoms/Icon';

export function UniformProductImage({uniform,className=''}:{uniform:Uniform;className?:string}) {
  const source=useMediaUrl(uniform.imageUrl),id=useId().replace(/:/g,''),[failed,setFailed]=useState<string|null>(null);
  if(source&&source!==failed)return <img src={source} alt={`Referencia de ${uniform.name}`} className={`kit-product-image ${className}`} loading="lazy" onError={()=>setFailed(source)}/>;
  if(!['completo','camiseta','buzo','entrenamiento'].includes(uniform.kind))return <div className={`kit-reference-placeholder ${className}`}><Icon name="futbol" size={76}/><span>Referencia por cargar</span></div>;
  return <div className={`kit-reference-placeholder ${className}`}>
    <svg viewBox="0 0 260 280" role="img" aria-label="Ilustración de camiseta; referencia por cargar">
      <defs><linearGradient id={id} x2="1" y2="1"><stop stopColor={uniform.variant==='alterna'?'#f5e3b3':'#234c3d'}/><stop offset="1" stopColor={uniform.variant==='alterna'?'#c59e4c':'#0e211b'}/></linearGradient></defs>
      <path d="m85 38 22 12h46l22-12 57 39-26 48-26-15v128H80V110l-26 15-26-48z" fill={`url(#${id})`} stroke="#d7b76c" strokeWidth="3"/>
      <path d="M107 50q23 30 46 0M82 146h96" fill="none" stroke="#d7b76c" strokeWidth="5"/>
      <circle cx="155" cy="94" r="12" fill="#d7b76c"/><text x="130" y="177" textAnchor="middle" fill="#f6e6c2" fontSize="18" fontWeight="800">EQUIPO</text>
    </svg><span>Referencia por cargar</span>
  </div>;
}
