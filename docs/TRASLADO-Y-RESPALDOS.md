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

## Publicar en Render Free con Supabase

La publicación elegida usa PostgreSQL y archivos privados en Supabase. Consulta la [guía completa de Render Free + Supabase Free](RENDER-FREE-SUPABASE.md). `render.yaml` no crea discos ni bases de pago.

El paquete `.futapp` de **Configuración → Migración de datos → Exportar datos para migración** permite trasladar las cuentas y los archivos desde SQLite a PostgreSQL. El destino debe estar nuevo y la ingesta requiere un administrador, previsualización y confirmación **IMPORTAR**. Se conservan contraseñas y datos; las sesiones antiguas se invalidan y los envíos quedan desactivados.

Para el traslado final, deja de escribir en el origen, exporta nuevamente y comprueba las cantidades y archivos después de importar. Las instalaciones no se sincronizan. Usa la nube como origen principal una vez verificada.

El archivo contiene datos privados y hashes de contraseñas. Está comprimido, no cifrado: no lo subas a GitHub ni a una URL pública. Conserva una copia externa. Las herramientas SQLite descritas arriba no restauran una base PostgreSQL.
