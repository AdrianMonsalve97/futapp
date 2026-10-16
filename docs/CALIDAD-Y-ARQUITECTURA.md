# Criterios de mantenimiento de FutApp

El frontend conserva Atomic Design:

| Capa | Responsabilidad | Ejemplos actuales |
| --- | --- | --- |
| atoms | Controles y presentación básicos, sin consultas | Button, Modal, Icon, Alert |
| molecules | Combinaciones de controles o resúmenes pequeños | ClubPageIntro, LeagueSummary |
| organisms | Paneles funcionales y formularios compuestos | LeagueConfigEditor, LeagueResultDialog, LeagueResultsPanel, ClubMobileNavigation |
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
