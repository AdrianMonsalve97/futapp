# Experiencia del club y clasificación

La organización del código y las reglas de mantenimiento se describen en
[Calidad y arquitectura](CALIDAD-Y-ARQUITECTURA.md).

La identidad visual sigue el escudo y el color configurados. La primera entrada
al nuevo diseño activa el modo estadio (oscuro); el usuario puede alternar modo
día y noche y pausar animaciones. Se respeta `prefers-reduced-motion`. Las rutas
tienen transiciones breves, foco accesible y navegación fija en móvil.

La portada muestra solo información registrada: próximo partido, último marcador
completo, calendario, clasificación provisional, fotos de integrantes activos del
torneo y referencias originales de equipaciones. No incluye patrocinadores,
noticias, resultados o jugadores ficticios del mockup.

## Flujos del jugador

- Registro: invitación y cuenta → posición/dorsal → solicitud pendiente de aval.
  El administrador sigue aprobando la entrada y la convocatoria a cada torneo.
- Mis pagos (`/jugador/pagos`): elegir inscripción, arbitraje o equipación →
  transferencia por el QR del equipo → soporte a revisión. Los saldos, fechas,
  comprobantes e históricos mantienen sus verificaciones y permisos.
- Partido: consultar fecha y cancha, confirmar asistencia, pagar arbitraje y
  consultar la alineación publicada. El arbitraje conserva el plazo de 48 horas,
  suplencia por pago tardío y saldo para próximas fechas si no se asiste.
- Tienda: imágenes de los uniformes guardados, elección de prenda/talla/destinatario,
  solicitud, seguimiento de pedido y pago.

## Tabla de posiciones

Disponible para jugadores y administradores en «Tabla de posiciones» y desde la
ficha del torneo. Cada torneo conserva su propia configuración y sus resultados.

1. El administrador registra los participantes restantes en «Configurar equipos
   y puntuación». El club y los rivales de sus partidos aparecen automáticamente.
2. El resultado del club se registra en **Partidos**, con el torneo correcto,
   estado **jugado** y ambos goles. En clasificación se puede asignar su jornada.
3. «Resultado de la jornada» registra partidos entre los otros equipos. Permite
   editar, posponer, cancelar o eliminar encuentros con confirmación.
4. Los puntos y estadísticas se calculan al consultar. No hay puntos acumulados
   que queden obsoletos al corregir un resultado. Solo cuentan partidos jugados
   con ambos marcadores enteros entre 0 y 99; un 0–0 sí cuenta como empate.

Valores iniciales: victoria 3, empate 1, derrota 0; diferencia de gol y después
goles a favor. Son configurables por torneo (0–20 puntos, orden DG/GF o GF/DG).
Una igualdad completa comparte posición; el orden alfabético es solo visual.
No se implementan sanciones deportivas de puntos o enfrentamientos directos como
desempate sin confirmar esa normativa. La tabla se etiqueta provisional porque
solo conoce los resultados cargados, y no se presenta como una fuente oficial.

La pantalla consulta de nuevo cada minuto visible y al recuperar foco. La edición
sin guardar detiene esa recarga para no perder cambios. Las escrituras exigen
administrador y una versión vigente; un conflicto devuelve 409 sin sobrescribir.
No se permiten encuentros del club en la carga de otros equipos ni encuentros
duplicados de los mismos equipos en una jornada.

## Persistencia y validación

`tournament_leagues` guarda un agregado JSON validado y versionado por torneo. Se
crea de manera aditiva en SQLite y PostgreSQL; no modifica registros existentes.
Los respaldos incluyen la tabla. Los respaldos anteriores a esta versión se
validan añadiendo la tabla vacía. Las asignaciones de jornada huérfanas se omiten
si un partido fue eliminado o cambiado de torneo.

`tests/standings.test.mts` comprueba cálculo, aislamiento por torneo, formatos,
localía, correcciones, cancelaciones, borrado, permisos, privacidad de borradores,
validación de cuerpos, conflictos de versión y compatibilidad de respaldos en
SQLite y PostgreSQL. CI también ejecuta el archivo con PostgreSQL 17 real.

## Fondo de estadio

Archivo de la app: `frontend/public/brand/stadium-night.webp` (108 KB). Generado con
la herramienta integrada de la habilidad imagegen y optimizado con Sharp. El
escudo, las fotos de jugadores y las prendas son los originales de la app.

Prompt final:

> Use case: atmospheric sports editorial photograph. Asset type: wide background
> for a real amateur football club's black and gold website. Create a cinematic
> photoreal football stadium at night seen from pitch level near the touchline:
> beautiful warm gold floodlights across upper right and top, atmospheric mist,
> subtle out-of-focus crowd and flags in stands, crisp near green grass along
> bottom right, dramatic charcoal black shadows occupying left 45 percent for
> white headline overlay. Wide landscape 3:2 or wider composition. Strong premium
> football emotion, actual photographic detail, dark restrained lighting, no
> central person, no jersey, no lettering, no logos, no sponsors, no watermarks.
> The site will overlay its own real crest and real kit photos, so leave the
> stadium free of invented club identity. Deliver a background photograph only,
> not a website mockup.


## Navegación y sala táctica

Una sola navegación superior reúne Inicio, Plantilla, Partidos, La liga y Tienda;
Más conserva las demás rutas por rol. En móvil se despliega desde la misma cabecera.
La barra lateral y el menú inferior se retiraron.

El inicio recupera el próximo rival, la cancha, la fecha y una cuenta regresiva
sobre la hora de Colombia. El contador se actualiza por segundo mientras la pestaña
está visible. Alcanzar la hora prevista no se presenta como una transmisión en vivo.
Los partidos pospuestos, cancelados y jugados tienen mensajes propios.

La gestión abre en la sala táctica: consola lateral de formación, IA y distribución,
cancha en perspectiva con fichas de nombre/dorsal/función y acciones de guardar o
publicar. Elegir una posición abre una lista con fotos de los jugadores elegibles.
Mover un jugador deja libre su posición anterior y no lo duplica. Las reglas de
asistencia, arbitraje y publicación siguen validadas en el servidor.

Plantilla separa El vestuario, con retratos más grandes, y Sala táctica, con el sistema
del próximo partido. Los jugadores consultan la alineación publicada; el administrador
puede preparar su borrador. Los retratos completos dejan de repetirse en el inicio.

La referencia visual de FC aportada por el usuario se recrea mediante HTML, SVG y CSS
propios; los controles de formación, IA y publicación usan las operaciones reales.
No se presentan valores ficticios de química, atributos físicos o rendimiento.
