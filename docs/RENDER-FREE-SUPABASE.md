# FutApp sin depender del Mac: Render Free + Supabase Free

El frontend y el backend se sirven juntos desde un servicio **Render Free**. PostgreSQL, las cuentas y los datos deportivos viven en Supabase; fotos, documentos y comprobantes se guardan en un bucket **privado**. El Mac puede apagarse. La instalación SQLite actual conserva sus datos mientras preparas el traslado.

## 1. Crear Supabase Free

En [Supabase](https://supabase.com/dashboard), crea un proyecto en una organización **Free**. Guarda la contraseña de la base en un administrador de contraseñas. No actives planes de pago ni complementos.

Cuando el proyecto esté listo, necesitarás:

| Secreto de GitHub Actions | De dónde obtenerlo |
| --- | --- |
| `DATABASE_URL` | **Connect → Session pooler**, puerto **5432**. Reemplaza el marcador de contraseña con la contraseña de la base, codificada para una URI. Usa la cadena del panel; la conexión directa puede requerir IPv6. |
| `SUPABASE_URL` | La URL HTTPS del proyecto, por ejemplo `https://referencia.supabase.co`. |
| `SUPABASE_SECRET_KEY` | La clave secreta del servidor (`sb_secret_…`); también se admite la clave legacy `service_role`. No uses `publishable` ni `anon`. |
| `SUPABASE_DB_CA` | Certificado raíz obtenido en **Database Settings → SSL Configuration → Download certificate**. El Session pooler usa la CA de Supabase y necesita este certificado para validar TLS. Guarda el contenido PEM completo, conservando sus líneas. |

Guárdalos en **GitHub → futapp → Settings → Secrets and variables → Actions → New repository secret**. No los pegues en chats, archivos del repositorio, `VITE_*` ni variables del frontend. El bucket `futapp-media` lo crea el backend como privado; si existe y es público, el arranque se detiene. Las tablas de la app están en el esquema privado `futapp`, fuera de la API pública de Supabase.

## 2. Crear el servicio Render Free

En [Render](https://dashboard.render.com), conecta el repositorio `AdrianMonsalve97/futapp`, rama `main`, sin Root Directory. El archivo [render.yaml](../render.yaml) usa `plan: free`, una instancia Node y **ningún disco**. No crees una base PostgreSQL gratuita de Render: esa base vence a los 30 días.

Configuración para un Web Service creado manualmente:

- Runtime: **Node**; plan: **Free**.
- Build: `npm ci --include=dev && npm run build`.
- Start: `npm run start`.
- Health check: `/api/health`.
- Auto deploy: **Off**; las actualizaciones verificadas se publican desde GitHub Actions.

Si Render inicia un primer build antes de recibir las variables privadas, puede quedar fallido: no registres datos ahí. El workflow configura las variables y publica el commit validado. Si usas el Blueprint, Render solicita las variables marcadas `sync: false`; configúralas directamente en su panel privado.

## 3. Conectar GitHub Actions

Crea una API key de Render en tu cuenta y guárdala como secreto **`RENDER_API_KEY`** de GitHub. No la compartas en el chat. Copia el identificador `srv-…` del servicio como variable de repositorio **`RENDER_SERVICE_ID`** y establece **`DEPLOY_TARGET=render`**. Mantén `MAC_DEPLOY_ENABLED` desactivado si ya no usarás el Mac para publicar.

Ejecuta **Actions → FutApp CI/CD → Run workflow → main** después de guardar los secretos. Para cada commit:

1. Comprueba tipos, pruebas, build y arranque de producción.
2. Prueba Docker en AMD64 y ARM64, y la ingesta contra PostgreSQL 17 en una base desechable.
3. La tarea YAML **Generar y configurar variables de entorno en Render** ejecuta `scripts/render-deploy.mjs configure`. Genera JWT y contraseña inicial una sola vez; conserva los existentes, aplica los secretos de Supabase y configura la URL pública. El script rechaza servicios de pago, discos y conexiones inseguras antes de cambiar variables.
4. Publica únicamente el SHA validado y comprueba la salud. Los avisos automáticos siguen desactivados hasta que los configures.

El primer administrador es `admin@futapp.local`. Consulta `ADMIN_PASSWORD` en el panel privado de variables de Render. Esa cuenta se utiliza solo para la ingesta inicial; al importar se reemplaza por tus cuentas originales. No se recrea ni cambia la contraseña de las cuentas al reiniciar la app.

## 4. Ingerir la información existente

1. En la app actual: **Configuración → Migración de datos → Exportar datos para migración**. Conserva el `.futapp` en privado. Para el traslado final, deja de escribir en el origen y exporta nuevamente si hubo cambios.
2. En la URL HTTPS de Render, inicia sesión con el administrador inicial. Antes de crear jugadores o subir imágenes, abre **Configuración → Migración de datos → Activar ingesta de semilla**.
3. Selecciona el archivo, revisa las cantidades y escribe **IMPORTAR**. Se verifican formato, referencias, dorsales únicos, hashes de archivos y cantidades. Los archivos se suben y se vuelven a leer para verificar su hash; la base se aplica en una transacción. Un fallo conserva la base anterior y elimina los objetos subidos por ese intento; si el proveedor también falla al eliminarlos, el log avisa de la limpieza pendiente.
4. Entra con tu administrador habitual y la contraseña existente. Se conservan datos del equipo, cobertura de salud, torneos, miembros, inscripciones, pagos, alineaciones y documentos. Sesiones e invitaciones antiguas quedan invalidadas. WhatsApp y correo permanecen apagados.
5. Revisa cuentas y archivos, y prueba un reinicio de Render. La información vive en Supabase y sobrevive a reinicios y despliegues.

La ingesta admite hasta 25 MB comprimidos. Si el equipo supera ese límite, no lo dividas manualmente: prepara una migración por consola antes de mover los datos. La ingesta solo se permite en un destino nuevo y una vez. No sobrescribe una base que ya tenga jugadores o movimientos.

## Respaldos y límites

Exporta periódicamente desde **Configuración → Migración de datos** y conserva una copia privada fuera de Supabase. El paquete incluye datos y archivos, sin claves del servidor. La exportación mantiene una vista consistente de las tablas durante su creación. El modelo de IA entrenado se guarda en PostgreSQL y sobrevive a reinicios; las exportaciones trasladan la historia que permite volver a entrenarlo, no el caché del modelo.

No uses `seed`, `reset`, `admin:create`, `backup.mjs` ni `restore.mjs` para gestionar PostgreSQL: esas herramientas trabajan sobre SQLite. Para recuperación de PostgreSQL usa un destino nuevo, la ingesta verificada y, cuando corresponda, `pg_dump` junto al respaldo del bucket. Un plan gratis no sustituye una copia independiente.

Render Free puede suspender la app tras 15 minutos sin solicitudes y tardar alrededor de un minuto en despertar. Por eso el bot de recordatorios no tiene ejecución continua garantizada en este plan. Supabase Free incluye 500 MB de base y 1 GB de archivos y puede pausar proyectos con poca actividad. Revisa las cuotas; si se agotan, decide cómo ajustar el uso antes de contratar servicios de pago. La app no activa planes de pago automáticamente.

Referencias: [Render Free](https://render.com/docs/free), [Supabase Free](https://supabase.com/pricing), [Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres), [claves de API](https://supabase.com/docs/guides/api/api-keys), [almacenamiento privado](https://supabase.com/docs/guides/storage/serving/downloads).

## Diagnóstico de conexión

Si Render falla al arrancar, ejecuta **Actions → Diagnosticar conexión de FutApp → Run workflow → main**. La tarea consulta el servicio, compara las variables sin imprimirlas y comprueba PostgreSQL y el bucket mediante operaciones de solo lectura. El resumen muestra códigos y estados, sin contraseñas, cadenas de conexión ni datos de jugadores. Su ejecución correcta significa que terminó la consulta; revisa también los resultados de cada comprobación.

`SELF_SIGNED_CERT_IN_CHAIN` indica que falta configurar la CA de Supabase. Añade `SUPABASE_DB_CA` y repite el diagnóstico. Mantén la verificación del certificado y del hostname; no desactives TLS. [Configuración SSL de Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement).
