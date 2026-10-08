# Bajas, aval y mapas del equipo

## Administración del plantel

En **Jugadores**, la acción **Eliminar jugador** pide confirmar una baja definitiva. Elimina la cuenta, datos personales y de salud, inscripciones, pagos y comprobantes, solicitudes y entregas de uniformes, sanciones, estadísticas, asistencia, membresías de torneos, sesiones y preferencias de notificaciones. También elimina su saldo de arbitraje y sus aplicaciones a otras fechas. Libera el dorsal y vacía sus posiciones en las formaciones.

La operación de base de datos es atómica: si falla, conserva todos los registros. Los archivos personales se eliminan del almacenamiento después de confirmar la transacción. Ante una interrupción del almacenamiento se informa que la limpieza sigue pendiente; una cola privada reintenta al iniciar y cada minuto mientras el servidor está activo. Los archivos pendientes ya no pueden consultarse mediante la aplicación.

Los torneos, partidos, uniformes del catálogo y demás integrantes se conservan. Si un administrador también tiene ficha de jugador, sus archivos compartidos del club pasan al administrador que permanece. Se protege al último administrador activo. Una baja no equivale a devolver físicamente un uniforme, por lo que no aumenta el inventario.

Los cobros futuros de arbitraje se recalculan con los asistentes que permanecen, y se revisa la elegibilidad de sus alineaciones. Al borrar una cuota histórica, se conserva el importe de cada compañero: el total contable de esa fecha pasa a representar las cuotas que quedan registradas. La eliminación también afecta informes históricos del jugador; requiere la confirmación explícita del administrador en el formulario de baja.

## Registro y aval

Si una cuenta antigua todavía existe con estado **Inactivo**, el administrador puede usar **Jugadores → Reactivar**. Recupera acceso con su contraseña existente y conserva su ficha, inscripciones e historial. El botón solo aparece en cuentas inactivas sin solicitud pendiente; una solicitud nueva requiere **Dar aval**. No permite recuperar una cuenta eliminada mediante la baja definitiva.

Todo registro por invitación crea una **solicitud pendiente**. No inicia sesión ni entrega una cookie o token. El administrador encuentra las solicitudes en **Jugadores**, puede **Dar aval** o **Rechazar y eliminar**. Solo después del aval puede iniciar sesión el jugador.

Un jugador dado de baja puede volver a registrar su correo y un dorsal libre, pero necesita nuevamente el aval. El nuevo ingreso empieza sin historial, pagos ni saldo anteriores. Las cuentas existentes conservan su estado; no se aplica una baja automática al desplegar esta versión. Crear una cuenta desde el formulario administrativo constituye el alta autorizada por el administrador.

## Mapas deportivos

La formación, el enfoque individual y las jugadas muestran fotos, dorsales y colores por rol. Si existe un inicial publicado, se utiliza esa selección. Antes de la publicación se muestra un **mapa de entrenamiento** generado por posición a partir de jugadores disponibles, independiente del borrador privado del entrenador. Sin partido se utiliza el plantel activo; con partido se respetan inscripción a ese torneo, sanciones, disponibilidad y pago de arbitraje a tiempo. Esta vista no publica el inicial ni agrega jugadores a un torneo. Los compañeros disponibles que no entran en el mapa aparecen como opciones de rotación. Cuando falta una foto aparecen las iniciales del jugador.

Los formatos reducidos tienen una cancha más alta y líneas separadas para evitar superponer portero, defensas y mediocampo, incluso al mostrar coordenadas guardadas de versiones anteriores. **Posición base**, **Con balón** y **Sin balón** cambian la distribución visual sin modificar la formación guardada. Las distancias son esquemáticas, no metros de cancha. La zona del rol se ilumina y la ubicación del jugador representado se resalta en dorado.

En **Mi IA** la preparación aparece antes de las métricas y conserva la sesión durante las actualizaciones de datos. En el **Laboratorio deportivo** del administrador, **Enfoque individual del plantel** permite escoger a cada jugador y abre inicialmente al portero. Está disponible aunque no haya partidos. El laboratorio del portero incluye ángulos, uno contra uno, salida, cobertura de profundidad y centros. Se pueden seleccionar objetivos y marcar prácticas; el avance pertenece a la sesión abierta y no registra una evaluación deportiva.

Se puede tocar una foto o usar el teclado para consultar su posición, activar líneas de apoyo y ampliar la cancha para recorrerla en un teléfono. Las líneas de apoyo son referencias visuales de proximidad, no movimientos aprobados por el entrenador. Las jugadas se reproducen automáticamente a petición del usuario o se recorren paso a paso. Las animaciones respetan la preferencia de reducir movimiento del dispositivo.

Las fotos de integrantes activos pueden verse entre compañeros autenticados. Los comprobantes siguen siendo privados para su propietario y el administrador. F8 conserva exactamente ocho posiciones, incluido el portero, y la duración de 50 minutos según la normativa configurada.

## Verificación y despliegue

`npm run typecheck`, `npm test`, `npm run build` y `npm run test:production` verifican la actualización. `tests/player-lifecycle.test.mts` prueba borrado y reversión, limpieza con fallos de almacenamiento, saldos, protección del administrador, aval atómico, reingreso, fotografías y compatibilidad de respaldos sobre SQLite y PostgreSQL.

GitHub Actions ejecuta estas pruebas contra PostgreSQL 17, construye los contenedores en AMD64 y ARM64, configura las variables privadas en Render y publica únicamente el commit validado. El despliegue crea las tablas nuevas sin alterar las cuentas o archivos existentes.
