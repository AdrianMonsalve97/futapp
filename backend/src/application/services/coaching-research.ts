import type { CoachingResearch, CoachingSource, TacticalStyle } from '../../domain/tactics';
import { COACHING_SOURCES } from '../../domain/coaching';
const cache = new Map<TacticalStyle,{expires:number;data:CoachingResearch}>();
const running = new Map<TacticalStyle,Promise<CoachingResearch>>();

/** Consult only official, fixed HTTPS resources. Never transmit roster, health or payment data. */
export async function researchCoaching(style: TacticalStyle): Promise<CoachingResearch> {
  const previous = cache.get(style);
  if (previous && previous.expires>Date.now()) return previous.data;
  const pending = running.get(style); if (pending) return pending;
  const task = (async () => {
    const selected = [COACHING_SOURCES.build,COACHING_SOURCES.switch,style==='ofensivo'?COACHING_SOURCES.press:COACHING_SOURCES.defend];
    // Search the current official practice index by style, rather than presenting only fixed links.
    try {
      const index = await fetch('https://www.fifatrainingcentre.com/en/practice/talent_development.php',{signal:AbortSignal.timeout(7000),redirect:'error'});
      if (index.ok) {
        const html = await index.text();
        const words = style==='ofensivo'?['attack','press','finish','offensive']:style==='defensivo'?['defend','defensive','block','protect']:['midfielder','support','progress','combinative'];
        const discovered = new Map<string,CoachingSource & {score:number}>();
        for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
          const url = new URL(match[1],'https://www.fifatrainingcentre.com');
          if (url.protocol!=='https:' || url.hostname!=='www.fifatrainingcentre.com' || url.port || url.username || url.password || !url.pathname.startsWith('/en/practice/talent-coach-programme/') || !url.pathname.endsWith('.php')) continue;
          const title=match[2].replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
          const text=(title+' '+url.pathname).toLowerCase(), score=words.filter(word=>text.includes(word)).length;
          if (score && title.length>12) discovered.set(url.href,{url:url.href,title,topic:'Biblioteca de entrenamiento · '+style,score});
        }
        selected.push(...[...discovered.values()].sort((a,b)=>b.score-a.score).slice(0,3).map(({score:_score,...source})=>source));
      }
    } catch { /* Fixed, verified references remain available if the live index fails. */ }
    const sources = await Promise.all(selected.map(async source => {
      try {
        const response = await fetch(source.url,{signal:AbortSignal.timeout(7000),redirect:'error'});
        const body = await response.text();
        const verified = response.ok && body.includes('<html') && !/access denied|just a moment/i.test(body.slice(0,1000));
        return {...source,verified};
      } catch { return {...source,verified:false}; }
    }));
    const count = sources.filter(s=>s.verified).length;
    const data:CoachingResearch = {checkedAt:new Date().toISOString(),style,query:`${style}: salida, amplitud y ${style==='ofensivo'?'presión alta':'organización defensiva'}`,
      status:count===sources.length?'consultado':count?'parcial':'no_disponible',sources};
    cache.set(style,{expires:Date.now()+(count?600000:30000),data});
    return data;
  })();
  running.set(style,task);
  try { return await task; } finally { running.delete(style); }
}
