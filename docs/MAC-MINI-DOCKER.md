# FutApp en el Mac mini con Docker

Esta ruta conserva SQLite y los archivos actuales. No usa el servicio de pago de Render ni necesita Supabase. Docker Desktop es gratuito para uso personal y pequeñas empresas dentro de los términos de su licencia. El Mac consume electricidad y usa tu conexión a internet; debe permanecer encendido, con Docker abierto y sin suspensión para que los integrantes puedan entrar.

## Primera instalación

1. Instala [Docker Desktop para Mac](https://docs.docker.com/desktop/setup/install/mac-install/) eligiendo Apple Silicon para M1/M2/M3/M4 o el instalador Intel según tu Mac. Abre Docker y espera a que el motor esté listo. No necesitas instalar Node en el Mac para ejecutar la app.
2. En Terminal:

   ```sh
   git clone https://github.com/AdrianMonsalve97/futapp.git
   cd futapp
   sh scripts/docker-init.sh
   docker compose --env-file "$HOME/FutAppData/docker.env" up -d --build app
   docker compose --env-file "$HOME/FutAppData/docker.env" ps
   ```

   Si ya tienes el checkout en el Mac, usa esa carpeta y actualízala con `git pull --ff-only` en lugar de clonar de nuevo. Si hay cambios locales, consérvalos antes de actualizar.

3. Abre `http://localhost:8080`. El primer arranque crea únicamente el administrador de migración. Su correo es `admin@futapp.local`; la contraseña aleatoria está en el archivo privado `~/FutAppData/docker.env`, campo `ADMIN_PASSWORD`. Consúltala localmente; no la compartas en chats ni capturas. Tras importar, usarás las cuentas originales.

El inicializador genera las claves una sola vez y no reemplaza una configuración existente. La carpeta permanente predeterminada es `~/FutAppData/runtime`, montada en `/var/lib/futapp` dentro del contenedor. Los archivos quedan fuera del repositorio y de la máquina virtual de Docker. Compose rechaza una carpeta inexistente para evitar arrancar por error contra una ubicación vacía. El contenedor usa el UID y GID de tu cuenta en el Mac para escribir en esa carpeta.

## Ingerir los datos que ya tenemos

1. Mantén el origen disponible durante la preparación. Cuando vayas a hacer el traslado final, avisa al equipo que deje de agregar información en la app anterior.
2. En la app actual, **Configuración → Migración de datos → Exportar datos para migración**. Guarda el archivo `.futapp` en un lugar privado y transfiérelo al Mac. No lo subas a GitHub. Exporta nuevamente si alguien agregó información después de generar la copia.
3. En el Mac, inicia sesión con el administrador inicial y abre **Configuración → Migración de datos → Activar ingesta de semilla**. Selecciona el archivo, revisa las cantidades y escribe **IMPORTAR**. No registres jugadores ni subas imágenes en el destino antes de importar: la ingesta exige una instalación nueva.
4. Pulsa **Ingresar con las cuentas importadas** y entra con tu administrador habitual y la contraseña que ya usas. Se conservan los datos del equipo, pagos, salud, torneos, inscritos, alineaciones y archivos. Las sesiones e invitaciones antiguas se invalidan; los avisos automáticos permanecen apagados.
5. Comprueba las cantidades y abre las fotos, documentos y comprobantes. Después prueba una recreación:

   ```sh
   docker compose --env-file "$HOME/FutAppData/docker.env" up -d --force-recreate app
   ```

   Vuelve a ingresar y revisa la información. La carpeta del Mac es la misma; recrear el contenedor no la reemplaza.

GitHub Actions realiza esta prueba completa en Linux AMD64 y ARM64 usando datos de prueba. También se ha probado la ingesta del archivo real en una base aislada, comparando las cantidades, hashes de contraseñas, archivos y referencias. La verificación final en tu Mac sigue siendo necesaria: ninguna prueba sustituye la protección contra un fallo del disco o la pérdida del computador.

Para archivos mayores al límite del importador, usa el respaldo completo y `scripts/restore.mjs` con el destino detenido y una carpeta nueva; consulta [Traslado y respaldos](TRASLADO-Y-RESPALDOS.md). No copies solamente un archivo `.db` mientras está abierto: puede haber escrituras en WAL.

## Dar acceso al equipo con un túnel gratuito

```sh
docker compose --env-file "$HOME/FutAppData/docker.env" --profile tunnel up -d
docker compose --env-file "$HOME/FutAppData/docker.env" logs tunnel
```

Cloudflare imprime una URL HTTPS `https://…trycloudflare.com`. Edita localmente `~/FutAppData/docker.env` y establece `PUBLIC_APP_URL` a esa URL exacta; después ejecuta:

```sh
docker compose --env-file "$HOME/FutAppData/docker.env" up -d app
```

Comparte la URL HTTPS con el equipo. El puerto 8080 solo se publica en `127.0.0.1`; no debes abrir puertos del router. El túnel rápido es útil para pruebas, y su URL puede cambiar al recrear o reiniciar el túnel. Si cambia, actualiza `PUBLIC_APP_URL` y comparte la dirección nueva. Para una URL fija, configura un túnel administrado con un dominio que controles; este paso se hace aparte y no implica comprar un dominio desde esta configuración.

En macOS, configura el equipo para que no suspenda mientras presta el servicio y activa el inicio de Docker al ingresar en tu cuenta. `restart: unless-stopped` reinicia los contenedores cuando vuelve el motor; no inicia Docker antes del inicio de sesión ni mantiene el Mac encendido.

## Respaldar y actualizar

Para una copia final consistente de base y archivos, detén el servicio durante el respaldo:

```sh
docker compose --env-file "$HOME/FutAppData/docker.env" stop app
docker compose --env-file "$HOME/FutAppData/docker.env" run --rm --no-deps app node ../scripts/backup.mjs
docker compose --env-file "$HOME/FutAppData/docker.env" up -d app
```

El comando de respaldo no ejecuta `main.js`, no crea administradores y no modifica la base de origen. Guarda la copia fechada junto a los datos, en `~/FutAppData/runtime/backups/`. Si el respaldo falla, revisa el error antes de tratarlo como una copia válida y vuelve a levantar el servicio.

Conserva también una copia privada **fuera del Mac** (disco externo o almacenamiento cifrado). Un volumen persistente protege frente a recrear contenedores; no protege frente a averías del disco. `~/FutAppData/docker.env` se respalda por separado y contiene secretos; no entra en el archivo de ingesta.

Para actualizar el código, primero respalda y después:

```sh
git pull --ff-only
docker compose --env-file "$HOME/FutAppData/docker.env" up -d --build app
```

Comprueba `/api/health`, inicia sesión y verifica los archivos antes de continuar. No ejecutes `seed`, `reset` ni herramientas de limpieza contra la base real. No borres `~/FutAppData/runtime` al actualizar. Docker Compose mantiene ese bind mount incluso al eliminar contenedores.

## CI/CD y Podman

GitHub Actions valida el código y la ingesta del contenedor en ambas arquitecturas. Las claves locales las genera `scripts/docker-init.sh` en el Mac, una sola vez; no se publican como artefactos ni secretos en los logs. La actualización manual usa el comando anterior.

También está preparado **Actions → Publicar FutApp en Mac mini → Run workflow**. Para conectarlo, en GitHub → Settings → Actions → Runners añade un runner **macOS** con la arquitectura de tu Mac y la etiqueta adicional `futapp`. Ejecuta sus instrucciones directamente en el Mac; el token temporal no se comparte en el chat. Usa una cuenta local dedicada cuando sea posible, con Docker disponible y acceso a la carpeta de FutApp. Estos comandos no han registrado ningún runner por ti.

Después configura la variable de repositorio `MAC_DEPLOY_ENABLED=true`. Si personalizaste la ubicación de datos, indica `MAC_DATA_DIR` antes de la primera inicialización. El workflow es manual, solo acepta `main` y exige que **FutApp CI/CD** haya pasado para el mismo commit. Su tarea YAML **Generar variables privadas una sola vez** crea o conserva `~/FutAppData/docker.env`; las claves quedan fuera del checkout, por lo que la limpieza del workspace no las borra. Construye, detiene la app, respalda base y archivos y arranca comprobando su estado. Si falla antes de cambiar el contenedor, intenta reactivar el existente; no restaura ni sobrescribe automáticamente una base real. Los respaldos quedan disponibles para recuperación manual.

No conectes este runner a workflows de pull requests ni a código de terceros sin revisar: el runner ejecuta código en tu Mac. Este cambio no abre SSH ni expone el socket de Docker en internet. Para la primera migración, mantén los avisos desactivados y completa la ingesta desde Configuración después del primer arranque.

Si no mantendrás el Mac encendido, usa la [ruta Render Free + Supabase Free](RENDER-FREE-SUPABASE.md). El despliegue Render solo se ejecuta con `DEPLOY_TARGET=render` y sus credenciales; ahora `render.yaml` usa PostgreSQL remoto y almacenamiento privado, sin disco de pago.

Podman también puede ejecutar contenedores en macOS mediante una máquina virtual y un proveedor Compose. Para este montaje empezamos con Docker, cuyo flujo está cubierto por las pruebas. Si en el futuro usas Podman, prueba el acceso al bind mount y la persistencia antes de pasarle los datos reales.

Referencias: [licencia de Docker Desktop](https://docs.docker.com/subscription-billing/desktop-license/), [bind mounts](https://docs.docker.com/engine/storage/bind-mounts/), [Podman en Mac](https://podman.io/docs/installation), [túneles rápidos](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
