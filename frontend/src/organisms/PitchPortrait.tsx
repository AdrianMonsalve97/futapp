import { useId, useState } from 'react';
import { useMediaUrl } from '../hooks/useMediaUrl';

export const PITCH_COLORS = { POR:'#eac66a', DEF:'#65bcff', MED:'#a5a0ff', DEL:'#ff858c' };

/** SVG portraits use authenticated media, with a readable fallback for missing photos. */
export function PitchPortrait({src,name,number,label,role,radius=5,occupied=true}:{
  src?:string|null; name?:string|null; number?:number|null; label:string;
  role:keyof typeof PITCH_COLORS; radius?:number; occupied?:boolean;
}) {
  const url = useMediaUrl(src);
  const [failedUrl,setFailedUrl] = useState<string|null>(null);
  const clip = `portrait-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
  const photo = url && url !== failedUrl ? url : null;
  return <g className="pitch-portrait" aria-hidden="true">
    <defs><clipPath id={clip}><circle r={radius-0.35}/></clipPath></defs>
    <circle r={radius+0.7} fill="#061911" opacity="0.75"/>
    <circle r={radius} fill={occupied?'#142923':'#173c2e'} stroke={PITCH_COLORS[role]} strokeWidth="0.7" strokeDasharray={occupied?undefined:'1.4 1.2'}/>
    {photo ? <image href={photo} x={-radius} y={-radius} width={radius*2} height={radius*2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} onError={()=>setFailedUrl(url)}/> :
      <text y={radius*0.29} textAnchor="middle" fontSize={radius*0.83} fontWeight="800" fill="white">{occupied ? name?.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('') || number || label : label}</text>}
    {occupied ? <g transform={`translate(${radius*0.73} ${radius*0.72})`}>
      <circle r={radius*0.43} fill={PITCH_COLORS[role]} stroke="#092018" strokeWidth="0.35"/>
      <text y={radius*0.14} textAnchor="middle" fontSize={radius*0.43} fontWeight="900" fill="#101d19">{number ?? '·'}</text>
    </g> : null}
  </g>;
}
