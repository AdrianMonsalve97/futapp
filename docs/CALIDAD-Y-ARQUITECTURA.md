# Criterios de mantenimiento de FutApp

El frontend conserva Atomic Design:

| Capa | Responsabilidad | Ejemplos actuales |
| --- | --- | --- |
| atoms | Controles y presentación básicos, sin consultas | Button, Modal, Icon, Alert |
| molecules | Combinaciones de controles o resúmenes pequeños | ClubPageIntro, LeagueSummary |
| organisms | Paneles funcionales y formularios compuestos | LeagueConfigEditor, LeagueResultDialog, LeagueResultsPanel, ClubNavigation |
| templates | Distribución general y navegación de la pantalla | DashboardLayout, AuthLayout |
| pages | Selección de ruta/entidad y composición de paneles | StandingsPage |
| hooks/services | Estado de interacción, consultas y transporte | useTournamentLeague, useFetch, api |

Los formularios no se implementan como grandes bloques dentro de las páginas.
Cada organismo del inicio tiene su archivo. Los tipos de clasificación se importan
desde `types/league`, manteniendo un contrato compartido sin duplicar interfaces.

En backend, las reglas puras se validan en `domain/league-config.ts`; el cálculo
vive en `domain/standings.ts`. `LeagueService` coordina puertos y transacciones,
y la persistencia se implementa detrás de `LeagueRepository`. La composición de
clases concretas queda en `container.ts`.

## Limpieza y seguridad verificadas

- Retirados selectores y animaciones de la portada anterior sin consumidores.
  Los tokens visuales se definen en `club-experience.css`; se retiraron declaraciones
  anteriores que quedaban sobrescritas y una descarga de comprobantes sin llamadas.
- El frontend representa autenticación con el usuario validado y un booleano;
  se eliminó el estado ficticio `cookie-session`. Se conserva la limpieza de claves
  antiguas del almacenamiento para no dejar credenciales de versiones anteriores.
- Las listas de campos JSON usan `Object.hasOwn`: rechazan nombres de prototipo
  tanto en la raíz como en reglas y resultados anidados. El test de regresión
  comprueba respuestas de validación, sin evaluar propiedades heredadas.
- La clasificación conserva edición con versión, permisos por rol y transacciones.
  Las recargas pendientes no sustituyen un borrador modificado; los formularios
  se bloquean durante el guardado y los snapshots atrasados se descartan.
- La auditoría de producción no encontró vulnerabilidades conocidas. Esto no
  equivale a una garantía de ausencia de fallos ni a una auditoría de penetración.

Las migraciones de base de datos y la lectura de respaldos anteriores siguen siendo
necesarias para conservar la información real. No se borran como si fueran código
muerto. La herramienta de demostración es explícita y está bloqueada en producción;
no forma parte del arranque. Los datos de prueba se crean en bases aisladas.

Antes de publicar: typecheck, pruebas funcionales y de permisos, compilación,
comprobación de producción y CI con PostgreSQL real y contenedores de ambas
arquitecturas. Los respaldos y verificadores privados se guardan fuera de Git en
`.local`; nunca se incluyen credenciales en el repositorio o en el bundle web.


La experiencia deportiva añade `SquadCollection`, cartas de rendimiento y paneles
específicos de torneo y partido. La edición de datos, estrategias y normativa usa
hooks separados de la composición de rutas; las secciones de partidos se cargan
bajo demanda. Las consultas deportivas devuelven un DTO explícito sin datos de
salud o contacto. La ubicación de canchas se valida en `domain/venue-map.ts` y se
resuelve mediante el puerto `MapsLinkResolver`, compuesto con su adaptador en
`container.ts`. Los respaldos anteriores incorporan el campo nullable sin perder
filas; también se validan los enlaces importados. Ver [Plantilla y canchas](PLANTILLA-Y-CANCHAS.md).


La navegación autenticada se compone únicamente con `ClubNavigation`; se retiraron
`Sidebar`, `Topbar` y `ClubMobileNavigation`, junto con sus selectores sin uso.
El inventario de rutas por rol vive en `data/navigation.ts`. `TacticalBoard`
comparte la presentación de la alineación entre administrador, jugador y plantilla;
`useLineupEditor` conserva sus escrituras y reglas de elegibilidad. Los tipos de
slots viven en `types/tactics.ts`, sin dependencias de moléculas hacia organismos.
Las posiciones se proyectan con funciones puras y se comprueban sus distancias
para todos los formatos. `TacticalField` comparte ahora el mismo plano en perspectiva
con la preparación individual y las jugadas animadas; las anotaciones no necesitan
otro renderizador de cancha.


`SquadWorkspace` compone el vestuario, la sala táctica y la gestión del administrador
bajo una sola entrada Plantilla. Sustituye la página duplicada `PlayersPage`;
`SquadManagement` reutiliza la tabla y el formulario existentes, con consultas y
acciones en `useSquadManagement`. La gestión privada se monta solo para el rol
administrador y se carga bajo demanda. La selección de sección y torneo conserva
el historial y los filtros; los enlaces de fichas ya publicados se redirigen a la
ruta canónica sin duplicar pantallas. Las reglas, API y datos persistidos no cambian.


La próxima fecha del calendario se compone con `UpcomingMatches`,
`NextMatchSpotlight` y la molécula `MatchFaceoff`. Reutiliza el contador, el escudo
y las confirmaciones existentes. La selección cronológica es pura y no muta el
calendario: prioriza una fecha futura programada sobre aplazados, y conserva las
fechas vencidas o sin hora para poder administrarlas. El partido destacado se
excluye de la lista restante. `useMatchCalendar` concentra consultas y acciones;
las páginas conservan solo la composición. El jugador ve el sistema publicado y
los administradores acceden al borrador; ningún atributo deportivo se inventa.
La presentación usa el estadio del club, un monograma neutral para el rival sin
escudo registrado, y animación CSS que respeta ambas preferencias de movimiento.


## Consolidación de pantallas y preparación deportiva

- El inicio presenta el próximo encuentro una vez, en `MatchDayHero`. `ClubMatchStrip`
  se limita al último resultado y las otras fechas: recibe datos del calendario del
  padre y no vuelve a consultarlos. El jugador reutiliza `/api/me/matches`, también
  utilizado para etiquetar su gráfico. Asistencia y alineación se gestionan en el
  partido; se retiraron sus copias completas del inicio y los indicadores repetidos.
- El calendario y la sala del partido comparten `MatchFormModal` y `useMatchEditor`.
  Se retiraron `MatchDataEditor` y `useMatchDataForm`. El editor conserva formato,
  duración, torneo, ubicación, marcador y notas. No consulta torneos cuando está
  cerrado, no sustituye un borrador escrito al llegar una consulta y bloquea sus
  campos durante el envío. `MatchKickoffPanel` concentra identidad, fecha, formato
  y resultado; esos datos ya no se repiten debajo en la ficha.
- Dirección deportiva tiene tareas separadas: plan del equipo, jugadas, enfoque
  individual y modelo/datos. `useCoachingWorkspace` concentra transporte y acciones;
  los paneles se cargan según la tarea. Cambiar entre plan y jugadas conserva el
  análisis, sin repetir la petición. `TacticalBoard` presenta la propuesta y la
  alineación; `TacticalPlayDetails` comparte las instrucciones de las jugadas con
  el enfoque individual. Se conservan la preparación específica del portero y las
  referencias de FIFA, sin inventar búsquedas ni métricas.
- Plantilla → Sala táctica asigna todo el ancho al tablero. Se retiró la tarjeta
  lateral estrecha con un segundo resumen del inicial; contador y contexto van
  debajo. La consulta del próximo encuentro reutiliza la selección cronológica
  del calendario, incluida su conversión de hora Colombia.
- El total y el plazo del arbitraje viven en `domain/referee-rules.json`, compartido
  con los textos de cliente. El corte es 24 horas antes: transferencia y aprobación
  deben cumplirlo para titularidad. La función pura `refereeReceiptOnTime` reconoce
  timestamps SQL en UTC, rechaza fechas de aprobación ausentes y conserva saldos
  válidos para suplencia. Las aplicaciones de saldo usan las fechas originales.
  Se prueba el límite inclusivo, revisión tardía, IA y persistencia SQLite/PostgreSQL.


## Cancha compartida y reproducción táctica

- `TacticalBoard` compone la selección de fase y las herramientas; `TacticalPlayboard`
  compone el ensayo por pasos. Ambos usan `TacticalField`, la molécula `TacticalPitch`
  para las marcas y `TacticalPosition` para las fichas con fotos privadas. La sesión
  sigue usando cookies HttpOnly y `Avatar` resuelve las imágenes autenticadas.
- `tacticalLayout` concentra la proyección trapezoidal, las distancias de las fichas
  y la altura acotada (260–407 px). El ancho real del contenedor determina fichas
  compactas de al menos 44×48 px y separa las líneas concurridas sin recortar la cancha.
  El formato se recibe del partido o de la preparación, sin
  inferirlo del número de puestos ocupados. Se conservaron las coordenadas guardadas.
  `FormationPitch`, `PitchPortrait` y la geometría plana anterior se retiraron junto
  con sus estilos sin consumidores.
- `useTacticalPlayback` controla reproducción voluntaria, pausa, navegación por pasos,
  reinicio y cancelación de temporizadores; al ocultar la página se pausa. Flechas y
  balón comparten los puntos proyectados y el ancho real observado por el hook
  `useElementWidth`, para seguir las fichas al redimensionar la ventana.
- El enfoque individual utiliza los mismos controles con/sin balón, resalta al
  jugador y la zona de su rol, incluido el portero, y conserva los apoyos.
  El campo completo cabe por defecto en el ancho disponible (hasta 860 px), sin
  ampliación ni desplazamiento horizontal. Las fichas muestran foto, posición y
  dorsal. El retrato rectangular ocupa la carta completa, con degradado, posición y
  dorsal superpuestos, siguiendo la presentación de Plantilla mediante el mismo
  átomo `Avatar`; no se usa un recorte circular ni se amplía la geometría del campo.
  El rol completo queda en el detalle accesible al seleccionar. Las transiciones
  respetan movimiento reducido y el control de animaciones de la aplicación.
- Las pruebas cubren todo el catálogo F5/F7/F8/F11, separación con fotos, recorridos
  reales de entrenamiento, pases de vuelta, referencias ausentes, posición del
  balón al redimensionar, capas de apoyo y preparación del portero. Son diagramas
  de práctica, sin modificar convocatorias, elegibilidad, pagos ni formación oficial.
