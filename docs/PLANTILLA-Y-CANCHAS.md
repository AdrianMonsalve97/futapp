# Plantilla, competición y canchas

## Experiencia deportiva

La sección **Plantilla** (`/admin/plantilla` y `/jugador/plantilla`) muestra integrantes activos y aprobados. Permite elegir torneo, posición principal o secundaria, buscar por nombre/dorsal y ordenar por dorsal, media o goles.

Las cartas usan las fotos reales del club. Su media es sobre **10**, derivada de estadísticas registradas en partidos **jugados**. No se inventan valores de velocidad, físico, atajadas ni atributos de videojuegos. Una ficha sin actuaciones muestra una raya y cero registros. Al seleccionar una carta se abren minutos, goles, asistencias, recuperaciones, entradas, intercepciones, precisión de pase/tiro y las últimas cinco actuaciones. El gráfico conserva su escala sobre 10 y enlaza al partido. Tocar una foto de la alineación del jugador abre el mismo detalle.

Referencia visual: composición de cartas y sala de plantilla de [EA SPORTS FC 27](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-launch-update). La implementación, el escudo, las fotos y los estilos pertenecen a FutApp; no utiliza recursos gráficos de EA.

La navegación tiene una sola entrada **Plantilla**, con **El vestuario**, **Sala táctica** y, únicamente para administradores, **Gestionar integrantes**. Esta última reúne altas, edición, avales de ingreso, reactivación y baja definitiva; conserva las confirmaciones y los permisos existentes. Gestiona las cuentas de todo el club; el filtro de torneo se conserva al volver a las vistas deportivas. Las fichas privadas están en `/admin/plantilla/:id` y vuelven a la gestión. Los enlaces publicados anteriormente bajo `/admin/jugadores` redirigen a la ruta unificada, sin mantener otra página de jugadores.

La gestión se carga bajo demanda y sus consultas viven en `useSquadManagement`; no se monta para jugadores ni al abrir las vistas deportivas. La sección seleccionada queda en `vista` para permitir enlaces directos y volver con el historial del navegador. `/api/squad` tiene un contrato deportivo explícito: no devuelve correo, teléfono, identidad, salud, contacto de emergencia ni credenciales. Las vistas de jugador excluyen estadísticas de torneos en borrador, incluso al consultar todo el club. El administrador puede consultar esos datos deportivos. Dos lecturas agrupadas evitan consultas por cada jugador.

## Menos tareas por pantalla

- Partido del administrador: partido, asistencia/arbitraje, alineación/plan, rendimiento y edición.
- Partido del jugador: voy al partido, alineación/plan y mi actuación.
- Calendario: próximas fechas, resultados y cancelados en administración.
- Torneo: normativa/documentos, jugadores inscritos y afiche.
- Liga: clasificación, jornadas/resultados y configuración para administradores. Seleccionar un equipo abre racha, goles y encuentros reales; no simula cambios de posición.

Las páginas componen rutas y paneles. Los formularios, presentación deportiva y estado de edición viven en organismos y hooks específicos. Se reutilizan los componentes existentes de pagos, asistencia, alineación, documentos y estadísticas.

## Ubicación de la cancha

En **Nuevo/Editar partido → Enlace de Google Maps**, pega el enlace de **Compartir** de la cancha. Acepta enlaces completos, enlaces cortos `maps.app.goo.gl`/`goo.gl/maps` y el URL de un mapa compartido con `/maps/embed?pb=…` (solo el URL, sin HTML). Guardar vacío elimina la ubicación.

El detalle muestra el mapa y el botón **Cómo llegar**. Las instrucciones de ruta se abren en Google Maps; el navegador no solicita ubicación desde FutApp. Un enlace de inserción `pb` o identificación `cid` conserva su mapa y abre la ubicación compartida; el usuario puede seleccionar indicaciones allí. No necesita una clave adicional de Google ni un servicio de pago de mapas. Un enlace que solo indica el centro de la vista, sin lugar, coordenadas del pin ni consulta, se rechaza para evitar señalar una cancha incorrecta.

El dominio valida HTTPS, hosts y rutas. El puerto `MapsLinkResolver` separa la resolución de enlaces cortos: el adaptador valida cada redirección, limita cinco saltos y siete segundos, y nunca sigue destinos ajenos a Maps. El backend persiste el enlace normalizado; el iframe se calcula desde ese enlace. CSP autoriza únicamente las rutas de mapas de `www.google.com`, junto con el proveedor de vídeo ya existente. No se admite HTML arbitrario.

Referencias: [URLs universales de Maps](https://developers.google.com/maps/documentation/urls/get-started) y [compartir e insertar mapas](https://support.google.com/maps/answer/7101463?hl=es).

## Datos y verificación

La columna nullable `matches.venue_maps_url` se agrega sin reconstruir ni borrar partidos. La migración PostgreSQL es idempotente. Los respaldos anteriores reciben la columna con `null` al validarse; se preservan cuentas, archivos, pagos y resultados. Los respaldos nuevos conservan la ubicación.

`tests/squad-and-maps.test.mts` cubre enlaces, redirecciones inseguras, permisos de escritura/lectura, borrado de ubicación, agregación deportiva, privacidad, torneos en borrador, jugadores inactivos/pendientes y compatibilidad de respaldos en SQLite y PostgreSQL. GitHub Actions ejecuta además PostgreSQL real antes de desplegar el commit validado a Render.
