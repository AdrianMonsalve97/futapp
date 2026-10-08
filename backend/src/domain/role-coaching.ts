import type { Position,LineupSlot } from './entities';
import type { TacticalStyle,TacticalPlay } from './tactics';
export interface RolePreparation {
  matchId:number|null;opponent:string|null;format:5|7|8|11;minutes:number;formation:string;publishedAt:string|null;
  lineup:LineupSlot[];role:Position;assignment:'titular'|'sin_publicar'|'fuera_inicial'|'sin_partido';style:TacticalStyle;
  individual:{title:string;detail:string}[];team:string[];training:string[];plays:TacticalPlay[];metricNote:string;
}
/** Coaching guidance is rule-based and is kept separate from statistical predictions. */
export function roleCoaching(role:Position,style:TacticalStyle,minutes:number,periods:number,unlimited:boolean){
  const entries={
    POR:[
      {title:'Ubicación y ángulo',detail:'Alinea balón, cuerpo y centro del arco. Reajusta con pasos cortos y llega equilibrado antes del remate.'},
      {title:'Uno contra uno',detail:'Lee el control del atacante y la cobertura del defensor. Decide entre proteger el arco, acompañar al defensor o atacar un balón que puedas alcanzar.'},
      {title:'Salida de balón',detail:style==='ofensivo'?'Ofrece apoyo detrás del balón; identifica un pase corto y una salida alternativa antes de recibir.':'Prioriza el pase seguro. Si la presión cierra la salida corta, busca un compañero libre sin forzar el centro.'},
      {title:'Espacio detrás de la defensa',detail:style==='defensivo'?'Acompaña el bloque sin alejarte de un arco que no puedas recuperar. Comunica quién presiona y quién cubre.':'Ajusta tu altura junto con los defensores; cubre balones a la espalda cuando puedas llegar. Evita una salida sin cobertura.'},
      {title:'Centros y balón parado',detail:'Acuerda marcas y cobertura del segundo palo. Comunica claramente si sales o si debe despejar un defensor.'},
    ],
    DEF:[{title:'Cobertura',detail:'Si un compañero presiona, protege su espalda y el pase interior. Mantén conexión con el portero.'},{title:'Duelo',detail:'Orienta al rival hacia fuera y espera una oportunidad de recuperación sin abandonar la línea.'},{title:'Salida',detail:'Recibe de perfil; busca mediocampista libre y conserva una opción de regreso al portero.'}],
    MED:[{title:'Antes de recibir',detail:'Mira ambos hombros, recibe de perfil y ofrece una línea de pase distinta a la del defensor.'},{title:'Equilibrio',detail:'Si un compañero avanza, protege la zona central para cubrir una pérdida.'},{title:'Progresión',detail:'Alterna apoyo corto y tercer hombre; cambia de orientación cuando el lado contrario quede libre.'}],
    DEL:[{title:'Movilidad',detail:'Alterna fijar al defensor y ofrecer apoyo. Ataca el espacio cuando el pasador pueda verte.'},{title:'Finalización',detail:'Prepara el cuerpo antes del pase y busca una solución acorde al ángulo y la posición del portero.'},{title:'Primera presión',detail:'Coordina con el mediocampo y orienta al rival hacia una banda; evita presionar solo.'}],
  };
  const team=role==='POR'?['Portero y defensa acuerdan una señal para subir o replegar el bloque.','Los defensores abren apoyos diagonales; un mediocampista ofrece la tercera opción.','Ante pérdida, protege primero el centro y deja una cobertura antes de intentar recuperar.']:['Coordina tus movimientos con la línea cercana; conserva un apoyo detrás del balón.','Reacciona a la pérdida según la cobertura: presiona acompañado o repliega.','Comunica marcas y relevos antes de cada balón parado.'];
  const training=role==='POR'?['Pases con ambos pies en triángulo: mirar antes de recibir y elegir dos opciones.','Remate desde distintos ángulos: desplazamiento, equilibrio y recuperación de posición.','Simular pase a la espalda con defensa: practicar juntos la decisión de salir o esperar.']:['Rondo con control orientado y mirada previa.','Situaciones por parejas de presión y cobertura.','Ensayar tu recorrido en la formación publicada.'];
  team.push(`${minutes} minutos${periods?` en ${periods} tiempos`:''}. ${unlimited?'Cambios ilimitados: coordina el relevo con el entrenador; verifica si la liga permite reingresar.':'Planifica los relevos según la normativa del partido.'}`);
  return {individual:entries[role],team,training};
}
