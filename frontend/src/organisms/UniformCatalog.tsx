import {useRef,useState,type CSSProperties} from 'react';
import {useSettings} from '../context/SettingsContext';
import {useAuth} from '../context/AuthContext';
import {Alert} from '../atoms/Alert';
import {Button} from '../atoms/Button';
import {Input} from '../atoms/Input';
import {Select} from '../atoms/Select';
import {Icon} from '../atoms/Icon';
import {Modal} from '../atoms/Modal';
import {Spinner} from '../atoms/Spinner';
import {EmptyState} from '../atoms/EmptyState';
import {MediaImage} from '../atoms/MediaImage';
import {ConfirmAction} from '../molecules/ConfirmAction';
import {Money} from '../molecules/Money';
import {UniformProductImage} from '../molecules/UniformProductImage';
import {filterUniformCatalog,uniformContents,uniformKindLabel,uniformVariantLabel} from '../utils/uniforms';
import type {Uniform,UniformVariant} from '../types/api';

export interface UniformCatalogProps {
  uniforms:Uniform[];mode?:'admin'|'player';onCreate?:()=>void;onEdit?:(uniform:Uniform)=>void;onDelete?:(uniform:Uniform)=>void;onSelect?:(uniform:Uniform)=>void;selectLabel?:string;emptyTitle?:string;emptyMessage?:string;isLoading?:boolean;error?:string|null;
}
export function UniformCatalog({uniforms,mode='admin',onCreate,onEdit,onDelete,onSelect,selectLabel='Equiparme',emptyTitle='Catálogo vacío',emptyMessage='Todavía no hay prendas cargadas.',isLoading=false,error=null}:UniformCatalogProps) {
  const {settings}=useSettings(),{user,player}=useAuth(),scene=useRef<HTMLDivElement>(null);
  const [variant,setVariant]=useState<UniformVariant|''>(''),[category,setCategory]=useState<'all'|'completo'|'camiseta'|'equipamiento'>('all');
  const [search,setSearch]=useState(''),[sort,setSort]=useState<'featured'|'priceAsc'|'priceDesc'|'name'>('featured');
  const [previewId,setPreviewId]=useState<number|null>(null),[angle,setAngle]=useState(0),[expanded,setExpanded]=useState(false);
  const filtered=filterUniformCatalog(uniforms,variant,category,search,sort),featured=filtered.find(item=>item.id===previewId)||filtered.find(item=>item.imageUrl)||filtered[0];
  const index=featured?filtered.indexOf(featured):-1;
  const selectPreview=(item:Uniform,scroll=false)=>{setPreviewId(item.id);setAngle(0);if(scroll)scene.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
  const step=(direction:number)=>{if(filtered.length>1)selectPreview(filtered[(index+direction+filtered.length)%filtered.length]);};
  const clear=()=>{setVariant('');setCategory('all');setSearch('');setSort('featured');};
  if(isLoading)return <div className="flex justify-center py-10"><Spinner size="lg"/></div>;
  if(error)return <Alert tone="error">No se pudo cargar el catálogo: {error}</Alert>;
  if(!uniforms.length)return <EmptyState title={emptyTitle} message={emptyMessage} icon="camiseta" action={mode==='admin'&&onCreate?<Button onClick={onCreate}>Agregar prenda</Button>:undefined}/>;
  return <section className="locker-store" style={{'--locker-accent':settings.brandColor||'#d8b86a'} as CSSProperties}>
    <div className="locker-room" ref={scene}>
      <header className="locker-header"><div className="locker-club"><MediaImage src={settings.logoUrl} alt={`Escudo de ${settings.teamName}`} className="kit-club-crest"/><div><small>{settings.teamName}</small><span>VESTUARIO / {settings.season}</span></div></div><span className="locker-mode"><i/> {mode==='admin'?'GESTIÓN DE EQUIPAMIENTO':'MI EQUIPAMIENTO'}</span></header>
      <div className="locker-intro"><div><span className="locker-overline">EL PARTIDO EMPIEZA AQUÍ</span><h2>ELIGE TUS<br/><em>COLORES.</em></h2></div><p>Tu equipo. Tu identidad.<br/>Prepara lo que llevas a la cancha.</p>{mode==='admin'&&onCreate?<Button className="locker-add" onClick={onCreate}><Icon name="plus" size={18}/> Nueva prenda</Button>:null}</div>
      <div className="locker-collections" role="group" aria-label="Colección">{(['','titular','alterna','entrenamiento'] as const).map(value=><button type="button" key={value} aria-pressed={variant===value} onClick={()=>{setVariant(value);setPreviewId(null);setAngle(0);}}><span>{value==='titular'?'01':value==='alterna'?'02':value==='entrenamiento'?'03':'ALL'}</span>{value?uniformVariantLabel(value):'Todo el vestuario'}</button>)}</div>
      {featured?<div className="locker-game-layout">
        <div className="locker-stage" role="region" aria-label="Vista previa de equipamiento" tabIndex={0} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}if(event.key==='ArrowRight'){event.preventDefault();step(1);}}}>
          <div className="locker-stage-grid" aria-hidden="true"/><div className="locker-light locker-light-left" aria-hidden="true"/><div className="locker-light locker-light-right" aria-hidden="true"/>
          <span className="locker-vertical" aria-hidden="true">{uniformVariantLabel(featured.variant).toUpperCase()}</span><span className="locker-scene-count">{String(index+1).padStart(2,'0')} / {String(filtered.length).padStart(2,'0')}</span>
          <div className="locker-platform" aria-hidden="true"/><div className="locker-turntable" style={{'--locker-angle':`${angle}deg`} as CSSProperties}><div className="locker-kit-entry" key={featured.id}><UniformProductImage uniform={featured}/></div></div>
          <button type="button" className="locker-scene-arrow locker-prev" aria-label="Prenda anterior" disabled={filtered.length<2} onClick={()=>step(-1)}><Icon name="arrowLeft" size={22}/></button><button type="button" className="locker-scene-arrow locker-next" aria-label="Prenda siguiente" disabled={filtered.length<2} onClick={()=>step(1)}><Icon name="arrowRight" size={22}/></button>
          <div className="locker-scene-tools"><label>Girar presentación <input type="range" min={-18} max={18} value={angle} aria-label="Girar presentación de la prenda" onChange={event=>setAngle(Number(event.target.value))}/></label><button type="button" onClick={()=>setExpanded(true)}><Icon name="eye" size={15}/> Ampliar referencia</button></div>
        </div>
        <aside className="locker-loadout"><div className="locker-player"><div className="locker-player-number">{mode==='player'&&player?.shirtNumber!=null?player.shirtNumber:<Icon name="shield" size={24}/>}</div><div><small>{mode==='player'?'JUGADOR RESPONSABLE':'EQUIPAMIENTO DEL CLUB'}</small><strong>{mode==='player'?user?.fullName:settings.teamName}</strong></div></div>
          <div className="locker-product-title" key={featured.id}><span className="locker-overline">{uniformKindLabel(featured.kind)}</span><h3>{featured.name}</h3><span className="locker-edition">{uniformVariantLabel(featured.variant)} · {settings.season}</span></div>
          <div className="locker-loadout-detail"><span>QUÉ LLEVAS</span><p>{uniformContents(featured.kind)}</p></div><div className="locker-availability"><span className={featured.active&&featured.stock>0?'locker-stock-dot':'locker-stock-dot locker-stock-order'}/>{!featured.active?'Prenda inactiva':featured.stock>0?`${featured.stock} unidades en stock`:'Bajo pedido · confirma disponibilidad'}</div>
          <div className="locker-price"><small>VALOR DEL PEDIDO</small><strong><Money value={featured.price}/></strong></div>
          {mode==='player'&&onSelect?<Button className="locker-equip" disabled={!featured.active} onClick={()=>onSelect(featured)}><Icon name="camiseta" size={20}/>{selectLabel}<Icon name="arrowRight" size={20}/></Button>:onEdit?<Button className="locker-equip" onClick={()=>onEdit(featured)}><Icon name="edit" size={18}/> Editar equipamiento</Button>:null}
          <p className="locker-loadout-help">{mode==='player'?'En el siguiente paso eliges talla, destinatario y detalles.':'Selecciona una prenda para gestionar su referencia, precio y stock.'}</p>
        </aside>
        <div className="locker-selection-rail" role="group" aria-label="Prendas del vestuario">{filtered.map(item=><button type="button" key={item.id} aria-pressed={featured.id===item.id} aria-label={`Vista previa: ${item.name}`} onClick={()=>selectPreview(item)}><UniformProductImage uniform={item}/><span>{item.name}</span>{featured.id===item.id?<i><Icon name="check" size={12}/></i>:null}</button>)}</div>
      </div>:<div className="locker-no-selection"><Icon name="camiseta" size={46}/><p>No hay prendas con esta selección.</p><Button variant="outline" onClick={clear}>Restablecer filtros</Button></div>}
      {mode==='player'?<div className="locker-workflow"><span><b>01</b> ELIGE EQUIPAMIENTO</span><Icon name="arrowRight" size={15}/><span><b>02</b> PERSONALIZA TU PEDIDO</span><Icon name="arrowRight" size={15}/><span><b>03</b> PAGA POR QR + SOPORTE</span></div>:null}
    </div>
    <div className="locker-catalog-heading"><div><span className="locker-overline">COMPLETA TU EQUIPO</span><h3>EL RESTO DEL VESTUARIO<span>.</span></h3></div><span>{filtered.length} prendas</span></div>
    <div className="kit-toolbar"><div className="kit-category-group" role="group" aria-label="Tipo de prenda">{([['all','Todo'],['completo','Uniforme completo'],['camiseta','Solo camiseta'],['equipamiento','Equipamiento']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={category===value} onClick={()=>{setCategory(value);setPreviewId(null);setAngle(0);}}>{label}</button>)}</div><div className="kit-search-sort"><Input aria-label="Buscar prendas" placeholder="Buscar equipamiento…" value={search} maxLength={160} onChange={event=>setSearch(event.target.value)}/><Select aria-label="Ordenar prendas" value={sort} onChange={event=>setSort(event.target.value as typeof sort)}><option value="featured">Destacadas</option><option value="priceAsc">Menor precio</option><option value="priceDesc">Mayor precio</option><option value="name">Nombre</option></Select></div></div>
    {!filtered.length?<EmptyState title="Sin coincidencias" message="Prueba otra búsqueda o categoría." action={<Button variant="outline" onClick={clear}>Limpiar filtros</Button>}/>:<div className="locker-catalog-grid">{filtered.map((item,position)=><article key={item.id} className={`locker-item ${featured?.id===item.id?'locker-item-selected':''}`} style={{'--kit-delay':`${Math.min(position,5)*60}ms`} as CSSProperties}>
      <button className={`locker-item-image locker-item-${item.variant}`} type="button" onClick={()=>selectPreview(item,true)} aria-label={`Ver ${item.name} en el vestuario`}><span className="locker-item-variant">{uniformVariantLabel(item.variant)}</span><UniformProductImage uniform={item}/><span className="locker-item-number" aria-hidden="true">{String(position+1).padStart(2,'0')}</span><span className="locker-item-view">VER EN VESTUARIO ↗</span></button>
      <div className="locker-item-info"><small>{uniformKindLabel(item.kind)}</small><h4>{item.name}</h4><p>{uniformContents(item.kind)}</p><div className="locker-item-price"><strong><Money value={item.price}/></strong><span>{!item.active?'Inactiva':item.stock?`${item.stock} disponibles`:'Bajo pedido'}</span></div>
        {mode==='admin'?<div className="kit-card-actions">{onEdit?<Button variant="outline" size="sm" onClick={()=>onEdit(item)}><Icon name="edit" size={14}/> Editar</Button>:null}{onDelete?<ConfirmAction title="Eliminar prenda" message={`Se dará de baja "${item.name}" del catálogo. ¿Continuar?`} confirmLabel="Eliminar" size="sm" variant="ghost" onConfirm={()=>onDelete(item)}/>:null}</div>:onSelect?<Button className="locker-item-equip" onClick={()=>onSelect(item)} disabled={!item.active}>Elegir equipamiento <Icon name="arrowRight" size={17}/></Button>:null}
      </div>
    </article>)}</div>}
    {featured&&expanded?<Modal open title={featured.name} size="lg" onClose={()=>setExpanded(false)}><div className="locker-expanded-reference"><UniformProductImage uniform={featured}/></div><p className="text-sm mt-3">{uniformContents(featured.kind)} · {uniformVariantLabel(featured.variant)}</p></Modal>:null}
  </section>;
}
