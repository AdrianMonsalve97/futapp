import type { CoachingContext } from "./coaching-context";
import { COACHING_SOURCES } from "./coaching-sources";
import type { TacticalPlay, TacticalStyle } from "./tactics";

/** Original short-passing exercises, adapted to the actual format rather than an eleven-player template. */
export function buildCombinationPlays(
  context: CoachingContext,
  style: TacticalStyle,
): TacticalPlay[] {
  const {
    keeper,
    leftDefender,
    rightDefender,
    centre,
    striker,
    left,
    right,
    person: p,
    route,
  } = context;
  const cover =
    style === "defensivo"
      ? "Mantén un defensor detrás del balón; si no hay ventaja, utiliza el apoyo del portero."
      : "Un compañero debe proteger el centro mientras el resto combina; no suban todos a la vez.";
  return [
    {
      id: "triangulo",
      category: "asociacion",
      title: "Triángulo de pase y apoyo",
      phase: "Con balón",
      objective:
        "Conservar con tres líneas de pase y mover al rival antes de progresar.",
      route: route([left, centre, right, left, centre]),
      steps: [
        `${p(left)} juega con ${p(centre)} y se vuelve a ofrecer en diagonal, sin esconderse detrás de un rival.`,
        `${p(centre)} conecta con ${p(right)} después de mirar ambos lados. Un toque si es seguro; dos si necesita orientar el control.`,
        `${p(right)} devuelve hacia ${p(left)} si la línea está abierta; ${p(centre)} cambia su apoyo para volver a recibir. Si cierran el triángulo, reinicien por detrás.`,
      ],
      coaching: `No pases por acumular pases: atrae a un rival y busca al compañero que queda libre. ${cover}`,
      source: COACHING_SOURCES.combination,
    },
    {
      id: "pared",
      category: "asociacion",
      title: "Pared corta y continuidad",
      phase: "Con balón",
      objective:
        "Superar una marca mediante pase, devolución y apoyo de un tercer compañero.",
      route: route([left, centre, left, striker]),
      steps: [
        `${p(left)} pasa a ${p(centre)} y se desmarca de inmediato por un lado de su marcador.`,
        `${p(centre)} devuelve al recorrido de ${p(left)} si ve el espacio; si la devolución está cerrada, protege y conserva.`,
        `${p(left)} recibe de perfil y conecta con ${p(striker)}; quien devuelve la pared mantiene un apoyo detrás.`,
      ],
      coaching: `La devolución va al recorrido, no al pie que ya quedó atrás. Acordad la señal antes de acelerar. ${cover}`,
      source: COACHING_SOURCES.combination,
    },
    {
      id: "tercer-hombre",
      category: "asociacion",
      title: "Tercer hombre entre líneas",
      phase: "Con balón",
      objective:
        "Liberar al organizador mediante un apoyo de espaldas y una descarga.",
      route: route([leftDefender, striker, centre, right]),
      steps: [
        `${p(leftDefender)} encuentra a ${p(striker)} al apoyo; ${p(centre)} se ofrece fuera de la sombra del rival mientras viaja el balón.`,
        `${p(striker)} descarga hacia ${p(centre)} con pocos toques si la presión le impide girar.`,
        `${p(centre)} recibe orientado y busca a ${p(right)} en el espacio disponible. Si nadie puede recibir con ventaja, vuelve atrás.`,
      ],
      coaching:
        "El tercer hombre arranca cuando el primer pase ya está viajando. Si el apoyo no puede devolver con seguridad, cambien de solución; el recorrido no es obligatorio.",
      source: COACHING_SOURCES.thirdPlayer,
    },
    {
      id: "pausa-giro",
      category: "asociacion",
      title: "Pausa, devolución y cambio de ritmo",
      phase: "Ataque organizado",
      objective:
        "Atraer la presión hacia un apoyo y acelerar hacia el lado libre.",
      route: route([centre, left, centre, right, striker]),
      steps: [
        `${p(centre)} conecta con ${p(left)} y observa si el rival abandona el lado contrario.`,
        `${p(left)} devuelve a ${p(centre)}; el organizador mira antes de recibir y cambia de orientación hacia ${p(right)}.`,
        `${p(right)} acelera solo si tiene ventaja y busca a ${p(striker)}. Si el rival no se desplaza, conserva y vuelve a construir.`,
      ],
      coaching: `La pausa sirve para leer al rival, no para detenerse esperando una marca. Cambia el ritmo cuando se abre una línea de pase. ${cover}`,
      source: COACHING_SOURCES.switch,
    },
    {
      id: "sobrecarga",
      category: "asociacion",
      title: "Juntar pases y liberar la otra banda",
      phase: "Ataque organizado",
      objective:
        "Concentrar apoyos cortos en un lado y encontrar al compañero del lado opuesto.",
      route: route([left, centre, left, centre, right, striker]),
      steps: [
        `${p(left)} y ${p(centre)} intercambian apoyos cortos; ${p(right)} conserva amplitud para no acercar a todos al balón.`,
        `Cuando la presión se concentra, ${p(centre)} encuentra a ${p(right)}. Usa un apoyo intermedio si el pase directo queda tapado.`,
        `${p(right)} recibe de perfil y combina con ${p(striker)}; el lado de origen se reorganiza para una posible pérdida.`,
      ],
      coaching:
        "No fuerces la sobrecarga si el rival no salta. El cambio de orientación necesita un receptor libre, no un envío largo automático.",
      source: COACHING_SOURCES.switch,
    },
    {
      id: "falso-nueve",
      category: "finalizacion",
      title: "Apoyo del nueve y llegada por fuera",
      phase: "Ataque organizado",
      objective:
        "Conectar con el punta al apoyo y aprovechar el espacio que deja su marcador.",
      route: route([centre, striker, centre, right, striker]),
      steps: [
        `${p(striker)} se acerca para recibir de ${p(centre)}; ${p(right)} prepara un desmarque sin ocupar la misma línea.`,
        `${p(striker)} descarga a ${p(centre)} y vuelve a ofrecer profundidad; si su marcador no lo sigue, puede girar en vez de devolver.`,
        `${p(centre)} conecta con ${p(right)}, que busca a ${p(striker)} si hay línea de remate. Eviten entrar todos al mismo espacio.`,
      ],
      coaching:
        "Es una tarea del punta en esta jugada, no un cambio permanente de posición. La entrada al espacio se decide mirando al defensor y la normativa de fuera de juego de la liga.",
      source: COACHING_SOURCES.combination,
    },
    {
      id: "pase-atras",
      category: "finalizacion",
      title: "Banda, apoyo y pase atrás",
      phase: "Ataque organizado",
      objective:
        "Buscar una llegada de frente mediante combinación exterior y devolución atrás.",
      route: route([centre, right, striker, centre]),
      steps: [
        `${p(centre)} abre hacia ${p(right)} y acompaña sin adelantarse al balón.`,
        `${p(right)} combina con ${p(striker)} en el canal exterior si hay espacio. Si cierran la banda, devuelve y cambia el ataque.`,
        `${p(striker)} busca el pase atrás hacia ${p(centre)}, que llega de frente y decide entre rematar o continuar. Un defensor conserva la cobertura.`,
      ],
      coaching:
        "Mira antes del pase atrás: el área puede estar ocupada. Coordina una llegada y una cobertura; no confundan tener posesión con rematar sin ángulo.",
      source: COACHING_SOURCES.combination,
    },
    {
      id: "reinicio",
      category: "salida",
      title: "Reciclar con el portero y volver a salir",
      phase: "Con balón",
      objective:
        "Salir de una presión cerrada sin regalar el balón en el centro.",
      route: route([centre, left, centre, keeper, rightDefender, centre]),
      steps: [
        `${p(centre)} busca a ${p(left)}; si no puede progresar, ofrece la devolución y gira el ataque hacia ${p(keeper)}.`,
        `${p(keeper)} mira antes de recibir y encuentra a ${p(rightDefender)} o conserva con ${p(leftDefender)} si esa es la opción libre.`,
        `${p(centre)} cambia el ángulo de apoyo para recibir otra vez. Los compañeros abren líneas cortas y la defensa conserva conexión con el arco.`,
      ],
      coaching:
        "El pase atrás es una herramienta para volver a encontrar ventaja. El portero recibe una entrega controlable; si cierran la salida corta, elige una alternativa segura con el entrenador.",
      source: COACHING_SOURCES.goalkeeper,
    },
  ];
}
