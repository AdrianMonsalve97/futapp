import type { CoachingSource } from "./tactics";

export const COACHING_SOURCES = {
  thirdPlayer: {
    title: "Combinaciones con tercer hombre",
    topic: "Pase, descarga y desmarque para romper líneas",
    url: "https://www.fifatrainingcentre.com/en/game/game-analysis/in-possession/third-player-combinations.php",
  },
  combination: {
    title: "Combinaciones en el último tercio",
    topic: "Paredes, apoyos y llegadas coordinadas",
    url: "https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/combination-play-in-the-final-third.php",
  },
  goalkeeper: {
    title: "Portero: apoyar, recibir y pasar",
    topic: "Apoyo del portero y salida de balón",
    url: "https://www.fifatrainingcentre.com/en/practice/elite-sessions/goalkeeper/goalkeepersbuildup.php",
  },
  build: {
    title: "Progresar por los tercios del campo",
    topic: "Salida de balón y apoyos",
    url: "https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/build-and-progress/progressing-through-the-thirds.php",
  },
  switch: {
    title: "Ben Bartlett: cambios de orientación",
    topic: "Amplitud y circulación",
    url: "https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/switching--play.php",
  },
  press: {
    title: "Presión en bloque alto",
    topic: "Presión coordinada y compactación",
    url: "https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/press-and-regain/6v6-small-sided-game-pressing-in-a-high-block.php",
  },
  defend: {
    title: "Defender como una unidad",
    topic: "Coberturas y organización defensiva",
    url: "https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/defending-as-a-unit.php",
  },
} satisfies Record<string, CoachingSource>;
