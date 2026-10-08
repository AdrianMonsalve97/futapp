# ⚽ Club Portal — Portal Administrativo de Equipo de Fútbol

Aplicación full-stack para gestionar un equipo de fútbol: inscripciones y cobros, uniformes,
formaciones y estrategias del fin de semana, sanciones y tarjetas, estadísticas y un **modelo de IA**
(explicable, entrenable) que sugiere el XI ideal, predice calificaciones y proyecta resultados.

El laboratorio deportivo del administrador analiza el partido seleccionado: muestra el 5, 7, 8 u 11 inicial según su formato, su duración efectiva, cobertura por posición, comparación de formaciones habilitadas, banco y jugadas con diagramas por pasos. Los estilos equilibrado, ofensivo y defensivo permiten evaluar escenarios sin alterar las reglas del torneo. Las jugadas se pueden guardar en las estrategias del partido. La búsqueda web consulta la biblioteca del FIFA Training Centre por estilo, verifica los recursos encontrados y muestra fecha, enlaces y fallos de conexión; no envía datos personales. Las propuestas deportivas son adaptaciones por reglas para que las revise el entrenador, no interpretaciones generadas por un LLM.

En Mi inscripción y Mis uniformes el jugador ve el QR protegido del equipo (ampliable y descargable), el saldo y el formulario para adjuntar soporte PDF/JPG/PNG/WEBP de hasta 8 MB. El monto, fecha y referencia quedan pendientes hasta que el administrador aprueba o rechaza desde Pagos QR y soportes. Aprobar registra el abono de inscripción o de uniforme una sola vez; rechazar no altera el saldo. Las nuevas solicitudes conservan el precio cotizado y vinculan el pago a la entrega, evitando cobrar dos veces el uniforme. Los comprobantes son privados para su dueño y administradores, se respaldan con uploads y no se realizan transferencias bancarias desde FutApp.

| Capa | Tecnología |
|---|---|
| Frontend | **React 19 + TypeScript + Vite 8**, **DaisyUI 5 / Tailwind CSS 4**, arquitectura **Atomic Design** |
| Backend | **Node.js + TypeScript + Express 5**, **arquitectura hexagonal** (puertos y adaptadores) |
| Base de datos | **SQLite** para desarrollo y Docker; **PostgreSQL / Supabase** para Render Free |
| Auth | JWT (HS256) + bcryptjs, roles `admin` y `player` |
| IA | Regresión lineal entrenada con gradiente descenso sobre las estadísticas del plantel + XI recomendado (greedy + mejora local) + probabilidad de resultado (logística) |

## Identidad, fotos y normativa de la liga

- **Configuración:** escudo del equipo y color principal. Se incluye el escudo AAG entregado por el equipo con el diseño negro y dorado. La marca también se ve antes de iniciar sesión.
- **Uniformes:** una imagen de referencia por prenda, visible para administradores y jugadores. Se puede cargar al crear la prenda o desde Editar.
- **Mi perfil:** cada jugador puede subir, sustituir o quitar su foto. Las imágenes se validan y convierten a WEBP sin metadatos; formatos admitidos JPG, PNG o WEBP, hasta 8 MB y 24 megapíxeles.
- **Salud:** apartado del perfil con EPS, medicina prepagada y contacto de emergencia. El jugador edita sus propios datos y los administradores los gestionan desde la pestaña Salud de su ficha o al crear/editar el jugador. Los campos son opcionales, admiten borrar el valor y no se comparten con otros jugadores. Las bases existentes incorporan las columnas sin modificar la información previa.
- **Torneos y normativa:** crear el torneo, confirmar jugadores en cancha, tiempos, minutos, descansos, convocatoria, cambios y reingreso. El entrenador elige las formaciones a evaluar y el enfoque táctico. Publicar comparte las reglas, indicaciones y documentos con todos los jugadores; los borradores son privados para administración.
- **Foto del torneo:** desde la ficha se puede subir, sustituir o quitar un afiche, logo o foto JPG/PNG/WEBP de hasta 8 MB. Aparece en la lista y se puede ampliar desde la ficha. Se valida y convierte a WEBP sin metadatos; su acceso requiere sesión y respeta la privacidad del borrador. Se guarda en uploads y se incluye en los respaldos.
- **Documentos:** PDF, TXT/MD UTF-8 o imágenes, hasta 12 MB y 100 páginas de PDF. Se conserva el original y se extrae el texto de PDFs legibles. Un PDF escaneado o una fotografía puede necesitar indicaciones manuales; no hay OCR. La IA recibe el contexto documental, pero las reglas se confirman en el formulario y no se cambian automáticamente.
- **Partidos:** seleccionar un torneo usa su formato y duración real. Cada partido conserva una copia de las reglas; las modificaciones posteriores se aplican a nuevos partidos o al seleccionar otra vez el torneo en un encuentro pendiente. Los partidos jugados conservan su torneo. Para amistosos independientes la duración es editable.
- **IA:** compara las formaciones habilitadas según el encaje de posiciones principales y secundarias, disponibilidad, rendimiento y enfoque táctico; sugiere titulares y suplentes dentro del cupo. El análisis muestra reglas, indicaciones y extractos de los documentos. Las estadísticas se normalizan por la duración real de cada partido. Los jugadores ven el contexto de liga en su análisis personal, sin revelar el borrador de alineación.

En modo SQLite, los archivos se guardan en `uploads/`, junto a la base definida por `DB_PATH`; `npm run backup` incluye la base, el modelo y los archivos. En Render Free, los datos y el modelo quedan en PostgreSQL y los archivos en Supabase Storage; el apartado de migración permite exportar los datos y archivos. Las fotos y los documentos se descargan con sesión autenticada; solo el escudo vigente y la identidad del club tienen acceso público. Los archivos cargados no se incluyen en Git.

El descanso, el límite de convocatoria y el reingreso pueden quedar **por confirmar**. La IA distingue cambios ilimitados de reingreso permitido, y no impone un cupo de liga cuando aún no está confirmado.

---

## 🚀 Puesta en marcha

Requisitos: **Node.js >= 24**.

```bash
npm ci               # instala workspaces (backend + frontend) con el lockfile
npm run seed         # crea backend/data/portal.db con datos de demostración
npm run dev          # backend :4000  +  frontend :5173
```

Abrí **http://localhost:5173**.

Otros comandos:

```bash
npm run dev:api      # solo API
npm run dev:web      # solo Vite
npm run build        # tsc (backend) + tsc && vite build (frontend)
npm run start        # API compilada (node dist/main.js)
npm run typecheck    # chequeo de tipos de ambos
npm test             # pruebas de regresión con una base temporal independiente
npm run backup       # copia consistente de SQLite, modelo y archivos cargados
```

### Usuarios demo

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@club.com` | `Admin123!` |
| Jugador | `jugador01@club.com` … `jugador14@club.com` | `Jugador123!` |

Estas cuentas solo existen al ejecutar el seed opcional. Para el equipo real, el administrador genera un enlace desde Configuración → Invitar integrantes; cada jugador se registra con esa invitación (vence en 7 días).

---

## 🗂 Estructura

```
futbol-portal/
├── docs/SPEC.md          # Contrato técnico único (esquema SQL, API, modelo de IA, UI)
├── scripts/dev.mjs       # `npm run dev` sin dependencias externas
├── backend/              # API hexagonal
│   └── src/
│       ├── domain/            # entidades, errores, catálogo de formaciones, modelo de IA
│       ├── application/
│       │   ├── ports/in/       # puertos entrantes (casos de uso)
│       │   ├── ports/out/      # puertos salientes (repositorios)
│       │   └── services/       # lógica de negocio (sin Express ni SQL)
│       └── adapters/
│           ├── in/rest/        # Express: rutas, middlewares, error handler
│           └── out/persistence/ # SQLite / PostgreSQL, archivos locales / Supabase
└── frontend/             # React + Atomic Design
    └── src/
        ├── atoms/        # botón, input, card, badge, modal…
        ├── molecules/    # form field, status badge, position badge…
        ├── organisms/    # sidebar, tablas, formation pitch, charts SVG, editors
        ├── templates/    # AuthLayout, DashboardLayout, PageHeader, ProtectedRoute
        └── pages/        # login, jugador/*, admin/*
```

### Reglas de la arquitectura hexagonal

1. `domain/` no depende de nadie.
2. `application/services/` depende solo de `domain/` y de los puertos; **nunca** de Express ni SQLite.
3. Los repositorios (`adapters/out`) **implementan** los puertos definidos en `application/ports/out`.
4. Las rutas (`adapters/in`) solo traducen HTTP ↔ casos de uso.
5. `container.ts` es el único lugar que une puertos con implementaciones concretas.

---

## 🔌 API (resumen)

Prefijo `/api`. El navegador utiliza cookie HttpOnly de sesión (SameSite=Strict y Secure sobre HTTPS); no guarda JWT en localStorage. Los clientes de API también admiten `Authorization: Bearer <token>`, con sesiones revocables. Errores: `{ "error": { "message": "..." } }`.

| Grupo | Ejemplos | Rol |
|---|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` | público/auth |
| Yo (jugador) | `GET /api/me`, `PUT /api/me/profile`, `GET /api/me/inscription`, `GET /api/me/uniforms`, `POST /api/me/uniform-requests`, `GET /api/me/matches`, `GET /api/me/stats`, `GET /api/me/ai` | auth |
| Partidos | `GET/POST/PUT/DELETE /api/matches`, `PUT /api/matches/:id/lineup`, `POST /api/matches/:id/lineup/auto`, `POST /api/matches/:id/strategies`, `POST /api/matches/:id/stats` | auth / admin |
| Jugadores | `GET/POST/PUT/DELETE /api/players` | admin |
| Inscripciones | `GET /api/inscriptions`, `POST /api/inscriptions/:id/payments` | admin |
| Uniformes | `GET/POST/PUT /api/uniforms`, `POST /api/uniform-issues`, `PUT /api/uniform-requests/:id` | admin |
| Sanciones | `GET/POST/PUT/DELETE /api/sanctions` | admin |
| Estadísticas | `GET /api/stats`, `GET /api/team/stats` | auth |
| Dashboard | `GET /api/dashboard/admin`, `GET /api/dashboard/player` | admin / auth |
| IA | `GET /api/ai/insights`, `GET /api/ai/players/:id`, `GET /api/ai/model`, `POST /api/ai/model/train`, `POST /api/ai/recommend-xi` | auth / admin |

El contrato completo (paths, bodies, formas de respuesta, esquema SQL y modelo de IA) vive en
[`docs/SPEC.md`](docs/SPEC.md).

---

## 🤖 Modelo de IA

* **Features por jugador** normalizadas por la duración del formato: goles, asistencias, precisión de tiro/pase,
  acciones defensivas, regates, continuidad, disciplina, faltas y tendencia de calificación.
* **Entrenamiento**: regresión lineal con descenso de gradiente por lotes (600 épocas, α = 0.05) sobre
  el promedio de las cinco apariciones anteriores para predecir la siguiente calificación.
  Con al menos tres partidos disponibles para pronóstico, reserva los últimos 20% de partidos
  para validación cronológica; muestra sus métricas **MAE / RMSE / R²** aparte del entrenamiento.
  Los datos del partido objetivo no entran en sus features. Se reentrena con
  `POST /api/ai/model/train` o desde la página *Admin → IA*.
* **XI sugerido**: asignación *greedy* por restricción de posición (POR → DEF → MED → DEL) con
  mejora local por intercambios, excluyendo jugadores inactivos, suspendidos o que no pueden asistir.
* **Próximo partido**: probabilidad victoria/empate/derrota por función logística y proyección de goles.
* **Forecast individual**: media ponderada de los últimos 5 ratings, tendencia, confianza,
  fortalezas y debilidades comparadas contra el promedio del plantel.

---

## 🧪 Verificación

```bash
npm run typecheck     # 0 errores TS en backend y frontend
npm test              # pagos, inventario, permisos, asistencia, publicación e IA
npm run build         # dist/ (backend) + dist/ (frontend)
npm run test:production # verifica el build con NODE_ENV=production y una base aislada
```

## Centro de juego y preparación de partidos

La interfaz incluye identidad futbolera, cuenta regresiva al próximo encuentro, últimos resultados,
pulso financiero, modo noche y animaciones que pueden pausarse desde la barra superior.
También respeta la preferencia del sistema de reducir movimiento.

Cada jugador confirma su asistencia con **Voy**, **No puedo** o **Lo confirmaré luego**.
El administrador ve el plantel disponible en el tablero del partido.
**Guardar borrador** conserva los cambios para el administrador; **Publicar alineación**
crea una copia visible para los jugadores. Editar el borrador después no modifica esa publicación.
Cambiar el formato del partido exige publicar de nuevo. Las alineaciones existentes se conservan
como publicadas en la primera migración.

| Ruta nueva | Acceso |
|---|---|
| `GET /api/health` | Público |
| `GET /api/matches/:id/attendance` | Admin |
| `GET/PUT /api/me/matches/:id/attendance` | Jugador autenticado; solo su asistencia |
| `POST /api/matches/:id/lineup/publish` | Admin |

Los pagos aceptan `Idempotency-Key` (8 a 128 caracteres alfanuméricos, guion o guion bajo).
Repetir la misma clave y datos devuelve el cobro existente; reutilizarla con otros datos se rechaza.
El historial muestra quién registró el pago. Los cobros y movimientos de inventario se ejecutan
en transacciones; un error revierte la operación completa.

## Seguridad, transmisión y comienzo del equipo

Las sesiones se pueden revocar: cerrar sesión, cambiar contraseña, rol o estado invalida el acceso correspondiente. Las contraseñas nuevas requieren al menos 15 caracteres y como máximo 72 bytes UTF-8. Se limita la frecuencia de peticiones, intentos de acceso y registro. Las operaciones del navegador verifican el origen para prevenir CSRF; la API y los archivos privados no se almacenan en caché. En producción se aplican cabeceras de seguridad y una política CSP con destinos de video restringidos. Mantén HTTPS, secretos aleatorios, dependencias actualizadas y respaldos externos. Estas medidas reducen riesgos; no constituyen una garantía de invulnerabilidad ni una auditoría externa.

El menú **Transmisiones** reúne los partidos para guardar, sustituir o quitar su enlace de YouTube Live desde administración. Los jugadores ven las emisiones y grabaciones disponibles y pueden abrir el reproductor dentro de FutApp, usar pantalla completa o abrir YouTube. El enlace también se administra desde el tablero del partido. La emisión se realiza desde un canal habilitado de YouTube y el teléfono o software del operador; FutApp no captura ni retransmite la cámara por sí mismo.

Los **dorsales son únicos en todo el plantel**, también para cuentas inactivas. El registro, la administración y el perfil propio rechazan un número ocupado. Varios integrantes pueden estar sin dorsal; vaciar el campo libera el número para otro jugador. La base de datos impide asignaciones duplicadas concurrentes. Una base antigua que ya tenga duplicados requiere corregirlos antes de activar esta restricción; la migración conserva las asignaciones existentes.

Mi IA selecciona el próximo partido programado vigente y permite revisar otro encuentro. La preparación usa la alineación publicada, las reglas reales y la posición asignada, incluyendo ejercicios y jugadas para portería, defensa, mediocampo y ataque. Los borradores no se comparten. El análisis de porteros aclara que el historial actual no mide atajadas ni goles evitados. Las guías son adaptaciones deportivas por reglas, con referencias FIFA, que el entrenador puede revisar.

Para limpiar los datos de demostración conservando identidad, torneo, normativa, QR y catálogo:

```bash
node scripts/prepare-team.mjs          # vista previa de cantidades
node scripts/prepare-team.mjs --apply  # respaldo previo y limpieza solicitada
```

Detén el backend antes de aplicar. El comando elimina plantel, partidos, pagos, soportes, sanciones, asignaciones y sesiones; pone el inventario en cero y deja notificaciones desactivadas. Crea un administrador con `TEAM_ADMIN_EMAIL` y `TEAM_ADMIN_NAME` opcionales; por defecto usa `admin@futapp.local`. Guarda una contraseña aleatoria en `.local/admin-inicial.txt`, excluida de Git. Rechaza sobrescribir un archivo de credenciales existente. El respaldo previo queda junto a la base en `backups/inicio-equipo-*`. No ejecutes seed sobre el equipo real.

## Publicación gratuita: Render + Supabase

La ruta elegida permite apagar el Mac: un servicio **Render Free** sirve React y la API; **Supabase Free** guarda PostgreSQL y los archivos en un bucket privado. [Guía de configuración, GitHub Actions e ingesta](docs/RENDER-FREE-SUPABASE.md).

El archivo [render.yaml](render.yaml) usa una instancia Free, sin disco ni base de Render. La tarea YAML genera las claves de arranque una sola vez y configura los secretos de Supabase. Solo publica el commit que pasó tipos, pruebas, build, Docker y PostgreSQL real. Los secretos permanecen en el servidor.

La ingesta de Configuración acepta el archivo privado del equipo, conserva las contraseñas, valida referencias y archivos, y aplica las tablas en una transacción. Un fallo conserva la base anterior. El destino debe estar nuevo; no se sobrescriben jugadores o pagos existentes.

Para desarrollo y Docker sigue disponible **SQLite**. Los comandos de consola de respaldo, restauración y limpieza se aplican a ese modo; [guía de traslado SQLite](docs/TRASLADO-Y-RESPALDOS.md). La copia local no sincroniza automáticamente con la nube.

Las capas gratuitas tienen cuotas y pausas. Render puede necesitar alrededor de un minuto para despertar; el bot de recordatorios no tiene ejecución continua garantizada. Exporta los datos y conserva una copia independiente.

## 📄 Licencia

Proyecto privado de demostración.
## Bot de notificaciones: WhatsApp y correo

El administrador encuentra **Notificaciones y bot** en el menú. En modo grupo, el bot avisa al grupo del equipo al crear o cambiar un partido y recuerda el encuentro en las ventanas de 24 y 2 horas antes del inicio. Los comprobantes de inscripción o uniforme y sus revisiones se notifican **únicamente al contacto privado del administrador**. El aviso de carga indica **pendiente de revisión**; subir el soporte no acredita dinero. El jugador consulta el resultado en FutApp. El grupo no recibe información de pagos, soportes ni datos de salud.

Los canales comienzan desactivados. Para conectar un **grupo existente de WhatsApp**:

1. Prepara una instancia `WHATSAPP-BAILEYS` de [Evolution API](https://github.com/evolution-foundation/evolution-api) y un **número exclusivo para el bot**. FutApp integra el proveedor; no lo instala ni crea automáticamente la instancia. Una sesión vinculada al WhatsApp personal puede acceder a las conversaciones que esa cuenta sincronice. Limitar los avisos al grupo no limita los permisos del proveedor sobre la sesión. Tu número personal puede recibir alertas sin vincularse al bot.
2. En `backend/.env` configura `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` y `EVOLUTION_INSTANCE`. La URL debe usar HTTPS; HTTP solo se acepta para localhost/127.0.0.1 en una instalación local. Las claves permanecen en el servidor. Reinicia el backend tras cambiar variables.
3. En **Notificaciones y bot**, selecciona Evolution y Grupo del equipo. Genera el QR de conexión y escanéalo desde **Dispositivos vinculados** del teléfono exclusivo. Agrega ese número al grupo del equipo, comprueba la conexión y carga la lista de grupos para elegir el grupo real. Solo un administrador puede generar el QR o consultar esta lista. FutApp devuelve únicamente identificador y nombre del grupo; no consulta historial de conversaciones.
4. Guarda tu teléfono personal con `+` e indicativo como destinatario privado y la URL HTTPS pública de FutApp. Activa WhatsApp y guarda. El servidor verifica que el bot pertenezca al grupo al guardar y antes de enviar. Haz una prueba privada y otra deportiva al grupo por separado. Si cambia el túnel, actualiza la URL.

Para **mensajes individuales** mediante el adaptador de Meta, selecciona Meta y Jugadores suscritos individualmente:

1. Configura WhatsApp Business Cloud API en Meta, un número de empresa y un token con permiso para enviar mensajes. Este adaptador usa la API oficial para destinatarios individuales.
2. Crea y consigue la aprobación de dos plantillas de utilidad: por ejemplo `futapp_partido` y `futapp_pago`, ambas sin cabecera ni botones obligatorios y con **cuatro variables de texto en el cuerpo**. El orden del contrato es equipo, asunto, detalle y enlace. Un cuerpo de referencia es `{{1}} / {{2}} / {{3}} / Abre FutApp: {{4}}`; configura ejemplos de cada variable al enviarlas a aprobación en Meta. La aprobación y disponibilidad de estas plantillas se comprueban mediante un envío de prueba real.
3. Configura `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_API_VERSION` en `backend/.env` para desarrollo o como secretos del servidor en producción. Usa una versión vigente admitida por tu aplicación de Meta. Reinicia el backend después de cambiar sus variables. Las claves no se guardan en SQLite ni se exponen a React.
4. En Notificaciones guarda el teléfono administrativo con `+` e indicativo, la URL HTTPS pública de FutApp (sin rutas), los nombres exactos y el idioma aprobado de las plantillas, y activa WhatsApp. Envía una prueba al número configurado. Si cambias el túnel, actualiza la URL.
5. Cada jugador activa sus avisos y registra su número completo desde su perfil. El teléfono de la ficha no equivale a una suscripción.

Correo es opcional y usa SMTP con TLS: `SMTP_HOST`, `SMTP_PORT` (465, 587 o 2525), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Conecta un proveedor que permita SMTP en tu hosting; luego activa correo y configura el destinatario administrativo. En modo individual, los jugadores activos que aceptaron avisos deportivos reciben en el correo de su propia cuenta; en modo grupo, todos los avisos deportivos van al grupo de WhatsApp. Los avisos administrativos siempre van solo al destinatario privado configurado. Nunca se incluyen soportes adjuntos, datos de salud, contraseñas o alineaciones en borrador; los enlaces a pagos requieren iniciar sesión con permisos de administrador.

La cola persiste en la base de datos configurada y se procesa cada 30 segundos mientras el backend esté encendido. Las fechas existentes de partidos se interpretan en **America/Bogota (UTC−05:00)** independientemente de la zona horaria del servidor. Los avisos del mismo evento se deduplican. Cambiar la hora, cancha o estado cancela mensajes pendientes con datos anteriores; un partido pospuesto o cancelado no genera recordatorios. Guardar preferencias cancela mensajes pendientes del jugador. Cambiar al modo grupo descarta avisos individuales pendientes. El botón **Notificar partido al equipo** permite anunciar encuentros existentes al destino configurado.

El historial distingue en cola, aceptado por el proveedor, bloqueado, fallido, incierto y cancelado. **Aceptado no significa entregado ni leído**; comprueba entrega/lectura en el proveedor. Los límites explícitos permiten reintentos automáticos acotados. Una desconexión o interrupción durante un envío queda incierta y necesita revisión del proveedor antes de reenviar, para evitar duplicados. La cola se guarda en la misma transacción que el partido o soporte. El bot envía avisos; la confirmación de asistencia y revisión de pagos se hacen en FutApp, no mediante respuestas conversacionales a WhatsApp.

Referencias oficiales: [Evolution API](https://github.com/evolution-foundation/evolution-api), [conexión de instancia](https://docs.evoapicloud.com/api-reference/instance-controller/instance-connect), [consulta de grupos](https://docs.evoapicloud.com/api-reference/group-controller/fetch-all-groups), [WhatsApp Business / Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), [colección oficial de Cloud API de Meta](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [SMTP / Nodemailer](https://nodemailer.com/smtp).

## Jugadores por torneo

En **Torneos → ficha del torneo → Jugadores inscritos**, el administrador selecciona integrantes activos y pulsa **Inscribir seleccionados**. Un jugador puede participar en varios torneos. Los torneos empiezan con una plantilla vacía; no se inscribe automáticamente a todo el equipo. Los jugadores consultan la plantilla de torneos publicados y su propia inscripción, sin acceder a datos de contacto o salud ajenos.

Cada partido con torneo usa exclusivamente sus inscritos para asistencia, alineaciones manuales, titulares, suplentes y análisis táctico de la IA. También se filtran los avisos individuales y se descartan avisos pendientes cuando el jugador pierde la inscripción; los avisos deportivos al grupo mantienen el destino compartido configurado. Los partidos sin torneo usan el plantel activo completo. El límite de convocatoria se aplica a cada partido, no al número de inscritos en el torneo. La inscripción deportiva no genera automáticamente una deuda ni acredita pagos.

Quitar un inscrito libera sus posiciones en borradores de partidos pendientes y retira la publicación si contenía a ese jugador, para que el administrador complete y publique de nuevo. Los partidos jugados y sus estadísticas se conservan. Al cambiar el torneo de un partido pendiente, se retira la publicación y se liberan posiciones de jugadores no inscritos en el nuevo torneo. La tabla `tournament_players` se conserva en la base de datos configurada y en las exportaciones de migración.

## Migración a Render y CI/CD

**Ruta elegida: Render Free + Supabase Free.** La app funciona aunque el Mac esté apagado. PostgreSQL conserva las cuentas y los datos; un bucket privado guarda fotos, documentos y comprobantes. [Instalación e ingesta en la nube](docs/RENDER-FREE-SUPABASE.md).

El despliegue está preparado en `render.yaml` y `.github/workflows/check.yml`. GitHub Actions valida el código, genera/configura variables mediante una tarea YAML y despliega el commit validado por la API de Render. Requiere `DEPLOY_TARGET=render`, `RENDER_SERVICE_ID` y los secretos privados de Render y Supabase. El script rechaza planes de pago y discos. Para pruebas locales sigue disponible [Mac mini con Docker y SQLite](docs/MAC-MINI-DOCKER.md).

**Configuración → Migración de datos** permite exportar la información real como archivo privado `.futapp` e ingerirla una sola vez en la instalación nueva. Incluye cuentas, fotos, normativa y comprobantes, sin publicar datos en GitHub. [Pasos completos de publicación, ingesta y respaldos](docs/TRASLADO-Y-RESPALDOS.md).
