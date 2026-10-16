# Biblioteca de juego asociativo

La biblioteca ofrece doce propuestas por formación: conserva las cuatro anteriores
y añade ocho recorridos para practicar pase corto, apoyos y cambios de ritmo. Se
comparte entre Dirección deportiva y el enfoque individual, incluido el portero.

| Jugada nueva | Tarea principal |
| --- | --- |
| Triángulo de pase y apoyo | Conservar con tres receptores y volver a ofrecerse |
| Pared corta y continuidad | Pasar, desmarcarse, recibir la devolución y conectar |
| Tercer hombre entre líneas | Apoyo de espaldas, descarga y receptor orientado |
| Pausa, devolución y cambio de ritmo | Atraer antes de acelerar hacia el lado libre |
| Juntar pases y liberar la otra banda | Apoyos cercanos y amplitud del lado opuesto |
| Apoyo del nueve y llegada por fuera | Descarga del punta y llegada coordinada |
| Banda, apoyo y pase atrás | Llegada de frente con cobertura detrás del balón |
| Reciclar con el portero y volver a salir | Recuperar un ángulo seguro de salida |

Las rutas usan los índices de los puestos de la formación actual. En F8 se mantiene
el portero y los siete jugadores de campo; los roles, nombres, fotos y vacantes
proceden del plan autorizado. El organizador se resuelve por su posición y existen
alternativas para los formatos pequeños sin mediocampistas. No se asignan jugadores
nuevos ni se escribe sobre el inicial guardado. Una formación incompleta sin los
roles necesarios no genera una biblioteca ficticia.

Los pases de vuelta se conservan. Solo se eliminan receptores consecutivos iguales,
para evitar animar un pase del jugador a sí mismo. El recorrido representa la
circulación del balón; los desmarques y las decisiones se explican en los pasos,
sin representar los movimientos de un rival que no está registrado.

Las instrucciones incluyen opciones cuando un pase se cierra, coberturas y lectura
antes de recibir. El número de toques depende de la presión; no se exige jugar
siempre de primera. La tarea del punta al apoyo no cambia su posición permanente.
El fuera de juego, los cambios y la duración siguen la normativa real del torneo;
se conserva el corte de arbitraje para la elegibilidad del inicial.

`coaching-context.ts` resuelve los puestos sin I/O; `combination-plays.ts` construye
las ocho propuestas; `coaching.ts` compone el catálogo. Las referencias viven en
`coaching-sources.ts`. El frontend reutiliza el contrato de jugada del dominio y
la molécula `TacticalPlayPicker`, con grupos nativos accesibles, para no crear doce
botones ni duplicar selectores. El guardado sigue el caso de uso existente de
estrategias del partido; no hay nuevas tablas ni migraciones.

La inspiración asociativa se apoya en la [visión de Fàbregas publicada por Como](https://comofootball.com/en/fabregas-sul-futuro-da-coach-del-como-1907/).
Las propuestas son adaptaciones originales para practicar, apoyadas en los
principios de [tercer hombre](https://www.fifatrainingcentre.com/en/game/game-analysis/in-possession/third-player-combinations.php)
y [combinaciones en el último tercio de FIFA](https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/combination-play-in-the-final-third.php).
No se presentan como ejercicios oficiales de Fàbregas ni como predicciones del modelo.

Las pruebas cubren los catorce sistemas F5/F7/F8/F11, los tres estilos, la conservación
de identidades, recorridos sin autopases, paredes, reinicio del portero, vacantes y
la privacidad del enfoque antes de publicar una alineación. La geometría compartida
valida también los nuevos recorridos en móvil y escritorio.
