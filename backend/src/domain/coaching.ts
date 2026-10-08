import type { LineupSlot } from './entities';
import type { CoachingSource, TacticalPlay, TacticalStyle } from './tactics';

export const COACHING_SOURCES: Record<string, CoachingSource> = {
  goalkeeper:{title:'Portero: apoyar, recibir y pasar',topic:'Apoyo del portero y salida de balón',url:'https://www.fifatrainingcentre.com/en/practice/elite-sessions/goalkeeper/goalkeepersbuildup.php'},
  build: {title:'Progresar por los tercios del campo',topic:'Salida de balón y apoyos',url:'https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/build-and-progress/progressing-through-the-thirds.php'},
  switch: {title:'Ben Bartlett: cambios de orientación',topic:'Amplitud y circulación',url:'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/switching--play.php'},
  press: {title:'Presión en bloque alto',topic:'Presión coordinada y compactación',url:'https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/press-and-regain/6v6-small-sided-game-pressing-in-a-high-block.php'},
  defend: {title:'Defender como una unidad',topic:'Coberturas y organización defensiva',url:'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/defending-as-a-unit.php'},
};

/** Original adaptations of coaching principles; not copies of FIFA session plans. */
export function buildPlays(slots: LineupSlot[], style: TacticalStyle): TacticalPlay[] {
  const byRole = (role: string) => slots.filter(s=>s.role===role).sort((a,b)=>a.x-b.x);
  const keeper = byRole('POR')[0], defenders=byRole('DEF'), midfield=byRole('MED'), forwards=byRole('DEL');
  const left = midfield[0] ?? defenders[0], right = midfield.at(-1) ?? defenders.at(-1);
  const centre = [...midfield].sort((a,b)=>Math.abs(a.x-50)-Math.abs(b.x-50))[0] ?? defenders[0];
  const striker = forwards[0] ?? midfield.at(-1);
  const person = (slot: LineupSlot) => `${slot.label} (${slot.playerName ?? 'puesto vacante'})`;
  const route = (items:(LineupSlot|undefined)[]) => items.filter((s):s is LineupSlot=>Boolean(s)).map(s=>s.slotIndex);
  return [
    {id:'portero',title:'Portero conectado con la defensa',phase:'Con balón',objective:'Crear una salida segura con apoyo del arquero y cobertura ante pérdida.',route:route([defenders[0],keeper,defenders.at(-1),centre]),
      steps:[`${person(defenders[0])} identifica la presión y utiliza a ${person(keeper)} si la salida está cerrada.`,`${person(keeper)} mira antes de recibir, controla orientado y busca el defensor libre.`,`${person(centre)} ofrece una tercera opción; si no hay línea segura, conserva el balón sin forzar el pase interior.`],coaching:'Después del pase, el portero reajusta su posición con la línea defensiva. Acordad juntos la altura del bloque y la cobertura de balones a la espalda.',source:COACHING_SOURCES.goalkeeper},
    {id:'salida',title:'Salida con apoyo y tercer hombre',phase:'Con balón',objective:'Superar la primera presión sin perder la estructura.',
      route:route([keeper,defenders[0],centre,striker]),
      steps:[`${person(keeper)} inicia hacia ${person(defenders[0])}; abre el campo antes de recibir.`,
        `${person(centre)} se ofrece en diagonal, con el cuerpo orientado hacia adelante.`,
        `${person(striker)} fija al defensor y ataca el espacio cuando el pase es posible.`],
      coaching:style==='defensivo'?'Si el pase interior está cerrado, vuelve al portero y evita arriesgar en el centro.':'El receptor debe tener apoyo cercano y una segunda opción antes del pase.',source:COACHING_SOURCES.build},
    {id:'amplitud',title:'Atraer a una banda y cambiar de lado',phase:'Ataque organizado',objective:'Crear espacio en el lado opuesto y llegar con apoyo.',
      route:route([left,centre,right,striker]),
      steps:[`${person(left)} atrae al rival y juega con ${person(centre)}.`,
        `${person(right!)} mantiene amplitud y recibe el cambio de orientación.`,
        `${person(striker)} ataca el área; el lado opuesto cubre una posible pérdida.`],
      coaching:'No fuerces un pase largo: si el rival cierra la línea, circula con un apoyo intermedio.',source:COACHING_SOURCES.switch},
    style==='ofensivo' ? {id:'presion',title:'Presión coordinada tras pérdida',phase:'Sin balón',objective:'Cerrar la salida rival sin abrir espacios entre líneas.',
      route:route([striker,centre,defenders.at(-1)]),
      steps:[`${person(striker)} orienta la presión hacia una banda cuando aparece un mal control o pase atrás.`,
        `${person(centre)} cierra el pase interior; no persigas solo al poseedor.`,
        'La defensa avanza junta. Si el rival supera la presión, repliega y recompón el bloque.'],
      coaching:'Practica la coordinación antes de aumentar la intensidad de la presión.',source:COACHING_SOURCES.press}
    : {id:'transicion',title:'Bloque compacto y salida tras recuperar',phase:'Transición',objective:'Proteger el centro y progresar con apoyos después de recuperar.',
      route:route([defenders[0],centre,striker,right]),
      steps:[`La defensa cierra el centro; ${person(centre)} ofrece una cobertura cercana.`,
        `Tras recuperar, busca a ${person(striker)} únicamente si el pase está abierto.`,
        `${person(right!)} acompaña por fuera. Si no hay ventaja, conserva el balón y reorganiza.`],
      coaching:'El bloque se desplaza unido y mantiene una cobertura detrás del balón.',source:COACHING_SOURCES.defend},
  ];
}
