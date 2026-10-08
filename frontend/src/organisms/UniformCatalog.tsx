import {useState,type CSSProperties} from 'react';
import {useSettings} from '../context/SettingsContext';
import {Alert} from '../atoms/Alert';
import {Button} from '../atoms/Button';
import {Input} from '../atoms/Input';
import {Select} from '../atoms/Select';
import {Icon} from '../atoms/Icon';
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
export function UniformCatalog({uniforms,mode='admin',onCreate,onEdit,onDelete,onSelect,selectLabel='Personalizar pedido',emptyTitle='Catálogo vacío',emptyMessage='Todavía no hay prendas cargadas.',isLoading=false,error=null}:UniformCatalogProps) {
  const {settings}=useSettings();
  const [variant,setVariant]=useState<UniformVariant|''>(''),[category,setCategory]=useState<'all'|'completo'|'camiseta'|'equipamiento'>('all'),[search,setSearch]=useState(''),[sort,setSort]=useState<'featured'|'priceAsc'|'priceDesc'|'name'>('featured');
  const filtered=filterUniformCatalog(uniforms,variant,category,search,sort),active=uniforms.filter(item=>item.active),selection=active.filter(item=>!variant||item.variant===variant);
  const featured=selection.find(item=>item.kind==='completo'&&item.imageUrl)||selection.find(item=>item.imageUrl)||selection[0];
  const clear=()=>{setVariant('');setCategory('all');setSearch('');setSort('featured');};
  if(isLoading)return <div className="flex justify-center py-10"><Spinner size="lg"/></div>;
  if(error)return <Alert tone="error">No se pudo cargar el catálogo: {error}</Alert>;
  if(!uniforms.length)return <EmptyState title={emptyTitle} message={emptyMessage} icon="camiseta" action={mode==='admin'&&onCreate?<Button onClick={onCreate}>Agregar prenda</Button>:undefined}/>;
  return <section className="kit-store" style={{'--kit-gold':settings.brandColor||'#d8b86a'} as CSSProperties}>
    <div className="kit-hero">
      <div className="kit-hero-lines" aria-hidden="true"/>
      <div className="kit-hero-copy">
        <span className="kit-eyebrow">{settings.logoUrl?<MediaImage src={settings.logoUrl} alt={`Escudo de ${settings.teamName}`} className="kit-club-crest"/>:<Icon name="shield" size={16}/>} {settings.teamName} · {settings.season}</span>
        <h2>Nuestra camiseta.<br/><em>Tu historia.</em></h2>
        <p>Para salir a la cancha. Para acompañar desde la tribuna. Elige lo que llevas contigo.</p>
        <div className="kit-hero-actions">{mode==='admin'&&onCreate?<Button onClick={onCreate}>Agregar a la colección <Icon name="plus" size={18}/></Button>:featured&&onSelect?<Button onClick={()=>onSelect(featured)}>Arma tu pedido <Icon name="arrowRight" size={18}/></Button>:null}<a href="#kit-collection">Explorar colección ↓</a></div>
        <div className="kit-hero-stats"><div><strong>{active.length}</strong><span>prendas disponibles</span></div><div><strong>Equipo + familia</strong><span>una misma pasión</span></div></div>
      </div>
      <div className="kit-hero-visual"><span className="kit-orbit" aria-hidden="true"/><span className="kit-hero-watermark" aria-hidden="true">MATCH<br/>READY</span>{featured?<><div className="kit-hero-product" key={featured.id}><UniformProductImage uniform={featured}/></div><div className="kit-hero-label"><span>{uniformVariantLabel(featured.variant)}</span><strong>{featured.name}</strong><Money value={featured.price}/></div></>:<Icon name="camiseta" size={100}/>}</div>
    </div>
    {mode==='player'?<div className="kit-process"><span><b>01</b> Elige tu prenda</span><span><b>02</b> Personaliza y solicita</span><span><b>03</b> Paga por QR y sube el soporte</span></div>:null}
    <div id="kit-collection" className="kit-collection-heading"><div><p className="kit-eyebrow">VISTE LOS COLORES</p><h3>Uniformes & equipamiento</h3></div><span>{filtered.length} de {uniforms.length} prendas</span></div>
    <div className="kit-toolbar">
      <div className="kit-chip-group" role="group" aria-label="Colección">{(['','titular','alterna','entrenamiento'] as const).map(value=><button type="button" key={value} aria-pressed={variant===value} onClick={()=>setVariant(value)}>{value?uniformVariantLabel(value):'Toda la colección'}</button>)}</div>
      <div className="kit-search-sort"><Input aria-label="Buscar prendas" placeholder="Busca tu próxima prenda…" value={search} maxLength={160} onChange={event=>setSearch(event.target.value)}/><Select aria-label="Ordenar prendas" value={sort} onChange={event=>setSort(event.target.value as typeof sort)}><option value="featured">Destacadas</option><option value="priceAsc">Menor precio</option><option value="priceDesc">Mayor precio</option><option value="name">Nombre</option></Select></div>
    </div>
    <div className="kit-category-group" role="group" aria-label="Tipo de prenda">{([['all','Todas'],['completo','Uniforme completo'],['camiseta','Solo camiseta'],['equipamiento','Equipamiento']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={category===value} onClick={()=>setCategory(value)}>{label}</button>)}</div>
    {!filtered.length?<EmptyState title="No hay prendas con estos filtros" message="Prueba otra colección o búsqueda." action={<Button variant="outline" onClick={clear}>Limpiar filtros</Button>}/>:<div className="kit-product-grid">{filtered.map((item,index)=><article key={item.id} className="kit-product-card" style={{'--kit-delay':`${Math.min(index,5)*65}ms`} as CSSProperties}>
      <div className={`kit-product-stage kit-stage-${item.variant}`}><span className="kit-variant">{uniformVariantLabel(item.variant)}</span><span className="kit-product-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
        {mode==='player'&&onSelect?<button className="kit-product-open" type="button" disabled={!item.active} aria-label={`Ver y personalizar ${item.name}`} onClick={()=>onSelect(item)}><UniformProductImage uniform={item}/><span className="kit-reveal"><Icon name="eye" size={16}/> Ver y personalizar</span></button>:<UniformProductImage uniform={item}/>}
        {!item.active?<span className="kit-stock">Inactiva</span>:item.stock===0?<span className="kit-stock">Bajo pedido</span>:mode==='admin'&&item.stock<=item.minStock?<span className="kit-stock">Stock bajo</span>:null}
      </div>
      <div className="kit-product-info"><p className="kit-product-kind">{uniformKindLabel(item.kind)}</p><h4>{item.name}</h4><p className="kit-product-contents">{uniformContents(item.kind)}</p><div className="kit-product-price"><strong><Money value={item.price}/></strong><span>{item.stock} en stock</span></div>
        {mode==='admin'?<div className="kit-card-actions">{onEdit?<Button variant="outline" size="sm" onClick={()=>onEdit(item)}><Icon name="edit" size={14}/> Editar</Button>:null}{onDelete?<ConfirmAction title="Eliminar prenda" message={`Se dará de baja "${item.name}" del catálogo. ¿Continuar?`} confirmLabel="Eliminar" size="sm" variant="ghost" onConfirm={()=>onDelete(item)}/>:null}</div>:onSelect?<Button className="kit-purchase" onClick={()=>onSelect(item)} disabled={!item.active}>{selectLabel}<Icon name="arrowRight" size={18}/></Button>:null}
      </div>
    </article>)}</div>}
  </section>;
}
