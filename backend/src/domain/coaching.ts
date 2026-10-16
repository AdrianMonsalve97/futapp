import type { LineupSlot } from "./entities";
import type { TacticalPlay, TacticalStyle } from "./tactics";
import { COACHING_SOURCES } from "./coaching-sources";
import { coachingContext } from "./coaching-context";
import { buildCombinationPlays } from "./combination-plays";

/** Original adaptations of coaching principles; not copies of FIFA session plans. */
export function buildPlays(
  slots: LineupSlot[],
  style: TacticalStyle,
): TacticalPlay[] {
  const context = coachingContext(slots);
  if (!context) return [];
  const {
    keeper,
    leftDefender,
    rightDefender,
    centre,
    striker,
    left,
    right,
    person,
    route,
  } = context;
  const coveringDefender =
    rightDefender.slotIndex === centre.slotIndex ? leftDefender : rightDefender;
  return [
    {
      id: "portero",
      category: "salida",
      title: "Portero conectado con la defensa",
      phase: "Con balón",
      objective:
        "Crear una salida segura con apoyo del arquero y cobertura ante pérdida.",
      route: route([leftDefender, keeper, rightDefender, centre]),
      steps: [
        `${person(leftDefender)} identifica la presión y utiliza a ${person(keeper)} si la salida está cerrada.`,
        `${person(keeper)} mira antes de recibir, controla orientado y busca el defensor libre.`,
        `${person(centre)} ofrece una tercera opción; si no hay línea segura, conserva el balón sin forzar el pase interior.`,
      ],
      coaching:
        "Después del pase, el portero reajusta su posición con la línea defensiva. Acordad juntos la altura del bloque y la cobertura de balones a la espalda.",
      source: COACHING_SOURCES.goalkeeper,
    },
    {
      id: "salida",
      category: "salida",
      title: "Salida con apoyo y tercer hombre",
      phase: "Con balón",
      objective: "Superar la primera presión sin perder la estructura.",
      route: route([keeper, leftDefender, centre, striker]),
      steps: [
        `${person(keeper)} inicia hacia ${person(leftDefender)}; abre el campo antes de recibir.`,
        `${person(centre)} se ofrece en diagonal, con el cuerpo orientado hacia adelante.`,
        `${person(striker)} fija al defensor y ataca el espacio cuando el pase es posible.`,
      ],
      coaching:
        style === "defensivo"
          ? "Si el pase interior está cerrado, vuelve al portero y evita arriesgar en el centro."
          : "El receptor debe tener apoyo cercano y una segunda opción antes del pase.",
      source: COACHING_SOURCES.build,
    },
    {
      id: "amplitud",
      category: "asociacion",
      title: "Atraer a una banda y cambiar de lado",
      phase: "Ataque organizado",
      objective: "Crear espacio en el lado opuesto y llegar con apoyo.",
      route: route([left, centre, right, striker]),
      steps: [
        `${person(left)} atrae al rival y juega con ${person(centre)}.`,
        `${person(right)} mantiene amplitud y recibe el cambio de orientación.`,
        `${person(striker)} ataca el área; el lado opuesto cubre una posible pérdida.`,
      ],
      coaching:
        "No fuerces un pase largo: si el rival cierra la línea, circula con un apoyo intermedio.",
      source: COACHING_SOURCES.switch,
    },
    style === "ofensivo"
      ? {
          id: "presion",
          category: "recuperacion",
          title: "Presión coordinada tras pérdida",
          phase: "Sin balón",
          objective: "Cerrar la salida rival sin abrir espacios entre líneas.",
          route: route([striker, centre, coveringDefender]),
          steps: [
            `${person(striker)} orienta la presión hacia una banda cuando aparece un mal control o pase atrás.`,
            `${person(centre)} cierra el pase interior; no persigas solo al poseedor.`,
            "La defensa avanza junta. Si el rival supera la presión, repliega y recompón el bloque.",
          ],
          coaching:
            "Practica la coordinación antes de aumentar la intensidad de la presión.",
          source: COACHING_SOURCES.press,
        }
      : {
          id: "transicion",
          category: "recuperacion",
          title: "Bloque compacto y salida tras recuperar",
          phase: "Transición",
          objective:
            "Proteger el centro y progresar con apoyos después de recuperar.",
          route: route([leftDefender, centre, striker, right]),
          steps: [
            `La defensa cierra el centro; ${person(centre)} ofrece una cobertura cercana.`,
            `Tras recuperar, busca a ${person(striker)} únicamente si el pase está abierto.`,
            `${person(right)} acompaña por fuera. Si no hay ventaja, conserva el balón y reorganiza.`,
          ],
          coaching:
            "El bloque se desplaza unido y mantiene una cobertura detrás del balón.",
          source: COACHING_SOURCES.defend,
        },
    ...buildCombinationPlays(context, style),
  ];
}
