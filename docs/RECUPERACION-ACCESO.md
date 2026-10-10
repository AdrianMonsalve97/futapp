# Recuperación de acceso

El login ofrece **¿Olvidaste tu contraseña?**. Cuando el correo está configurado, el jugador introduce el correo de su cuenta y recibe un enlace que permite elegir una contraseña nueva, sin perder pedidos, pagos, estadísticas o datos del perfil. El enlace vence en 15 minutos, se utiliza una sola vez y no inicia sesión automáticamente. Al restablecer, se revocan las sesiones anteriores y se envía una confirmación sin la contraseña.

## Activar Brevo gratuito mediante GitHub Actions

1. Crea una cuenta en [Brevo](https://www.brevo.com/) y usa su plan gratuito; no es necesario cambiar Render a un plan de pago para enviar mediante HTTPS.
2. En **Senders & domains**, agrega y verifica el remitente desde el que enviarás los correos. Completa la verificación o autenticación solicitada por Brevo. No inventes una dirección ni uses `admin@futapp.local` como remitente: los correos `.local` no reciben mensajes.
3. Crea una clave de API en Brevo y guárdala como secreto **BREVO_API_KEY** en GitHub → FutApp → Settings → Secrets and variables → Actions. No la pegues en el chat, en un commit, en React ni en una variable `VITE_*`.
4. Guarda el correo del remitente verificado como secreto **MAIL_FROM**. Opcionalmente configura la variable de Actions **MAIL_FROM_NAME**, por ejemplo el nombre del club.
5. Ejecuta **FutApp CI/CD** en la rama `main`. Su tarea YAML aplica esas variables a Render y conserva los demás secretos. Si todavía no existen, el despliegue funciona con recuperación asistida; si se configura solo una de las dos, la tarea indica qué falta.
6. En **Administrador → Configuración → Recuperación de contraseñas**, comprueba que aparece configurado. Desde el login prueba la recuperación de **tu propia cuenta con un correo real** y revisa spam. Tener las variables presentes no confirma por sí solo la verificación del remitente, aceptación de la cuenta o entrega a la bandeja: completa lo que solicite Brevo si rechaza el envío. El enlace apunta a `PUBLIC_APP_URL`, configurada por CI/CD como la URL pública de Render.

La recuperación automática usa el correo registrado. Una cuenta con un correo ficticio o `.local`, incluida la cuenta inicial `admin@futapp.local`, no puede recibir el enlace; conserva las credenciales privadas del administrador y usa correos reales para las cuentas nuevas. Los secretos de bootstrap no reemplazan la contraseña de una cuenta que ya existe.

Render Free [bloquea los puertos SMTP 25, 465 y 587](https://render.com/docs/free). Este adaptador usa la [API HTTPS de Brevo](https://developers.brevo.com/reference/send-transac-email), con el [remitente verificado](https://developers.brevo.com/docs/getting-started-with-senders-and-domains). No activa WhatsApp ni el bot de notificaciones deportivas.

## Recuperación asistida disponible sin correo

En **Jugadores → ficha del jugador → Recuperar acceso**, verifica la identidad del jugador por un canal conocido, confirma **tu** contraseña de administrador y genera un enlace privado. Cópialo y compártelo únicamente con el titular por un canal privado. El jugador elige su propia contraseña; no tienes que conocerla ni escribirla por él. El enlace funciona una vez y vence en 15 minutos. Generar otro invalida el anterior, sin bloquear la contraseña actual.

Esta opción solo recupera cuentas de jugadores activos. No aprueba registros pendientes ni reactiva bajas. El administrador recibe el enlace solo tras reautenticarse; el endpoint público nunca lo revela. No hay botones que envíen estos enlaces a grupos.

## Controles y operación

Las nuevas contraseñas requieren al menos 8 caracteres, con mayúscula, minúscula, número y carácter especial (por ejemplo `!`, `@` o `_`). Los espacios no cuentan como carácter especial. La regla se aplica al registro, creación de jugadores, cambio y recuperación, y al administrador inicial. Las cuentas y contraseñas ya existentes siguen funcionando; no se cambian automáticamente ni se fuerzan nuevas contraseñas al desplegar.

- `POST /api/auth/forgot-password`: respuesta uniforme para cuentas existentes, inexistentes, inactivas o limitadas; 10 solicitudes por hora por IP y 5 por hora por cuenta, con separación mínima de un minuto. El envío ocurre aparte de la respuesta para evitar distinguir cuentas por la demora del proveedor. Si falta configuración, devuelve 503 para todos y la página indica recuperación asistida.
- `POST /api/auth/reset-password`: recibe token, contraseña y confirmación. Exige un mínimo de 8 caracteres, mayúscula, minúscula, número y carácter especial, con un máximo de 72 bytes; rechaza la contraseña anterior. Consumo atómico en SQLite y PostgreSQL, incluso ante solicitudes simultáneas.
- `POST /api/auth/admin-reset`: solo administrador autenticado, contraseña actual y jugador activo. Una solicitud rechazada no modifica contraseñas ni sesiones.
- Se guardan hashes de los tokens y una huella de las credenciales; el token completo está únicamente en el enlace y el correo. El token viaja en el fragmento `#token=...`, que no se envía al servidor al abrir la página; la pantalla lo retira de la barra de direcciones y lo mantiene en memoria mientras completas el formulario. Si recargas esa pantalla, abre de nuevo el enlace original.
- Cambiar contraseña, rol o estado invalida los enlaces. La baja definitiva elimina los tokens asociados. Los enlaces y contadores son transitorios: no se restauran desde backups. Los respaldos anteriores que no contienen las nuevas tablas siguen siendo compatibles.
- El estado de entrega (`pending`, `sent`, `failed`) se guarda sin registrar token, dirección del destinatario o respuestas privadas del proveedor en los logs. `sent` indica aceptación de la API, no garantiza que llegó a la bandeja.

Se siguen las recomendaciones de [OWASP para recuperación de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Las pruebas cubren expiración, repetición, concurrencia, permisos, bajas, cambios de credenciales, límites, cierre de sesiones, fallos de correo y compatibilidad de ingesta en ambas bases de datos.
