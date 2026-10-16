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
para todos los formatos. La cancha con anotaciones de IA mantiene su componente
específico porque permite jugadas y enfoque individual que requieren esas capas.


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
