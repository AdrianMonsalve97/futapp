# Trasladar FutApp sin perder datos

FutApp guarda la información en SQLite y los archivos en una carpeta local. Un túnel solo da acceso al servidor: no borra, copia ni sincroniza estos datos. Reiniciar el servidor local conserva sus archivos. Clonar el repositorio en otro equipo crea una instalación distinta, porque los datos, respaldos y secretos están excluidos de Git.

## Crear el respaldo

Desde la raíz del proyecto, con Node.js 24 o posterior:

```bash
npm run backup
```

El comando indica la carpeta creada en `backend/data/backups/` cuando se usa la ubicación predeterminada. Con `DB_PATH` personalizado, crea `backups/` junto a esa base. Incluye `portal.db`, la carpeta `uploads/` y `model.json` si existe. SQLite se copia usando su mecanismo de respaldo, compatible con WAL; no copies solo el archivo de una base abierta con el explorador.

Para un traslado definitivo, detén el backend de origen antes de generar la última copia. Así nadie registra pagos, jugadores o archivos durante el cambio. El respaldo de la base es consistente aun con el servidor encendido, pero copiar archivos mientras se modifican no crea una instantánea simultánea de todo el contenido.

El respaldo contiene datos privados y hashes de contraseñas. Transfiérelo por un medio privado; no lo publiques en GitHub ni en una URL pública. Conserva una copia fuera del computador o del disco de Render. El ZIP no está cifrado.

## Restaurar en el Mac mini

1. Lleva el código actualizado a la Mac. Los cambios locales sin commit/push no aparecen al clonar GitHub. Instala Node.js 24 o posterior y ejecuta `npm ci` allí; no copies `node_modules` desde Windows.
2. Mantén detenido el backend de destino. Descomprime el respaldo y localiza su carpeta fechada, donde se encuentra `portal.db` junto a `uploads/`.
3. Elige una carpeta de datos **nueva que todavía no exista**, por ejemplo `$HOME/FutAppData/inicio-2026-10-07`. Restaura con `npm run restore -- --from /ruta/al/respaldo/fechado --to /Users/TU_USUARIO/FutAppData/inicio-2026-10-07`. El comando verifica la base y todos los archivos, y rechaza destinos existentes. Si ya tienes otra instalación, respáldala y usa otra carpeta nueva.
4. Crea `backend/.env` con la ruta absoluta de la base, por ejemplo:

   ```dotenv
   DB_PATH=/Users/TU_USUARIO/FutAppData/inicio-2026-10-07/portal.db
   JWT_SECRET=CONFIGURA_AQUI_UN_SECRETO_ALEATORIO_NUEVO_DE_AL_MENOS_32_CARACTERES
   JWT_EXPIRES_IN=8h
   CORS_ORIGIN=http://localhost:5173
   ```

   Genera el secreto en la Mac con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y pega el resultado en `.env`. El valor mostrado arriba es una indicación, no un secreto válido. No subas `.env` a GitHub.
5. Ejecuta `npm run dev`. La aplicación migra el esquema sin ejecutar seed ni borrar datos. Entra con las mismas cuentas y contraseñas del respaldo. Usar un secreto nuevo requiere iniciar sesión otra vez.
6. Comprueba jugadores, pagos, normativa y archivos. Cuando el túnel nuevo esté disponible, configura `PUBLIC_APP_URL=https://TU-TUNEL` en `backend/.env` y reinicia el backend. El túnel debe apuntar al frontend que también permite acceder a `/api`.

No ejecutes `seed`, `reset` ni `prepare-team.mjs --apply` al restaurar datos reales. Las notificaciones deben seguir desactivadas en el servidor de pruebas para evitar avisos duplicados.

## Publicar en Render

El archivo `render.yaml` prepara un servicio Node con un disco persistente en `/var/data` y `DB_PATH=/var/data/portal.db`. La base, los archivos en `/var/data/uploads` y el modelo quedan en ese disco. El servicio y el disco requieren un plan de pago; la configuración no crea recursos hasta que se despliega.

### Crear el servicio y conectar GitHub Actions

1. En Render, elige **New → Blueprint**, conecta `AdrianMonsalve97/futapp`, rama `main`, y usa `render.yaml`. Revisa el precio mostrado por Render antes de crear los recursos: esta app con SQLite necesita el servicio de pago y el disco persistente. Mantén una sola instancia, raíz del repositorio vacía y disco en `/var/data`.
2. La creación inicial desde Blueprint construye el servicio. Los despliegues posteriores los controla **GitHub Actions**; `autoDeployTrigger: off` evita un segundo despliegue por cada push. Los cambios del Blueprint deben sincronizarse deliberadamente desde Render cuando se cambie su infraestructura.
3. En Render → Account Settings → API Keys, crea una clave para esta automatización. Guárdala **directamente** como secreto `RENDER_API_KEY` en [GitHub → Settings → Secrets and variables → Actions](https://github.com/AdrianMonsalve97/futapp/settings/secrets/actions). No la pegues en chats ni en archivos versionados. Guarda el ID `srv-…` del servicio como variable de repositorio `RENDER_SERVICE_ID` en la pestaña **Variables**. Si todavía no está esa variable, el workflow valida el código y omite el despliegue.
4. En [Actions → FutApp CI/CD](https://github.com/AdrianMonsalve97/futapp/actions), ejecuta **Run workflow** sobre `main`. El job `verify` comprueba tipos, pruebas, build y ejecución de producción. El job `render` usa el entorno `production`; la tarea **Generar y configurar variables de entorno en Render** crea los secretos que falten y configura Node, zona horaria, base persistente y URL. Conserva JWT, contraseña inicial y variables de proveedores existentes; nunca imprime sus valores. La siguiente tarea publica exactamente `GITHUB_SHA`, espera `live`, verifica el commit y consulta `/api/health`.
5. Revisa que Actions esté verde y abre el dominio HTTPS del servicio. La contraseña del administrador inicial se consulta privadamente en Render → servicio → **Environment → ADMIN_PASSWORD**; correo `admin@futapp.local` salvo que hayas personalizado `ADMIN_EMAIL`. Este administrador se crea únicamente si la base no contiene usuarios, y nunca reemplaza las cuentas después de un redeploy o una importación. Después de importar, puedes eliminar `BOOTSTRAP_ADMIN` y las variables `ADMIN_*` de Render si desactivas también su generación en la automatización.

### Ingesta de los datos reales desde Configuración

1. En la app de origen, entra como administrador a **Configuración → Migración de datos → Exportar datos para migración**. Descarga el archivo `.futapp` privado. Para el traslado final, pausa el ingreso de nuevos datos en el origen y exporta de nuevo; las dos instalaciones no se sincronizan.
2. En la app nueva de Render, entra con el administrador inicial. Sin agregar jugadores o archivos todavía, abre **Configuración → Migración de datos → Activar ingesta de semilla**. La ingesta solo se habilita con una única cuenta administrativa y sin datos deportivos, archivos o inscripciones.
3. Selecciona el archivo `.futapp` (máximo 25 MB comprimido y 64 MB expandido). Revisa las cantidades mostradas y escribe **IMPORTAR**. La previsualización vence a los diez minutos y pertenece al administrador que la solicitó. Ambas apps deben usar la misma versión del esquema; el orden histórico de las columnas puede diferir.
4. Se valida el formato, los archivos y sus hashes, los dorsales únicos y las referencias entre tablas. Antes de importar se guarda el estado inicial de la base en `/var/data/backups/antes-de-ingesta-…/portal.db`. La copia se aplica en una transacción usando las reglas del esquema instalado; ningún SQL del archivo se ejecuta. Un fallo conserva la base anterior y retira los archivos nuevos de ese intento.
5. Pulsa **Ingresar con las cuentas importadas** e inicia sesión con tu administrador habitual. Se conservan usuarios, contraseñas, salud, torneos, inscritos, partidos, alineaciones, uniformes, pagos, QR, reglamentos, fotos y comprobantes. Las sesiones e invitaciones antiguas se invalidan; genera una nueva invitación para registrar jugadores. Los envíos quedan apagados y no se trasladan colas de notificaciones pendientes. La IA vuelve a entrenar con las estadísticas importadas.
6. Comprueba la información y los archivos en Render antes de que todos continúen registrando datos allí. Conserva una copia privada fuera de Render. La ingesta se desactiva al terminar y no puede repetirse sobre el equipo existente. Para recuperaciones posteriores, usa un respaldo y una carpeta nueva con el servidor detenido.

La exportación excluye `.env` y claves de proveedores. El archivo contiene datos personales, de salud, pagos y hashes de contraseñas; está comprimido, **no cifrado**. No lo subas al repositorio público. La ingesta es exclusiva de administradores autenticados y se realiza a través del dominio HTTPS de la app.

Si el equipo supera los límites de ingesta, usa `npm run backup` y el restaurador por consola con el destino detenido. El disco solo está disponible en ejecución; no se restaura desde el build o un pre-deploy. El traslado por SSH/SFTP usa la conexión real del servicio y debe comprobar el fingerprint del servidor antes de transferir.

`PUBLIC_APP_URL` se configura en la tarea YAML; el servidor también reconoce `RENDER_EXTERNAL_URL` automáticamente. Si restauras una base con administrador, conserva esa cuenta y no ejecutes `admin:create`. `.env` y las claves de proveedores se configuran aparte.

Una vez publicada, usa Render como la base principal para todos los integrantes. Una copia local restaurada no sincroniza sus cambios con Render. Repite los respaldos después de incorporar datos importantes y guarda una copia externa del servicio.

Referencias oficiales: [discos persistentes](https://render.com/docs/disks) y [limitaciones de servicios gratuitos](https://render.com/docs/free).
